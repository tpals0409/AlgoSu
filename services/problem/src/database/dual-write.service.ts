/**
 * @file Dual Write 서비스 — DB 이중 쓰기 + 마이그레이션 지원
 * @domain problem
 * @layer repository
 * @related problem.service.ts, dual-write.config.ts, reconciliation.service.ts
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOneOptions, FindManyOptions, DeepPartial, Brackets, In, Not, IsNull } from 'typeorm';
import { Problem, ProblemStatus, Difficulty } from '../problem/problem.entity';
import { DualWriteMode, getDualWriteMode, NEW_DB_CONNECTION } from './dual-write.config';
import { ReconciliationService } from './reconciliation.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { Counter, Histogram, Gauge, register } from 'prom-client';

// ---- Dual Write 메트릭 (H8) ----
const dualWriteTotal = new Counter({
  name: 'algosu_problem_dual_write_total',
  help: 'Dual write 총 시도 횟수',
  labelNames: ['operation', 'result'] as const,
  registers: [register],
});

const dualWriteLatency = new Histogram({
  name: 'algosu_problem_dual_write_latency_seconds',
  help: 'Dual write 신 DB 쓰기 레이턴시 (초)',
  labelNames: ['operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const reconciliationMismatches = new Gauge({
  name: 'algosu_problem_reconciliation_mismatches',
  help: '현재 Reconciliation 불일치 건수',
  registers: [register],
});

export const reconciliationRunsTotal = new Counter({
  name: 'algosu_problem_reconciliation_runs_total',
  help: 'Reconciliation 실행 총 횟수',
  labelNames: ['result'] as const,
  registers: [register],
});

/**
 * Dual Write Service — Phase 3 DB 물리 분리
 *
 * 구 DB(default)와 신 DB(new-problem-db) 양쪽에 쓰기를 수행하고,
 * 모드에 따라 읽기 소스를 전환한다.
 *
 * 보안: 신 DB 쓰기 실패는 로그만 기록, 구 DB 트랜잭션에 영향 없음
 */
@Injectable()
export class DualWriteService implements OnModuleInit {
  private mode: DualWriteMode = DualWriteMode.OFF;

  constructor(
    @InjectRepository(Problem)
    private readonly oldRepo: Repository<Problem>,
    @InjectRepository(Problem, NEW_DB_CONNECTION)
    private readonly newRepo: Repository<Problem>,
    private readonly reconciliation: ReconciliationService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(DualWriteService.name);
  }

  onModuleInit() {
    this.mode = getDualWriteMode();
    this.logger.log(`Dual Write 모드: ${this.mode}`);
  }

  get isActive(): boolean {
    return this.mode !== DualWriteMode.OFF;
  }

  /** 읽기 대상 Repository — H7: 불일치 시 구 DB fallback */
  private get readRepo(): Repository<Problem> {
    if (this.mode === DualWriteMode.SWITCH_READ) {
      if (this.reconciliation.hasMismatch) {
        this.logger.warn('전환 차단: Reconciliation 불일치 감지 — 구 DB로 fallback');
        return this.oldRepo;
      }
      return this.newRepo;
    }
    return this.oldRepo;
  }

  /** 조회 — 모드에 따라 소스 전환 */
  async findOne(options: FindOneOptions<Problem>): Promise<Problem | null> {
    return this.readRepo.findOne(options);
  }

  /** 목록 조회 — 모드에 따라 소스 전환 */
  async find(options: FindManyOptions<Problem>): Promise<Problem[]> {
    return this.readRepo.find(options);
  }

  /** 생성 — 양쪽 쓰기 */
  async save(entity: DeepPartial<Problem>): Promise<Problem> {
    const created = this.oldRepo.create(entity);
    const saved = await this.oldRepo.save(created);

    if (this.isActive) {
      this.writeToNewDb('save', saved);
    }

    return saved;
  }

  /** 엔티티 생성 (메모리에만, DB 저장 X) */
  create(entity: DeepPartial<Problem>): Problem {
    return this.oldRepo.create(entity);
  }

  /** 업데이트 — 양쪽 쓰기 */
  async saveExisting(entity: Problem): Promise<Problem> {
    const saved = await this.oldRepo.save(entity);

    if (this.isActive) {
      this.writeToNewDb('update', saved);
    }

    return saved;
  }

