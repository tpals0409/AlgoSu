/**
 * @file programmers.service.ts — 프로그래머스 문제 정보 서비스 (메모리 캐시)
 * @domain problem
 * @layer service
 * @related programmers.controller.ts, external.module.ts
 *
 * 번들된 JSON 스냅샷(data/programmers-problems.json)을 기동 시 로드하여
 * Map<problemId, ProgrammersProblemInfo> 형태로 캐싱한다.
 * 실시간 API 대신 사전 큐레이션 전략을 택해 외부 의존성 없이 검색/조회가 가능하다.
 * (ADR: docs/adr/sprint-95-programmers-dataset.md 참조)
 */
import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/** JSON 스냅샷 한 줄 항목의 원시 타입 */
interface ProgrammersRawItem {
  problemId: number;
  title: string;
  level: number;
  tags: string[];
  sourceUrl: string;
}

export type ProgrammersDifficulty =
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND'
  | null;

export interface ProgrammersProblemInfo {
  problemId: number;
  title: string;
  /** 프로그래머스 레벨 1~5 */
  level: number;
  /** 5단계 컬러 토큰 재활용 (Lv.1=BRONZE … Lv.5=DIAMOND) */
  difficulty: ProgrammersDifficulty;
  tags: string[];
  sourceUrl: string;
}

export interface ProgrammersSearchItem {
  problemId: number;
  title: string;
  level: number;
  difficulty: ProgrammersDifficulty;
  sourceUrl: string;
  tags: string[];
}

export interface ProgrammersSearchResult {
  count: number;
  items: ProgrammersSearchItem[];
}

/** 페이지당 검색 결과 크기 */
const PAGE_SIZE = 10;

/**
 * 프로그래머스 레벨(1~5)을 AlgoSu 난이도 토큰으로 변환.
 * 레벨 0 또는 미정 → null
 */
function levelToDifficulty(level: number): ProgrammersDifficulty {
  const map: Record<number, ProgrammersDifficulty> = {
    1: 'BRONZE',
    2: 'SILVER',
    3: 'GOLD',
    4: 'PLATINUM',
    5: 'DIAMOND',
  };
  return map[level] ?? null;
}

/**
 * 쿼리 문자열이 문제 제목 또는 태그에 포함되는지 검사 (대소문자 무시).
 */
function matchesQuery(item: ProgrammersProblemInfo, query: string): boolean {
  const lower = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(lower) ||
    item.tags.some((t) => t.toLowerCase().includes(lower))
  );
}

@Injectable()
export class ProgrammersService implements OnApplicationBootstrap {
  /** problemId → ProgrammersProblemInfo 메모리 캐시 */
  private readonly cache = new Map<number, ProgrammersProblemInfo>();

  constructor(private readonly logger: StructuredLoggerService) {
    this.logger.setContext(ProgrammersService.name);
  }

  /**
   * 애플리케이션 부트스트랩 시점에 JSON 스냅샷을 로드한다.
   * 파일 누락/파싱 실패 시 경고 로그만 남기고 빈 캐시로 기동을 허용한다.
   * (운영 환경에서 JSON이 반드시 존재해야 하므로 실제 배포 전 CI에서 검증)
   */
  onApplicationBootstrap(): void {
    const jsonPath = join(__dirname, '..', '..', 'data', 'programmers-problems.json');
    this.loadFromFile(jsonPath);
  }

  /**
   * JSON 파일 경로를 받아 캐시를 초기화한다.
   * 테스트에서 직접 호출하여 fixture JSON 을 주입할 수 있다.
   */
  loadFromFile(filePath: string): void {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const items = JSON.parse(raw) as ProgrammersRawItem[];
      this.cache.clear();
      for (const item of items) {
        this.cache.set(item.problemId, {
          problemId: item.problemId,
          title: item.title,
          level: item.level,
          difficulty: levelToDifficulty(item.level),
          tags: item.tags,
          sourceUrl: item.sourceUrl,
        });
      }
      this.logger.log(
        `프로그래머스 문제 캐시 로드 완료: ${this.cache.size}건`,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `프로그래머스 JSON 로드 실패 (빈 캐시로 기동): ${String(err)}`,
      );
    }
  }

  /**
   * 문제 ID로 단건 조회.
   * @throws NotFoundException — 캐시에 없는 ID
   */
  fetchProblem(problemId: number): ProgrammersProblemInfo {
    const info = this.cache.get(problemId);
    if (!info) {
      throw new NotFoundException(
        `프로그래머스 ${problemId}번 문제를 찾을 수 없습니다.`,
      );
    }
    return info;
  }

  /**
   * 제목/태그 키워드 검색 + 페이지네이션.
   * @param query  검색어 (1~100자, 트림 후 전달)
   * @param page   페이지 번호 (1-based, 기본 1)
   */
  searchProblem(query: string, page = 1): ProgrammersSearchResult {
    const all = Array.from(this.cache.values()).filter((item) =>
      matchesQuery(item, query),
    );

    const offset = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(offset, offset + PAGE_SIZE);

    return {
      count: all.length,
      items: pageItems.map((item) => ({
        problemId: item.problemId,
        title: item.title,
        level: item.level,
        difficulty: item.difficulty,
        sourceUrl: item.sourceUrl,
        tags: item.tags,
      })),
    };
  }
}
