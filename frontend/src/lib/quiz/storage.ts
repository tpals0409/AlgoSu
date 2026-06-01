/**
 * @file CS 퀴즈 플레이 기록 저장소 (인터페이스 + localStorage 구현)
 * @domain quiz
 * @layer lib
 * @related src/data/quiz/types.ts, src/lib/quiz/grade.ts
 *
 * Sprint 217 서버 동기화 대비: 저장소를 인터페이스로 추상화해
 * localStorage 구현을 원격 API 구현으로 교체 가능한 구조로 둔다.
 */

/** localStorage에 기록을 저장하는 키. */
const STORAGE_KEY = 'algosu.quiz.records';

/** 한 판의 퀴즈 플레이 결과. */
export interface QuizPlayResult {
  /** 플레이한 분야 (QuizCategory 문자열) */
  readonly category: string;
  /** 총 문항 수 */
  readonly total: number;
  /** 맞힌 문항 수 */
  readonly correct: number;
  /** 정답률 (0~100) */
  readonly scorePercent: number;
  /** 플레이 종료 시각 (ISO 8601 문자열) */
  readonly playedAt: string;
}

/** 분야별 최고 기록. */
export interface QuizBestRecord {
  /** 최고 정답률 (0~100) */
  readonly scorePercent: number;
  /** 최고 기록 달성 시각 (ISO 8601 문자열) */
  readonly playedAt: string;
}

/** 퀴즈 기록 저장소 추상 인터페이스. */
export interface QuizRecordStore {
  /** 분야별 최고 기록 조회 (없으면 null) */
  getBest(category: string): QuizBestRecord | null;
  /** 플레이 결과 저장 (기존 최고치보다 높을 때만 갱신) */
  saveResult(result: QuizPlayResult): void;
  /** 전 분야 최고 기록 맵 조회 */
  getAllBest(): Record<string, QuizBestRecord>;
}

/** 저장소 내부 표현 — 분야 키 → 최고 기록. */
type RecordMap = Record<string, QuizBestRecord>;

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
    // best-effort 영속화 — setItem throw 시 조용히 무시
  }
}

/**
 * localStorage 기반 퀴즈 기록 저장소를 생성한다.
 * SSR 환경에서는 모든 동작이 안전한 no-op/빈 반환으로 처리된다.
 *
 * @returns QuizRecordStore 구현체
 */
export function createLocalStorageQuizStore(): QuizRecordStore {
  return {
    getBest(category) {
      return readMap()[category] ?? null;
    },
    saveResult(result) {
      const map = readMap();
      const prev = map[result.category];
      if (prev && prev.scorePercent >= result.scorePercent) {
        return;
      }
      map[result.category] = {
        scorePercent: result.scorePercent,
        playedAt: result.playedAt,
      };
      writeMap(map);
    },
    getAllBest() {
      return readMap();
    },
  };
}
