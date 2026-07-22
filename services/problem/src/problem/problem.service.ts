/**
 * @file Problem 서비스 — 문제 CRUD + 마감 시간 캐시 연동
 * @domain problem
 * @layer service
 * @related problem.controller.ts, problem.entity.ts, deadline-cache.service.ts
 */
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource, In, LessThanOrEqual, Not } from 'typeorm';
import { Problem, ProblemCategory, ProblemStatus, Difficulty } from './problem.entity';
import { CreateProblemDto, UpdateProblemDto } from './dto/create-problem.dto';
import { RECOMMENDATION_SEEDS, RecommendationItem } from './recommendation-seeds';
import { DeadlineCacheService } from '../cache/deadline-cache.service';
import { DualWriteService } from '../database/dual-write.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { CrawlerService } from '../crawler/crawler.service';

/**
 * 허용된 상태 전이 맵 — 현재 상태 → 전이 가능한 상태 목록
 * DRAFT → ACTIVE
 * ACTIVE → CLOSED, DELETED
 * CLOSED → ACTIVE (재개), DELETED
 * DELETED → (전이 불가)
 */
const ALLOWED_STATUS_TRANSITIONS: Record<ProblemStatus, ProblemStatus[]> = {
  [ProblemStatus.DRAFT]: [ProblemStatus.ACTIVE],
  [ProblemStatus.ACTIVE]: [ProblemStatus.CLOSED, ProblemStatus.DELETED],
  [ProblemStatus.CLOSED]: [ProblemStatus.ACTIVE, ProblemStatus.DELETED],
  [ProblemStatus.DELETED]: [],
};

@Injectable()
export class ProblemService {
  constructor(
    private readonly dualWrite: DualWriteService,
    private readonly deadlineCache: DeadlineCacheService,
    private readonly logger: StructuredLoggerService,
    private readonly dataSource: DataSource,
    private readonly crawler: CrawlerService,
  ) {
    this.logger.setContext(ProblemService.name);
  }

