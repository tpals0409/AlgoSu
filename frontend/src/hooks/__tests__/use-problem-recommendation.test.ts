/**
 * @file useProblemRecommendation 단위 테스트 — prefetch, rotation, 재조회, 순환, exclude 누적
 * @domain problem
 * @layer test
 * @related use-problem-recommendation, problemApi.getRecommendations
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useProblemRecommendation,
  type FetchRecommendations,
} from '../use-problem-recommendation';
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

  it('platform 미지정 시 fetcher params에 platform 키가 없다 (하위 호환)', async () => {
    const fetcher = jest.fn().mockResolvedValue([makeItem(1)]);
    renderHook(() => useProblemRecommendation({ fetcher }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][0]).not.toHaveProperty('platform');
  });

  it('platform 지정 시 fetcher로 platform을 전달한다 (토글 종속)', async () => {
    const fetcher = jest.fn().mockResolvedValue([makeItem(1)]);
    renderHook(() => useProblemRecommendation({ platform: 'BOJ', fetcher }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher).toHaveBeenCalledWith({ limit: 8, exclude: [], platform: 'BOJ' });
  });
});

describe('useProblemRecommendation — 플랫폼 전환 재조회', () => {
  it('platform이 바뀌면 묶음을 리셋하고 새 플랫폼으로 재조회한다', async () => {
    const boj = [makeItem(1), makeItem(2)];
    const prog: RecommendationItem = {
      title: 'Prog 1',
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/100',
      sourcePlatform: 'PROGRAMMERS',
      difficulty: 'BRONZE',
      level: 1,
      tags: ['해시'],
      category: 'ALGORITHM',
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(boj)
      .mockResolvedValueOnce([prog]);

    const { result, rerender } = renderHook(
      ({ platform }) => useProblemRecommendation({ platform, fetcher }),
      { initialProps: { platform: 'BOJ' as 'BOJ' | 'PROGRAMMERS' } },
    );
    await waitFor(() => expect(result.current.current).toEqual(boj[0]));

    // 플랫폼 전환 → 재조회 발사
    rerender({ platform: 'PROGRAMMERS' });
    await waitFor(() => expect(result.current.current).toEqual(prog));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith({
      limit: 8,
      // 전환 시 이전 플랫폼 노출 이력(exclude)은 리셋됨
      exclude: [],
      platform: 'PROGRAMMERS',
    });
  });

  it('이전 플랫폼 응답이 늦게 도착해도 현재 플랫폼 추천을 덮어쓰지 않는다 (in-flight 폐기)', async () => {
    const boj = [makeItem(1)];
    const prog: RecommendationItem = {
      title: 'Prog 1',
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/100',
      sourcePlatform: 'PROGRAMMERS',
      difficulty: 'BRONZE',
      level: 1,
      tags: ['해시'],
      category: 'ALGORITHM',
    };

    // BOJ 조회는 수동 resolve로 지연시키고, PROGRAMMERS는 즉시 응답.
    let resolveBoj!: (v: RecommendationItem[]) => void;
    const bojPromise = new Promise<RecommendationItem[]>((r) => {
      resolveBoj = r;
    });
    const fetcher = jest
      .fn<ReturnType<FetchRecommendations>, Parameters<FetchRecommendations>>()
      .mockReturnValueOnce(bojPromise) // BOJ — 응답 지연 (in-flight)
      .mockResolvedValueOnce([prog]); // PROGRAMMERS — 즉시

    const { result, rerender } = renderHook(
      ({ platform }) => useProblemRecommendation({ platform, fetcher }),
      { initialProps: { platform: 'BOJ' as 'BOJ' | 'PROGRAMMERS' } },
    );

    // BOJ 조회가 아직 pending인 상태에서 플랫폼 전환 발사.
    rerender({ platform: 'PROGRAMMERS' });
    await waitFor(() => expect(result.current.current).toEqual(prog));

    // 이제 이전(BOJ) 응답이 뒤늦게 도착해도 폐기돼야 한다.
    await act(async () => {
      resolveBoj(boj);
      await bojPromise;
    });

    expect(result.current.current).toEqual(prog);
    expect(fetcher).toHaveBeenCalledTimes(2);
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

describe('useProblemRecommendation — exclude 상한 캡핑 (백엔드 @ArrayMaxSize(100))', () => {
  it('새로고침을 반복해도 fetcher로 보내는 exclude 길이가 100을 초과하지 않는다', async () => {
    // 매 재조회마다 새 후보 1개를 반환 → exclude가 계속 누적되는 시나리오.
    let n = 0;
    const fetcher = jest.fn<
      ReturnType<FetchRecommendations>,
      Parameters<FetchRecommendations>
    >(async () => {
      n += 1;
      return [makeItem(n)];
    });

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));
    await waitFor(() => expect(result.current.current).not.toBeNull());

    // 120회 새로고침 → 각 refresh가 묶음(1개) 소진 후 재조회를 유발.
    for (let i = 0; i < 120; i += 1) {
      await act(async () => {
        result.current.refresh();
      });
    }

    // 모든 fetcher 호출의 exclude 길이가 상한(100) 이하여야 400을 피한다.
    for (const call of fetcher.mock.calls) {
      expect(call[0].exclude.length).toBeLessThanOrEqual(100);
    }
  });

  it('상한 도달 시 가장 오래된 URL부터 버리고 최근 URL은 exclude에 유지된다', async () => {
    let n = 0;
    const fetcher = jest.fn<
      ReturnType<FetchRecommendations>,
      Parameters<FetchRecommendations>
    >(async () => {
      n += 1;
      return [makeItem(n)];
    });

    const { result } = renderHook(() => useProblemRecommendation({ fetcher }));
    await waitFor(() => expect(result.current.current).not.toBeNull());

    for (let i = 0; i < 150; i += 1) {
      await act(async () => {
        result.current.refresh();
      });
    }

    const calls = fetcher.mock.calls;
    const lastExclude = calls[calls.length - 1][0].exclude;
    // 가장 오래된 후보(1번)는 밀려나 제외 목록에 없어야 한다.
    expect(lastExclude).not.toContain(makeItem(1).sourceUrl);
    // 최근에 노출된 후보는 여전히 제외 목록에 포함돼야 한다 (기능 의미 보존).
    expect(lastExclude).toContain(makeItem(n - 1).sourceUrl);
    expect(lastExclude.length).toBeLessThanOrEqual(100);
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
