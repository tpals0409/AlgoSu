/**
 * @file CS 퀴즈 기록 API 저장소 — 로그인 사용자 서버 연동 구현
 * @domain quiz
 * @layer lib
 * @related src/lib/quiz/storage.ts, src/lib/api/client.ts, src/lib/quiz/grade.ts
 *
 * Sprint 217: 로그인 사용자의 퀴즈 최고 기록을 Gateway BFF를 통해
 * Identity 서비스 DB에 영속화한다.
 * GET /api/quiz-records 응답(snake_case)을 camelCase QuizBestRecord로 변환 후
 * 메모리 캐시에 보관한다. saveResult 후 캐시를 무효화해 다음 조회 시 재취득한다.
 * 네트워크 실패는 best-effort로 처리해 결과 화면 표시를 차단하지 않는다 (Sprint 215 P2 교훈 계승).
 */

import { fetchApi } from '@/lib/api/client';
import type { QuizBestRecord, QuizRecordStore } from './storage';

/**
 * Gateway에서 반환되는 raw QuizRecord (snake_case).
 * BFF는 {data} 래핑 없이 raw 반환하므로 fetchApi가 배열을 직접 반환한다.
 */
interface RawQuizRecord {
  readonly id: string;
  readonly user_id: string;
  readonly category: string;
  readonly difficulty: string;
  readonly best_score_percent: number;
  readonly played_at: string;
  readonly created_at: string;
  readonly updated_at: string;
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
 * raw QuizRecord(snake_case)를 QuizBestRecord(camelCase)로 변환한다.
 * best_score_percent → scorePercent, played_at → playedAt.
 */
function rawToRecord(raw: RawQuizRecord): QuizBestRecord {
  return {
    scorePercent: raw.best_score_percent,
    playedAt: raw.played_at,
  };
}

/**
 * API 기반 퀴즈 기록 저장소를 생성한다 (로그인 사용자 전용).
 * GET /api/quiz-records 응답을 메모리에 캐시해 중복 요청을 줄인다.
 * 네트워크 실패 시 best-effort(빈 맵/무시)로 처리한다.
 *
 * @returns QuizRecordStore 구현체
 */
export function createApiQuizStore(): QuizRecordStore {
  /** GET 결과 메모리 캐시 — null이면 미취득, {}는 빈 기록 또는 실패 폴백. */
  let cache: RecordMap | null = null;

  /**
   * 서버에서 전체 best 기록을 취득해 캐시에 저장한다.
   * 이미 캐시가 있으면 즉시 반환한다.
   * 네트워크 실패 시 빈 맵을 캐시에 저장하고 반환한다 (best-effort).
   */
  async function fetchAllBest(): Promise<RecordMap> {
    if (cache !== null) return cache;
    try {
      const records = await fetchApi<RawQuizRecord[]>('/api/quiz-records');
      const map: RecordMap = {};
      for (const raw of records) {
        map[toCompositeKey(raw.category, raw.difficulty)] = rawToRecord(raw);
      }
      cache = map;
    } catch {
      // 네트워크 실패 시 빈 맵으로 폴백 (best-effort)
      cache = {};
    }
    return cache;
  }

  return {
    async getBest(category, difficulty) {
      const map = await fetchAllBest();
      return map[toCompositeKey(category, difficulty)] ?? null;
    },

    async saveResult(result) {
      try {
        await fetchApi<unknown>('/api/quiz-records', {
          method: 'POST',
          body: JSON.stringify({
            category: result.category,
            difficulty: result.difficulty,
            scorePercent: result.scorePercent,
            playedAt: result.playedAt,
          }),
        });
        // 캐시 무효화 — 다음 getAllBest/getBest에서 서버 최신 값 재취득
        cache = null;
      } catch {
        // best-effort — 네트워크 실패 시 결과 화면 표시를 막지 않음
      }
    },

    async getAllBest() {
      return fetchAllBest();
    },
  };
}
