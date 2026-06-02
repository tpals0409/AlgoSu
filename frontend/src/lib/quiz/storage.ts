/**
 * @file CS 퀴즈 플레이 기록 저장소 (인터페이스 + localStorage 구현)
 * @domain quiz
 * @layer lib
 * @related src/data/quiz/types.ts, src/lib/quiz/grade.ts, src/lib/quiz/api-store.ts
 *
 * Sprint 217: QuizRecordStore 인터페이스를 async(Promise)로 전환해
 * localStorage 구현을 API 구현으로 무중단 교체 가능한 구조로 완성했다.
 * best 키는 (category, difficulty) 복합 키로 확장됐으며
 * localStorage 스키마 변경으로 키를 'algosu.quiz.records.v2'로 갱신한다.
 * (구 'algosu.quiz.records' 스키마와 비호환 — 구 데이터 best-effort 폐기)
 */

import type { QuizDifficulty } from '@/data/quiz/types';

/** localStorage에 기록을 저장하는 키 (v2: 난이도 차원 추가로 구 스키마 비호환). */
const STORAGE_KEY = 'algosu.quiz.records.v2';

/** 한 판의 퀴즈 플레이 결과. */
export interface QuizPlayResult {
  /** 플레이한 분야 (QuizCategory 문자열) */
  readonly category: string;
  /** 플레이한 난이도 */
  readonly difficulty: QuizDifficulty | 'ALL';
  /** 총 문항 수 */
  readonly total: number;
  /** 맞힌 문항 수 */
  readonly correct: number;
  /** 정답률 (0~100) */
  readonly scorePercent: number;
  /** 플레이 종료 시각 (ISO 8601 문자열) */
  readonly playedAt: string;
}

/** (분야, 난이도) 단위 최고 기록. */
export interface QuizBestRecord {
  /** 최고 정답률 (0~100) */
  readonly scorePercent: number;
  /** 최고 기록 달성 시각 (ISO 8601 문자열) */
  readonly playedAt: string;
}

/**
 * 퀴즈 기록 저장소 추상 인터페이스 (async).
 * localStorage 구현과 API 구현 양쪽에서 동일 인터페이스를 구현한다.
 */
export interface QuizRecordStore {
  /**
   * (분야, 난이도) 복합 키로 최고 기록을 조회한다 (없으면 null).
   * @param category QuizCategory 문자열
   * @param difficulty QuizDifficulty | 'ALL'
   */
  getBest(category: string, difficulty: string): Promise<QuizBestRecord | null>;
  /** 플레이 결과를 저장한다 (기존 최고치보다 높을 때만 갱신). */
  saveResult(result: QuizPlayResult): Promise<void>;
  /**
   * 전 (분야, 난이도) 조합의 최고 기록 맵을 반환한다.
   * 키 형식: `${category}::${difficulty}`
   */
  getAllBest(): Promise<Record<string, QuizBestRecord>>;
}

/** 저장소 내부 표현 — `${category}::${difficulty}` 복합 키 → 최고 기록. */
type RecordMap = Record<string, QuizBestRecord>;

/**
 * (분야, 난이도) 복합 키를 생성한다.
 *
 * @param category QuizCategory 문자열
 * @param difficulty QuizDifficulty | 'ALL'
 * @returns `${category}::${difficulty}` 형식의 복합 키
 */
function toCompositeKey(category: string, difficulty: string): string {
  return `${category}::${difficulty}`;
}

/**
 * localStorage에서 기록 맵을 읽어온다.
 * SSR(window 부재) 또는 JSON 파손 시 빈 맵으로 폴백한다.
 */
function readMap(): RecordMap {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecordMap) : {};
  } catch {
    return {};
  }
}

/**
 * 기록 맵을 localStorage에 직렬화해 저장한다 (SSR 시 no-op).
 *
 * setItem은 Safari 프라이빗 모드·스토리지 비활성·쿼터 초과(QuotaExceededError)
 * 시 throw할 수 있다. 영속화는 결과 표시에 부수적(best-effort)이므로
 * 실패해도 조용히 무시한다 (readMap 폴백 패턴과 일관).
 */
function writeMap(map: RecordMap): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort 영속화 — setItem throw 시 조용히 무시 (Sprint 215 P2 교훈)
  }
}

/**
 * localStorage 기반 퀴즈 기록 저장소를 생성한다.
 * SSR 환경에서는 모든 동작이 안전한 no-op/빈 반환으로 처리된다.
 * 인터페이스는 async(Promise)이며, localStorage 연산은 즉시 resolve된다.
 *
 * @returns QuizRecordStore 구현체
 */
export function createLocalStorageQuizStore(): QuizRecordStore {
  return {
    getBest(category, difficulty) {
      const key = toCompositeKey(category, difficulty);
      return Promise.resolve(readMap()[key] ?? null);
    },

    saveResult(result) {
      const map = readMap();
      const key = toCompositeKey(result.category, result.difficulty);
      const prev = map[key];
      if (prev && prev.scorePercent >= result.scorePercent) {
        return Promise.resolve();
      }
      map[key] = {
        scorePercent: result.scorePercent,
        playedAt: result.playedAt,
      };
      writeMap(map);
      return Promise.resolve();
    },

    getAllBest() {
      return Promise.resolve(readMap());
    },
  };
}
