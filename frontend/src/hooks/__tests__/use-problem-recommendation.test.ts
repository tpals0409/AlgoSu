/**
 * @file useProblemRecommendation 단위 테스트 — prefetch, rotation, 재조회, 순환, exclude 누적
 * @domain problem
 * @layer test
 * @related use-problem-recommendation, problemApi.getRecommendations
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProblemRecommendation } from '../use-problem-recommendation';
import type { RecommendationItem } from '@/lib/api';

/** 최소 유효 추천 항목 팩토리 */
function makeItem(n: number): RecommendationItem {
  return {
    title: `Problem ${n}`,
    sourceUrl: `https://www.acmicpc.net/problem/${n}`,
    sourcePlatform: 'BOJ',
    difficulty: 'GOLD',
    level: 13,
    tags: [`tag${n}`],
    category: 'ALGORITHM',
  };
}

describe('useProblemRecommendation — prefetch', () => {
  it('최초 마운트 시 fetcher를 1회 호출하고 current를 첫 후보로 노출한다', async () => {
    const bundle = [makeItem(1), makeItem(2)];
    const fetcher = jest.fn().mockResolvedValue(bundle);

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));

    await waitFor(() => expect(result.current.current).not.toBeNull());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({ limit: 8, exclude: [] });
    expect(result.current.current).toEqual(bundle[0]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(result.current.exhausted).toBe(false);
  });

  it('limit 옵션을 fetcher로 전달한다', async () => {
    const fetcher = jest.fn().mockResolvedValue([makeItem(1)]);
    renderHook(() => useProblemRecommendation({ limit: 3, fetcher }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher).toHaveBeenCalledWith({ limit: 3, exclude: [] });
  });
});

describe('useProblemRecommendation — rotation (index++)', () => {
  it('refresh는 묶음 내 다음 후보로 즉시 이동하고 재조회하지 않는다', async () => {
    const bundle = [makeItem(1), makeItem(2), makeItem(3)];
    const fetcher = jest.fn().mockResolvedValue(bundle);

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));
    await waitFor(() => expect(result.current.current).toEqual(bundle[0]));

    act(() => result.current.refresh());
    expect(result.current.current).toEqual(bundle[1]);

    act(() => result.current.refresh());
    expect(result.current.current).toEqual(bundle[2]);

    // 조회는 여전히 prefetch 1회뿐.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('useProblemRecommendation — 묶음 소진 후 재조회', () => {
  it('마지막 후보에서 refresh 시 exclude=[노출 URL들]로 다음 묶음을 조회한다', async () => {
    const first = [makeItem(1), makeItem(2)];
    const second = [makeItem(3), makeItem(4)];
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));
    await waitFor(() => expect(result.current.current).toEqual(first[0]));

    act(() => result.current.refresh()); // index 1 (마지막)
    expect(result.current.current).toEqual(first[1]);

    // 묶음 소진 → 재조회
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.current).toEqual(second[0]));

    expect(fetcher).toHaveBeenCalledTimes(2);
    // 두 번째 호출의 exclude에 첫 묶음의 두 URL이 모두 누적돼 있어야 한다.
    const secondCallExclude = fetcher.mock.calls[1][0].exclude as string[];
    expect(secondCallExclude).toEqual(
      expect.arrayContaining([first[0].sourceUrl, first[1].sourceUrl]),
    );
  });
});

describe('useProblemRecommendation — 빈 결과 순환/소진', () => {
  it('다음 묶음이 비었지만 현재 묶음이 있으면 index 0으로 순환한다 (빈 화면 방지)', async () => {
    const first = [makeItem(1), makeItem(2)];
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([]); // 다음 묶음 없음

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));
    await waitFor(() => expect(result.current.current).toEqual(first[0]));

    act(() => result.current.refresh()); // index 1 (마지막)

    await act(async () => {
      result.current.refresh(); // 재조회 → 빈 결과 → 순환
    });

    await waitFor(() => expect(result.current.current).toEqual(first[0]));
    expect(result.current.exhausted).toBe(false);
  });

  it('최초 조회가 빈 배열이면 exhausted=true, current=null', async () => {
    const fetcher = jest.fn().mockResolvedValue([]);

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));

    await waitFor(() => expect(result.current.exhausted).toBe(true));
    expect(result.current.current).toBeNull();
  });
});

describe('useProblemRecommendation — 에러 처리', () => {
  it('fetcher가 reject하면 error=true, current=null', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.current).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

describe('useProblemRecommendation — shownUrls exclude 누적', () => {
  it('rotation으로 노출된 후보의 URL도 다음 재조회 exclude에 포함된다', async () => {
    const first = [makeItem(1), makeItem(2), makeItem(3)];
    const second = [makeItem(4)];
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));
    await waitFor(() => expect(result.current.current).toEqual(first[0]));

    act(() => result.current.refresh()); // -> item2
    act(() => result.current.refresh()); // -> item3 (마지막)

    await act(async () => {
      result.current.refresh(); // 재조회
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    const exclude = fetcher.mock.calls[1][0].exclude as string[];
    // 첫 묶음 세 URL 모두 누적 (prefetch 시점에 전부 shownUrls로 등록됨).
    expect(exclude).toEqual(
      expect.arrayContaining([
        first[0].sourceUrl,
        first[1].sourceUrl,
        first[2].sourceUrl,
      ]),
    );
  });
});
