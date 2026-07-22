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

/**
 * exclude 파라미터 최대 길이.
 *
 * 백엔드 계약: `services/problem/src/problem/dto/recommend-query.dto.ts`의
 * `RecommendQueryDto.exclude`에 `@ArrayMaxSize(100)` 제약이 있어, 이를 초과하면
 * 추천 조회가 400(ValidationError)으로 실패한다. 새로고침(rotation)을 반복하면
 * `shownUrls`가 무한정 커지므로, FE에서 전송 직전 최근 항목만 캡핑해
 * 상한을 넘지 않도록 보장한다.
 *
 * 상한 도달 시 삽입 순서가 가장 오래된(먼저 노출한) URL부터 버린다.
 * Set은 삽입 순서를 보존하므로 `slice(-MAX_EXCLUDE)`가 곧 "최근 N개 유지" 전략이다.
 */
const MAX_EXCLUDE = 100;

/** 추천 대상 플랫폼 — 문제 추가 모달의 토글과 1:1 대응 */
export type RecommendationPlatform = 'BOJ' | 'PROGRAMMERS';

/** 추천 조회 함수 시그니처 — 테스트에서 주입 가능하도록 분리 */
export type FetchRecommendations = (params: {
  limit: number;
  exclude: string[];
  platform?: RecommendationPlatform;
}) => Promise<RecommendationItem[]>;

/** {@link useProblemRecommendation} 옵션 */
export interface UseProblemRecommendationOptions {
  /** prefetch/재조회 묶음 크기 (기본: 8) */
  limit?: number;
  /**
   * 추천 대상 플랫폼. 지정 시 해당 플랫폼 문제만 추천하며,
   * 값이 바뀌면(토글 전환) 묶음을 리셋하고 재조회한다.
   */
  platform?: RecommendationPlatform;
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
const defaultFetcher: FetchRecommendations = ({ limit, exclude, platform }) =>
  problemApi.getRecommendations({ limit, exclude, platform });

/**
 * 추천 문제 하이브리드 조회 훅.
 *
 * @param options.limit 묶음 크기 (기본 8)
 * @param options.fetcher 조회 함수 주입 (테스트용)
 */
export function useProblemRecommendation(
  options: UseProblemRecommendationOptions = {},
): UseProblemRecommendationReturn {
  const { limit = DEFAULT_LIMIT, platform, fetcher = defaultFetcher } = options;

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
  // StrictMode 이중 마운트 가드 겸 "마지막으로 조회한 플랫폼" 마커.
  // false = 아직 미조회, 그 외 = 마지막 조회 플랫폼(undefined 포함).
  const didInit = useRef<RecommendationPlatform | undefined | false>(false);

  bundleRef.current = bundle;
  indexRef.current = index;

  /**
   * shownUrls에 URL을 기록하되 상한(MAX_EXCLUDE)을 넘으면
   * 가장 오래 전에 노출한 URL부터 제거해 Set이 무한정 커지지 않게 한다.
   * (Set은 삽입 순서를 보존하므로 첫 항목이 가장 오래된 것)
   */
  const rememberUrl = useCallback((url: string) => {
    const set = shownUrls.current;
    // 이미 존재하면 재삽입해 "최근" 위치로 갱신 (여전히 제외 대상으로 유지).
    set.delete(url);
    set.add(url);
    while (set.size > MAX_EXCLUDE) {
      const oldest = set.values().next().value;
      if (oldest === undefined) break;
      set.delete(oldest);
    }
  }, []);

  /** 후보 하나가 노출됐음을 shownUrls에 기록 */
  const markShown = useCallback(
    (item: RecommendationItem | undefined) => {
      if (item) rememberUrl(item.sourceUrl);
    },
    [rememberUrl],
  );

  /** 다음 묶음을 조회하고 상태를 갱신 */
  const fetchNextBundle = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const items = await fetcher({
        limit,
        // 백엔드 @ArrayMaxSize(100) 상한 준수: 최근 MAX_EXCLUDE개만 전송.
        // Set 삽입 순서상 뒤쪽이 최근이므로 slice(-MAX_EXCLUDE)로 캡핑.
        exclude: [...shownUrls.current].slice(-MAX_EXCLUDE),
        // 값이 있을 때만 포함 — 미지정 시 기존 계약(전체 플랫폼) 유지.
        ...(platform ? { platform } : {}),
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
      items.forEach((it) => rememberUrl(it.sourceUrl));
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetcher, limit, platform, markShown, rememberUrl]);

  // 최초 마운트 + 플랫폼 전환 시 묶음을 리셋하고 재조회.
  // (토글 종속 추천: 플랫폼이 바뀌면 이전 플랫폼의 노출 이력/묶음을 버린다.)
  useEffect(() => {
    // StrictMode 이중 마운트에서 최초 prefetch가 두 번 발사되지 않도록 가드하되,
    // 플랫폼이 실제로 바뀌면 항상 재조회한다.
    if (didInit.current === platform) return;
    didInit.current = platform;

    shownUrls.current = new Set();
    bundleRef.current = [];
    indexRef.current = 0;
    setBundle([]);
    setIndex(0);
    setExhausted(false);
    void fetchNextBundle();
  }, [platform, fetchNextBundle]);

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