  /**
   * 문제 생성 — ADMIN 권한 필수 (컨트롤러에서 studyRole 체크)
   * studyId는 헤더에서 받아 컨트롤러가 전달
   */
  async create(dto: CreateProblemDto, studyId: string, createdBy: string): Promise<Problem> {
    // 같은 스터디 + 같은 주차에서 sourceUrl 중복 체크
    if (dto.sourceUrl) {
      const existing = await this.dualWrite.findOne({
        where: { studyId, weekNumber: dto.weekNumber, sourceUrl: dto.sourceUrl, status: ProblemStatus.ACTIVE },
      });
      if (existing) {
        throw new ConflictException('같은 주차에 이미 등록된 문제입니다.');
      }
    }

    const saved = await this.dualWrite.save({
      title: dto.title,
      description: dto.description ?? null,
      weekNumber: dto.weekNumber,
      difficulty: dto.difficulty ?? null,
      level: dto.level ?? null,
      sourceUrl: dto.sourceUrl ?? null,
      sourcePlatform: dto.sourcePlatform ?? null,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      allowedLanguages: dto.allowedLanguages ?? null,
      tags: dto.tags ?? null,
      status: ProblemStatus.ACTIVE,
      category: dto.category ?? ProblemCategory.ALGORITHM,
      studyId,
      createdBy,
    });
    this.logger.log(`문제 생성: id=${saved.id}, studyId=${studyId}, week=${saved.weekNumber}`);

    // 캐시 설정
    await this.deadlineCache.setDeadline(studyId, saved.id, saved.deadline);
    await this.deadlineCache.invalidateWeekProblems(studyId, saved.weekNumber);

    // description 미입력 + sourceUrl 있으면 비동기 크롤링으로 자동 보완 (응답 블로킹 없음)
    if (!saved.description && saved.sourceUrl && saved.sourcePlatform) {
      this.backfillDescriptionFromCrawl(saved.id, saved.sourceUrl, saved.sourcePlatform).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn('backfill 크롤링 비동기 실패 — 문제 생성에는 영향 없음', { problemId: saved.id, error: msg });
      });
    }

    return saved;
  }

  /**
   * 문제 등록 후 비동기 크롤링으로 description 자동 보완
   * 실패해도 문제 생성 결과에 영향 없음 (fire-and-forget)
   */
  private async backfillDescriptionFromCrawl(problemId: string, sourceUrl: string, sourcePlatform: string): Promise<void> {
    const info = await this.crawler.crawl(sourceUrl, sourcePlatform);
    if (!info?.description) return;

    const problem = await this.dualWrite.findOne({ where: { id: problemId } });
    if (!problem) return;

    problem.description = info.description;
    if (info.constraints) problem.constraints = info.constraints;
    if (info.examples) problem.examples = info.examples;
    await this.dualWrite.saveExisting(problem);
    this.logger.log(`크롤링 구조화 데이터 보완 완료: id=${problemId}, platform=${sourcePlatform}`);
  }

  /**
   * 문제 단건 조회 (외부 API용) — DELETED 상태 제외, studyId 스코핑
   */
  async findById(studyId: string, id: string): Promise<Problem> {
    const problem = await this.dualWrite.findOne({
      where: { id, studyId, status: Not(ProblemStatus.DELETED) },
    });
    if (!problem) {
      throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
    }
    return problem;
  }

  /**
   * 문제 단건 조회 (내부용) — DELETED 포함 전체 상태 조회, studyId 스코핑
   * Submission 연동, 마감 시간 조회 등 내부 서비스에서 사용
   *
   * 방어 로직: studyId 누락 시 BadRequest — TypeORM where 조건 무시 방지
   * @throws BadRequestException studyId가 falsy인 경우
   */
  async findByIdInternal(studyId: string, id: string): Promise<Problem> {
    if (!studyId) {
      throw new BadRequestException('studyId가 필요합니다 — cross-study 접근 차단');
    }
    const problem = await this.dualWrite.findOne({ where: { id, studyId } });
    if (!problem) {
      throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
    }
    return problem;
  }

  /**
   * 주차별 문제 목록 — studyId 스코핑
   */
  async findByWeekAndStudy(studyId: string, weekNumber: string): Promise<Problem[]> {
    // 캐시 확인
    const cached = await this.deadlineCache.getWeekProblems(studyId, weekNumber);
    if (cached) {
      return JSON.parse(cached) as Problem[];
    }

    const problems = await this.dualWrite.find({
      where: { weekNumber, studyId, status: ProblemStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });

    // 캐시 저장
    await this.deadlineCache.setWeekProblems(studyId, weekNumber, JSON.stringify(problems));
    return problems;
  }

  /**
   * 마감 시간 조회 (Submission Service 내부 HTTP 연동용)
   * studyId 컨텍스트 포함 — 캐시 우선 → DB fallback
   *
   * 방어 로직: studyId 누락 시 BadRequest — TypeORM where 조건 무시 방지
   * @throws BadRequestException studyId가 falsy인 경우
   */
  async getDeadline(
    studyId: string,
    problemId: string,
  ): Promise<{ deadline: string | null; weekNumber: string | null; status: string }> {
    if (!studyId) {
      throw new BadRequestException('studyId가 필요합니다 — cross-study 접근 차단');
    }
    // 캐시 우선 — weekNumber는 캐시에 없으므로 DB fallback 필요
    const cached = await this.deadlineCache.getDeadline(studyId, problemId);
    if (cached !== null) {
      // weekNumber 조회를 위해 DB에서 problem을 가져옴 (내부용 — DELETED 포함)
      const problem = await this.findByIdInternal(studyId, problemId);
      return {
        deadline: cached === 'null' ? null : cached,
        weekNumber: problem.weekNumber ?? null,
        status: 'cache_hit',
      };
    }

    // DB fallback — studyId 스코핑으로 cross-study 접근 차단 (내부용 — DELETED 포함)
    const problem = await this.findByIdInternal(studyId, problemId);
    await this.deadlineCache.setDeadline(studyId, problem.id, problem.deadline);

    return {
      deadline: problem.deadline ? problem.deadline.toISOString() : null,
      weekNumber: problem.weekNumber ?? null,
      status: 'db_hit',
    };
  }

  /**
   * 문제 수정 — studyId 스코핑
   * QueryRunner 트랜잭션 + FOR UPDATE 비관적 락으로 Lost Update 방지
   * 캐시 무효화는 트랜잭션 커밋 후 실행
   */
  async update(studyId: string, id: string, dto: UpdateProblemDto): Promise<Problem> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // FOR UPDATE 비관적 락으로 동시 수정 방지
      const problem = await qr.manager.findOne(Problem, {
        where: { id, studyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!problem) {
        throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
      }

      // M7: weekNumber 변경 감지용 — 변경 전 값 보존
      const oldWeekNumber = problem.weekNumber;

      if (dto.title !== undefined) problem.title = dto.title;
      if (dto.description !== undefined) problem.description = dto.description;
      if (dto.weekNumber !== undefined) problem.weekNumber = dto.weekNumber;
      if (dto.difficulty !== undefined) problem.difficulty = dto.difficulty;
      if (dto.level !== undefined) problem.level = dto.level;
      if (dto.sourceUrl !== undefined) problem.sourceUrl = dto.sourceUrl;
      if (dto.sourcePlatform !== undefined) problem.sourcePlatform = dto.sourcePlatform;
      if (dto.deadline !== undefined) problem.deadline = dto.deadline ? new Date(dto.deadline) : null;
      if (dto.allowedLanguages !== undefined) {
        problem.allowedLanguages = dto.allowedLanguages ?? null;
      }
      if (dto.tags !== undefined) {
        problem.tags = dto.tags ?? null;
      }
      if (dto.status !== undefined) {
        const newStatus = dto.status as ProblemStatus;
        const allowed = ALLOWED_STATUS_TRANSITIONS[problem.status];
        if (!allowed || !allowed.includes(newStatus)) {
          throw new BadRequestException(
            `상태 전이 불가: ${problem.status} → ${newStatus}`,
          );
        }
        problem.status = newStatus;
      }
      if (dto.category !== undefined) {
        problem.category = dto.category;
      }

      const saved = await qr.manager.save(Problem, problem);
      await qr.commitTransaction();

      // 캐시 무효화 — 트랜잭션 커밋 후 실행
      await this.deadlineCache.invalidateDeadline(studyId, saved.id);
      await this.deadlineCache.invalidateWeekProblems(studyId, saved.weekNumber);

      // M7: weekNumber 변경 시 구 주차 캐시도 무효화
      if (dto.weekNumber !== undefined && dto.weekNumber !== oldWeekNumber) {
        await this.deadlineCache.invalidateWeekProblems(studyId, oldWeekNumber);
      }

      // Dual Write — 트랜잭션 커밋 후 비동기 쓰기
      if (this.dualWrite.isActive) {
        void this.dualWrite.saveExisting(saved);
      }

      this.logger.log(`문제 수정: id=${saved.id}, studyId=${studyId}`);
      return saved;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * M6: 문제 삭제 (soft delete) — ADMIN 권한 필수
   * status를 DELETED로 변경. Submission 참조 무결성 유지.
   * QueryRunner 트랜잭션 + FOR UPDATE 비관적 락으로 동시 삭제/수정 충돌 방지
   */
  async delete(studyId: string, id: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // FOR UPDATE 비관적 락으로 동시 수정 방지
      const problem = await qr.manager.findOne(Problem, {
        where: { id, studyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!problem) {
        throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
      }

      const allowed = ALLOWED_STATUS_TRANSITIONS[problem.status];
      if (!allowed || !allowed.includes(ProblemStatus.DELETED)) {
        throw new BadRequestException(
          `상태 전이 불가: ${problem.status} → ${ProblemStatus.DELETED}`,
        );
      }

      problem.status = ProblemStatus.DELETED;
      await qr.manager.save(Problem, problem);
      await qr.commitTransaction();

      // 캐시 무효화 — 트랜잭션 커밋 후 실행
      await this.deadlineCache.invalidateDeadline(studyId, id);
      await this.deadlineCache.invalidateWeekProblems(studyId, problem.weekNumber);

      // Dual Write — 트랜잭션 커밋 후 비동기 쓰기
      if (this.dualWrite.isActive) {
        void this.dualWrite.saveExisting(problem);
      }

      this.logger.log(`문제 soft delete: id=${id}, studyId=${studyId}`);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * 활성 문제 목록 — studyId 스코핑
   */
  async findActiveByStudy(studyId: string): Promise<Problem[]> {
    const problems = await this.dualWrite.find({
      where: { status: ProblemStatus.ACTIVE, studyId },
      order: { weekNumber: 'DESC', createdAt: 'ASC' },
    });
    return problems;
  }

  /**
   * 전체 문제 목록 (ACTIVE + CLOSED) — studyId 스코핑
   */
  async findAllByStudy(studyId: string): Promise<Problem[]> {
    const problems = await this.dualWrite.find({
      where: { studyId, status: In([ProblemStatus.ACTIVE, ProblemStatus.CLOSED]) },
      order: { weekNumber: 'ASC', createdAt: 'ASC' },
    });
    return problems;
  }

  /**
   * 태그 기반 문제 필터 — studyId 스코핑 + ACTIVE+CLOSED 상태
   *
   * findAllByStudy와 동일한 status 집합(ACTIVE+CLOSED)을 반환해 태그 필터가
   * /all 엔드포인트를 대체해도 CLOSED 문제가 사라지지 않도록 정합성 유지.
   * 캐싱 안 함: 태그 조합 무한 → 키 폭발 위험 (findByWeekAndStudy 캐시만 유지)
   * readRepo 경유: DualWriteService.findByTagsContaining으로 위임 (switch-read 우회 금지)
   *
   * @throws BadRequestException studyId가 falsy인 경우 (cross-study 접근 차단)
   */
  async findByTags(
    studyId: string,
    tags: string[],
    mode: 'and' | 'or' = 'or',
  ): Promise<Problem[]> {
    if (!studyId) {
      throw new BadRequestException('studyId가 필요합니다 — cross-study 접근 차단');
    }
    return this.dualWrite.findByTagsContaining(studyId, tags, mode, [
      ProblemStatus.ACTIVE,
      ProblemStatus.CLOSED,
    ]);
  }

  /**
   * 추천 문제 조회 (P2 하이브리드) — cross-study 읽기 기반 tiered 폴백
   *
   * 추천 풀 = 플랫폼 전체에 이미 등록된 문제(현재 스터디 제외). 현재 스터디에 없고
   * 난이도/태그가 맞는 문제를 제안한다. 콜드스타트 대비 3단 폴백 + 정적 seed.
   *
   * Tier 1: cross-study 후보 중 난이도 일치 AND 태그가 스터디 태그와 1개 이상 겹침
   * Tier 2: 난이도만 일치 (태그 조건 제거) — Tier1 부족 시 append
   * Tier 3: 정적 seed — 여전히 부족하거나 신규 스터디(난이도 없음)일 때 append
   *
   * 난이도 선택(Sprint 256): `difficulty` 지정 시 스터디 추론을 무시하고 해당
   *   난이도만으로 후보/seed를 필터한다. 신규 스터디도 원하는 난이도 추천을 받는다.
   *   미지정 시 기존 계약(스터디 자체 문제에서 난이도 추론) 유지.
   *
   * 보안: RecommendationItem으로 외부 식별 메타만 투영(description 등 누출 금지).
   *
   * @throws BadRequestException studyId가 falsy인 경우 (cross-study 접근 차단)
   */
  async recommendForStudy(
    studyId: string,
    exclude: string[],
    limit: number,
    platform?: 'BOJ' | 'PROGRAMMERS',
    difficulty?: Difficulty,
  ): Promise<RecommendationItem[]> {
    if (!studyId) {
      throw new BadRequestException('studyId가 필요합니다 — cross-study 접근 차단');
    }

    // 1. 현재 스터디 문제(ACTIVE+CLOSED) 조회 → 소유 URL/난이도/태그 수집
    const ownedProblems = await this.dualWrite.find({
      where: { studyId, status: In([ProblemStatus.ACTIVE, ProblemStatus.CLOSED]) },
    });

    const ownedUrls = new Set<string>();
    const studyDifficulties = new Set<Difficulty>();
    const studyTags = new Set<string>();
    for (const p of ownedProblems) {
      if (p.sourceUrl) ownedUrls.add(p.sourceUrl);
      if (p.difficulty) studyDifficulties.add(p.difficulty);
      if (p.tags) {
        for (const tag of p.tags) studyTags.add(tag);
      }
    }

    // 2. 대상 난이도 결정 — 명시 선택 우선, 없으면 스터디 추론(하위 호환)
    const targetDifficulties = difficulty
      ? [difficulty]
      : Array.from(studyDifficulties);

    // 3. 제외 집합 = 소유 URL ∪ exclude 파라미터
    const excludeSet = new Set<string>(ownedUrls);
    for (const url of exclude) excludeSet.add(url);

    // cross-study 후보 조회 — 난이도+플랫폼 DB 필터, 태그 겹침은 JS 후처리
    const candidates = await this.dualWrite.findRecommendationCandidates(
      targetDifficulties,
      studyId,
      platform,
    );

    const picked = new Map<string, RecommendationItem>();

    // Problem 후보 → RecommendationItem 사전 투영 (sourceUrl 존재 보장)
    const candidateItems: RecommendationItem[] = candidates
      .filter((c): c is Problem & { sourceUrl: string } => c.sourceUrl != null)
      .map((c) => this.toRecommendationItem(c));

    // 4. Tier 1: 난이도 일치 AND 태그 1개 이상 겹침
    const tier1 = candidateItems.filter(
      (c) => !excludeSet.has(c.sourceUrl) && this.hasTagOverlap(c.tags, studyTags),
    );
    this.appendCandidates(this.shuffle(tier1), picked, limit);

    // 5. Tier 2: 난이도만 일치 (태그 조건 제거)
    if (picked.size < limit) {
      const tier2 = candidateItems.filter((c) => !excludeSet.has(c.sourceUrl));
      this.appendCandidates(this.shuffle(tier2), picked, limit);
    }

    // 6. Tier 3: 정적 seed — 부족하거나 신규 스터디(난이도 없음)
    //    플랫폼 지정 시 해당 플랫폼 seed만 사용(토글 종속). 미지정 시 전체.
    //    난이도 선택 시 해당 난이도 seed만 사용(Sprint 256).
    if (picked.size < limit) {
      const seedPool = RECOMMENDATION_SEEDS.filter(
        (s) =>
          (!platform || s.sourcePlatform === platform) &&
          (!difficulty || s.difficulty === difficulty),
      );
      const tier3 = seedPool.filter((s) => !excludeSet.has(s.sourceUrl));
      this.appendCandidates(this.shuffle([...tier3]), picked, limit);
    }

    // 7. limit 개로 slice
    const result = Array.from(picked.values()).slice(0, limit);
    this.logger.log('추천 문제 조회 완료', {
      studyId,
      returned: result.length,
      limit,
      ownedCount: ownedProblems.length,
      difficulty: difficulty ?? null,
    });
    return result;
  }

  /** 후보 태그가 스터디 태그와 1개 이상 겹치는지 검사 */
  private hasTagOverlap(tags: string[] | null, studyTags: Set<string>): boolean {
    if (!tags || tags.length === 0) return false;
    return tags.some((tag) => studyTags.has(tag));
  }

  /**
   * 후보를 sourceUrl 기준 dedup하여 picked 맵에 append (limit 도달 시 중단)
   * 이미 담긴 url은 건너뜀 — tier 간 중복 제거.
   */
  private appendCandidates(
    items: RecommendationItem[],
    picked: Map<string, RecommendationItem>,
    limit: number,
  ): void {
    for (const item of items) {
      if (picked.size >= limit) return;
      if (!picked.has(item.sourceUrl)) {
        picked.set(item.sourceUrl, item);
      }
    }
  }

  /** 외부 식별 메타만 투영 — 누출 방지(description/studyId 등 제외) */
  private toRecommendationItem(source: {
    title: string;
    sourceUrl: string;
    sourcePlatform: string | null;
    difficulty: Difficulty | null;
    level: number | null;
    tags: string[] | null;
    category: ProblemCategory;
  }): RecommendationItem {
    return {
      title: source.title,
      sourceUrl: source.sourceUrl,
      sourcePlatform: source.sourcePlatform ?? '',
      difficulty: source.difficulty ?? null,
      level: source.level ?? null,
      tags: source.tags ?? null,
      category: source.category,
    };
  }

  /** 다양성 확보용 간단 셔플 (Fisher-Yates, Math.random 허용) */
  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * 만료된 ACTIVE 문제를 CLOSED로 일괄 전환 — DeadlineSchedulerService에서 호출
   * 조건: status=ACTIVE AND deadline IS NOT NULL AND deadline <= NOW()
   * 캐시 무효화: 각 문제의 deadline + weekProblems 캐시 무효화
   * @returns 전환 건수 + 영향받은 문제 정보 (로깅/모니터링용)
   */
  async closeExpiredProblems(): Promise<{
    count: number;
    affected: Array<{ id: string; studyId: string; weekNumber: string }>;
  }> {
    const now = new Date();

    const expiredProblems = await this.dualWrite.find({
      where: {
        status: ProblemStatus.ACTIVE,
        deadline: LessThanOrEqual(now),
      },
    });

    if (expiredProblems.length === 0) {
      return { count: 0, affected: [] };
    }

    const affected: Array<{ id: string; studyId: string; weekNumber: string }> = [];

    for (const problem of expiredProblems) {
      problem.status = ProblemStatus.CLOSED;
      await this.dualWrite.saveExisting(problem);

      // 캐시 무효화 — deadline 캐시 + 주차별 목록 캐시
      await this.deadlineCache.invalidateDeadline(problem.studyId, problem.id);
      await this.deadlineCache.invalidateWeekProblems(problem.studyId, problem.weekNumber);

      affected.push({
        id: problem.id,
        studyId: problem.studyId,
        weekNumber: problem.weekNumber,
      });
    }

    this.logger.log(
      `만료 문제 일괄 종료 완료: ${affected.length}건`,
      { affected },
    );

    return { count: affected.length, affected };
  }
}