  /**
   * 태그 포함 검색 — jsonb @> containment 쿼리
   *
   * readRepo getter 경유 → switch-read 모드 전환 자동 적용(직접 dataSource QueryBuilder 금지)
   * AND: 모든 태그를 포함하는 문제 (단일 @> 조건, GIN 인덱스 최대 활용)
   * OR: 임의 태그를 하나 이상 포함하는 문제 (Brackets로 OR 조건 묶음)
   *
   * 정렬: weekNumber ASC, createdAt ASC — findAllByStudy(/all 엔드포인트)와 동일 정합성 유지.
   * 태그 토글 시 목록 재정렬 없이 /all 대체 가능.
   *
   * @param studyId  스터디 ID (스코핑)
   * @param tags     검색 태그 배열 (비어있지 않음)
   * @param mode     'and' | 'or' — 태그 일치 방식
   * @param statuses 대상 상태 목록 (예: [ProblemStatus.ACTIVE])
   */
  async findByTagsContaining(
    studyId: string,
    tags: string[],
    mode: 'and' | 'or',
    statuses: ProblemStatus[],
  ): Promise<Problem[]> {
    const qb = this.readRepo
      .createQueryBuilder('problem')
      .where('problem.studyId = :studyId', { studyId })
      .andWhere('problem.status IN (:...statuses)', { statuses });

    if (mode === 'and') {
      // AND: 단일 @> 조건 — GIN jsonb_path_ops 인덱스 활용
      qb.andWhere('problem.tags @> :tags::jsonb', { tags: JSON.stringify(tags) });
    } else {
      // OR: 각 태그별 단일 원소 배열 @> 조건을 Brackets로 묶음
      qb.andWhere(
        new Brackets((subQb) => {
          tags.forEach((tag, idx) => {
            const paramName = `tag${idx}`;
            const condition = `problem.tags @> :${paramName}::jsonb`;
            const params: Record<string, string> = { [paramName]: JSON.stringify([tag]) };
            if (idx === 0) {
              subQb.where(condition, params);
            } else {
              subQb.orWhere(condition, params);
            }
          });
        }),
      );
    }

    return qb
      .orderBy('problem.weekNumber', 'ASC')
      .addOrderBy('problem.createdAt', 'ASC')
      .getMany();
  }

  /**
   * 추천 후보 조회 (cross-study 읽기) — 보안 핵심
   *
   * 다른 스터디에 등록된 문제 중 난이도가 일치하는 ACTIVE 후보를 조회한다.
   * readRepo getter 경유 → switch-read 모드 전환 자동 적용(직접 dataSource 우회 금지).
   *
   * 보안: select로 외부 식별 메타만 투영 —
   *   title/sourceUrl/sourcePlatform/difficulty/level/tags/category만 로드.
   *   description/studyId/createdBy/id/publicId/deadline 등은 절대 로드 안 함(누출 방지).
   *
   * where 조건:
   *   status=ACTIVE, difficulty In(difficulties), studyId Not(excludeStudyId), sourceUrl IS NOT NULL
   * 상한: take ~200 — 전체 테이블 로드 방지. 태그 겹침 필터는 서비스 레이어(JS)에서 후처리.
   *
   * @param difficulties  대상 난이도 목록 (비어있으면 빈 배열 반환 — In([]) 전체매치 방지)
   * @param excludeStudyId 현재 스터디 ID (제외 대상 — cross-study 스코핑)
   * @returns 안전 컬럼만 채워진 Problem 부분 엔티티 배열
   */
  async findRecommendationCandidates(
    difficulties: Difficulty[],
    excludeStudyId: string,
    platform?: string,
  ): Promise<Problem[]> {
    // In([]) 은 TypeORM에서 항상-false가 아니라 문법 오류/전체 스캔 위험 → 빈 목록 방어
    if (difficulties.length === 0) {
      return [];
    }
    return this.readRepo.find({
      select: {
        title: true,
        sourceUrl: true,
        sourcePlatform: true,
        difficulty: true,
        level: true,
        tags: true,
        category: true,
      },
      where: {
        status: ProblemStatus.ACTIVE,
        difficulty: In(difficulties),
        studyId: Not(excludeStudyId),
        sourceUrl: Not(IsNull()),
        // 플랫폼 지정 시 해당 플랫폼(sourcePlatform) 후보만 — 토글 종속 추천.
        ...(platform ? { sourcePlatform: platform } : {}),
      },
      take: 200,
    });
  }

  /** 신 DB에 fire-and-forget 쓰기 — H8: 메트릭 계측 */
  private writeToNewDb(operation: string, entity: Problem): void {
    const end = dualWriteLatency.startTimer({ operation });
    this.newRepo.save(entity).then(
      () => {
        end();
        dualWriteTotal.inc({ operation, result: 'success' });
        this.logger.debug(`Dual Write ${operation} 성공: id=${entity.id}`);
      },
      (error) => {
        end();
        dualWriteTotal.inc({ operation, result: 'failure' });
        const rawMsg = error instanceof Error ? error.message : 'unknown';
        const safeError = rawMsg.replace(/(host|password|port|user)=\S+/gi, '$1=***').slice(0, 100);
        this.logger.error(`Dual Write ${operation} 실패: id=${entity.id}, error=${safeError}`);
      },
    );
  }
}
