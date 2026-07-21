/**
 * @file 추천 문제 하이브리드 조회 훅 — prefetch 묶음 + 클라 rotation
 * @domain problem
 * @layer hook
 * @related problemApi.getRecommendations, SearchStep, RecommendationItem
 *
 * 하이브리드 전략:
 *  - 최초 사용 시 후보 묶음(기본 8개)을 1회 prefetch.
 *  - `refresh()`는 묶음 내 다음 후보로 즉시 rotation (조회 0).
 *  - 묶음 소진 시 이미 노출한 sourceUrl을 `exclude`로 다음 묶음을 재조회.
 *  - 다음 묶음이 비어 있으면 `exhausted`, 있으면 index를 0으로 순환해
 *    빈 화면을 방지한다.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { problemApi, type RecommendationItem } from '@/lib/api';

/** 기본 prefetch 묶음 크기 */
const DEFAULT_LIMIT = 8;

/** 추천 조회 함수 시그니처 — 테스트에서 주입 가능하도록 분리 */
export type FetchRecommendations = (params: {
  limit: number;
  exclude: string[];
}) => Promise<RecommendationItem[]>;

/** {@link useProblemRecommendation} 옵션 */
export interface UseProblemRecommendationOptions {
  /** prefetch/재조회 묶음 크기 (기본: 8) */
  limit?: number;
  /**
   * 조회 함수 주입 지점. 미지정 시 {@link problemApi.getRecommendations} 사용.
   * 테스트에서 mock을 주입해 순수 로직을 검증한다.
   */
  fetcher?: FetchRecommendations;
}

/** {@link useProblemRecommendation} 반환 형태 */
export interface UseProblemRecommendationReturn {
  /** 현재 노출 중인 추천 (묶음이 비었으면 null) */
  current: RecommendationItem | null;
  /** 초기 로드/재조회 진행 여부 */
  loading: boolean;
  /** 조회 실패 여부 */
  error: boolean;
  /** 더 이상 추천할 후보가 없는 상태 */
  exhausted: boolean;
  /** 다음 후보로 회전 (묶음 소진 시 재조회) */
  refresh: () => void;
}

/** 기본 fetcher — 배럴 API를 옵션 형태로 감싼다 */
const defaultFetcher: FetchRecommendations = ({ limit, exclude }) =>
  problemApi.getRecommendations({ limit, exclude });

/**
 * 추천 문제 하이브리드 조회 훅.
 *
 * @param options.limit 묶음 크기 (기본 8)
 * @param options.fetcher 조회 함수 주입 (테스트용)
 */
export function useProblemRecommendation(
  options: UseProblemRecommendationOptions = {},
): UseProblemRecommendationReturn {
  const { limit = DEFAULT_LIMIT, fetcher = defaultFetcher } = options;

  const [bundle, setBundle] = useState<RecommendationItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  // 노출된 sourceUrl 누적 — exclude 파라미터의 출처.
  const shownUrls = useRef<Set<string>>(new Set());
  // 최신 값을 콜백 내부에서 참조하기 위한 ref (stale closure 방지).
  const bundleRef = useRef<RecommendationItem[]>([]);
  const indexRef = useRef(0);
  const loadingRef = useRef(false);
  // StrictMode 이중 마운트에서 prefetch가 두 번 발사되지 않도록 가드.
  const didInit = useRef(false);

  bundleRef.current = bundle;
  indexRef.current = index;

  /** 후보 하나가 노출됐음을 shownUrls에 기록 */
  const markShown = useCallback((item: RecommendationItem | undefined) => {
    if (item) shownUrls.current.add(item.sourceUrl);
  }, []);

  /** 다음 묶음을 조회하고 상태를 갱신 */
  const fetchNextBundle = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const items = await fetcher({
        limit,
        exclude: [...shownUrls.current],
      });
      if (items.length === 0) {
        // 새 후보 없음 — 현재 묶음이 있으면 순환, 없으면 소진.
        if (bundleRef.current.length > 0) {
          setIndex(0);
          markShown(bundleRef.current[0]);
        } else {
          setExhausted(true);
        }
        return;
      }
      setBundle(items);
      setIndex(0);
      setExhausted(false);
      items.forEach((it) => shownUrls.current.add(it.sourceUrl));
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetcher, limit, markShown]);

  // 최초 마운트 시 1회 prefetch.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void fetchNextBundle();
  }, [fetchNextBundle]);

  /**
   * 다음 후보로 회전.
   *  - 묶음 내 다음 index가 있으면 즉시 이동 (조회 0).
   *  - 없으면 exclude=[...shownUrls]로 다음 묶음을 재조회.
   */
  const refresh = useCallback(() => {
    const next = indexRef.current + 1;
    if (next < bundleRef.current.length) {
      setIndex(next);
      markShown(bundleRef.current[next]);
      return;
    }
    void fetchNextBundle();
  }, [fetchNextBundle, markShown]);

  const current = bundle[index] ?? null;

  return { current, loading, error, exhausted, refresh };
}
