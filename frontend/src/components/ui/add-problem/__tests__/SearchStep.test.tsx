/**
 * @file SearchStep unit tests — platform toggle, debounce, error/empty states, result list
 * @domain problem
 * @layer test
 * @related SearchStep, AddProblemModal, problem-search.utils
 */
import React from 'react';
import { screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';

// lucide icons → cheap svgs so we don't pull the full ESM tree
jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Search: Icon,
    X: Icon,
    Loader2: Icon,
    AlertCircle: Icon,
    RefreshCw: Icon,
    Sparkles: Icon,
  };
});

// The component only needs `isProgrammersSqlProblem` from @/lib/api through the utils
// barrel; mocking the barrel keeps the test hermetic. `getRecommendations`
// resolves [] so the recommendation section settles into its empty state and
// never interferes with the search assertions below.
jest.mock('@/lib/api', () => ({
  solvedacApi: { searchByQuery: jest.fn() },
  programmersApi: { searchByQuery: jest.fn() },
  problemApi: { getRecommendations: jest.fn().mockResolvedValue([]) },
  isProgrammersSqlProblem: jest.requireActual('@/lib/api/external').isProgrammersSqlProblem,
}));

import { SearchStep } from '../SearchStep';
import { problemApi, type RecommendationItem } from '@/lib/api';
import type { Platform, SolvedProblem } from '../problem-search.utils';

const mockGetRecommendations = problemApi.getRecommendations as jest.Mock;

interface HarnessProps {
  onSelect?: (p: SolvedProblem) => void;
  searchFn?: (q: string) => Promise<SolvedProblem[]>;
  onPlatformChange?: (p: Platform) => void;
  initialPlatform?: Platform;
}

/** Stateful wrapper so we can observe platform toggle behaviour from outside. */
function Harness({
  onSelect = jest.fn(),
  searchFn = jest.fn().mockResolvedValue([]),
  onPlatformChange,
  initialPlatform = 'PROGRAMMERS',
}: HarnessProps) {
  const [platform, setPlatform] = React.useState<Platform>(initialPlatform);
  return (
    <SearchStep
      onSelect={onSelect}
      platform={platform}
      searchFn={searchFn}
      onPlatformChange={(p) => {
        setPlatform(p);
        onPlatformChange?.(p);
      }}
    />
  );
}

describe('SearchStep — platform tabs', () => {
  it('renders both tabs with PROGRAMMERS active by default', () => {
    renderWithI18n(<Harness />);

    const tabs = screen.getAllByRole('tab');
    const pg = tabs.find((t) => t.textContent === '프로그래머스')!;
    const boj = tabs.find((t) => t.textContent === '백준')!;

    expect(pg.getAttribute('aria-selected')).toBe('true');
    expect(boj.getAttribute('aria-selected')).toBe('false');
  });

  it('toggles helper text + placeholder when the BOJ tab is clicked', () => {
    renderWithI18n(<Harness />);

    expect(screen.getByText('프로그래머스 문제를 검색합니다.')).toBeTruthy();
    expect(screen.getByPlaceholderText('프로그래머스 문제 검색…')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('tab').find((t) => t.textContent === '백준')!);

    expect(screen.getByText('solved.ac 기반으로 검색됩니다.')).toBeTruthy();
    expect(screen.getByPlaceholderText('문제 번호 또는 제목으로 검색…')).toBeTruthy();
  });

  it('cycles platforms when Arrow keys are pressed on a tab', () => {
    const changes: Platform[] = [];
    renderWithI18n(<Harness onPlatformChange={(p) => changes.push(p)} />);

    const pgTab = screen.getAllByRole('tab').find((t) => t.textContent === '프로그래머스')!;
    fireEvent.keyDown(pgTab, { key: 'ArrowRight' });
    fireEvent.keyDown(pgTab, { key: 'ArrowLeft' });

    // Each ArrowLeft/Right toggles to the other platform.
    expect(changes[0]).toBe('BOJ');
    // After the BOJ switch, the second key fires on the original PG node — but
    // the handler still reads the latest platform via closure on the *next*
    // render. We only assert that platform change fires for both keys.
    expect(changes).toHaveLength(2);
  });

  it('resets query + results when the platform toggles', async () => {
    jest.useFakeTimers();
    const searchFn = jest.fn().mockResolvedValue([
      { problemId: 1, titleKo: 'A', level: 1, tags: [], acceptedUserCount: 0 },
    ]);
    renderWithI18n(<Harness searchFn={searchFn} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'foo' } });
    await act(async () => { jest.advanceTimersByTime(400); });

    expect(screen.getByText('A')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('tab').find((t) => t.textContent === '백준')!);

    // After tab switch, the input is back to empty + results cleared
    const bojInput = screen.getByPlaceholderText('문제 번호 또는 제목으로 검색…');
    expect((bojInput as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('A')).toBeNull();

    jest.useRealTimers();
  });
});

describe('SearchStep — debounce + searchFn', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounces the search 400ms before calling searchFn', async () => {
    const searchFn = jest.fn().mockResolvedValue([]);
    renderWithI18n(<Harness searchFn={searchFn} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });

    // No call yet — debounce window still open
    await act(async () => { jest.advanceTimersByTime(399); });
    expect(searchFn).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(1); });
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenCalledWith('abc');
  });

  it('skips searchFn entirely when the query is whitespace-only', async () => {
    const searchFn = jest.fn().mockResolvedValue([]);
    renderWithI18n(<Harness searchFn={searchFn} />);

    fireEvent.change(
      screen.getByPlaceholderText('프로그래머스 문제 검색…'),
      { target: { value: '   ' } },
    );
    await act(async () => { jest.advanceTimersByTime(500); });

    expect(searchFn).not.toHaveBeenCalled();
  });

  it('caps displayed results at 10 even when the API returns more', async () => {
    const overflow = Array.from({ length: 15 }, (_, i) => ({
      problemId: i + 1,
      titleKo: `Title-${i + 1}`,
      level: 1,
      tags: [],
      acceptedUserCount: 0,
    }));
    renderWithI18n(<Harness searchFn={jest.fn().mockResolvedValue(overflow)} />);

    fireEvent.change(
      screen.getByPlaceholderText('프로그래머스 문제 검색…'),
      { target: { value: 'q' } },
    );
    await act(async () => { jest.advanceTimersByTime(400); });

    expect(screen.getByText('Title-1')).toBeTruthy();
    expect(screen.getByText('Title-10')).toBeTruthy();
    expect(screen.queryByText('Title-11')).toBeNull();
  });

  it('renders the localized error banner when searchFn rejects', async () => {
    const searchFn = jest.fn().mockRejectedValue(new Error('boom'));
    renderWithI18n(<Harness searchFn={searchFn} />);

    fireEvent.change(
      screen.getByPlaceholderText('프로그래머스 문제 검색…'),
      { target: { value: 'q' } },
    );
    await act(async () => { jest.advanceTimersByTime(400); });

    expect(
      screen.getByText('검색 중 오류가 발생했습니다. 다시 시도해주세요.'),
    ).toBeTruthy();
  });

  it('clears the query input via the X button', async () => {
    const searchFn = jest.fn().mockResolvedValue([]);
    renderWithI18n(<Harness searchFn={searchFn} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    // The clear button has no accessible name — find by its parent layout.
    const clearBtn = input.parentElement?.querySelector('button');
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn!);
    expect(input.value).toBe('');
  });
});

describe('SearchStep — result + state UIs', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders the empty-state hint when no query has been typed', () => {
    renderWithI18n(<Harness />);
    expect(screen.getByText('프로그래머스 문제를 검색하세요')).toBeTruthy();
  });

  it('renders "no results" when the API returns []', async () => {
    renderWithI18n(<Harness searchFn={jest.fn().mockResolvedValue([])} />);

    fireEvent.change(
      screen.getByPlaceholderText('프로그래머스 문제 검색…'),
      { target: { value: 'nothing' } },
    );
    await act(async () => { jest.advanceTimersByTime(400); });

    expect(screen.getByText('검색 결과가 없습니다')).toBeTruthy();
  });

  it('renders the BOJ solved count for BOJ results only', async () => {
    const result = {
      problemId: 1000,
      titleKo: 'A+B',
      level: 1,
      tags: [],
      acceptedUserCount: 12345,
    };
    renderWithI18n(<Harness initialPlatform="BOJ" searchFn={jest.fn().mockResolvedValue([result])} />);

    fireEvent.change(
      screen.getByPlaceholderText('문제 번호 또는 제목으로 검색…'),
      { target: { value: '1000' } },
    );
    await act(async () => { jest.advanceTimersByTime(400); });

    // Locale-formatted: 12,345 or 12.345 depending on default — test for substring.
    expect(screen.getByText(/12,345|12\.345/)).toBeTruthy();
  });

  it('fires onSelect with the picked result row', async () => {
    const onSelect = jest.fn();
    const result = {
      problemId: 59034,
      titleKo: 'SELECT ALL',
      level: 1,
      tags: [],
      acceptedUserCount: 0,
      difficulty: 'BRONZE' as const,
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/59034',
      category: 'sql' as const,
    };
    renderWithI18n(<Harness onSelect={onSelect} searchFn={jest.fn().mockResolvedValue([result])} />);

    fireEvent.change(
      screen.getByPlaceholderText('프로그래머스 문제 검색…'),
      { target: { value: 'SQL' } },
    );
    await act(async () => { jest.advanceTimersByTime(400); });

    fireEvent.click(screen.getByText('SELECT ALL'));
    expect(onSelect).toHaveBeenCalledWith(result);
  });

  it('renders the SQL badge only for Programmers SQL results', async () => {
    const sql = {
      problemId: 1,
      titleKo: 'SQL Problem',
      level: 1,
      tags: [],
      acceptedUserCount: 0,
      category: 'sql' as const,
    };
    renderWithI18n(<Harness searchFn={jest.fn().mockResolvedValue([sql])} />);

    fireEvent.change(
      screen.getByPlaceholderText('프로그래머스 문제 검색…'),
      { target: { value: 'SQL' } },
    );
    await act(async () => { jest.advanceTimersByTime(400); });

    expect(screen.getAllByText('SQL').length).toBeGreaterThanOrEqual(1);
  });
});

describe('SearchStep — recommendation section', () => {
  function makeRec(n: number): RecommendationItem {
    return {
      title: `Recommended ${n}`,
      sourceUrl: `https://www.acmicpc.net/problem/${n}`,
      sourcePlatform: 'BOJ',
      difficulty: 'GOLD',
      level: 13,
      tags: [`rtag${n}`],
      category: 'ALGORITHM',
    };
  }

  afterEach(() => {
    mockGetRecommendations.mockReset();
    mockGetRecommendations.mockResolvedValue([]);
  });

  it('renders the recommendation section title + the first candidate', async () => {
    mockGetRecommendations.mockResolvedValue([makeRec(1), makeRec(2)]);
    renderWithI18n(<Harness />);

    expect(await screen.findByText('추천 문제')).toBeTruthy();
    expect(await screen.findByText('Recommended 1')).toBeTruthy();
  });

  it('shows a platform-native tier label on the card — BOJ item → solved.ac tier (item platform is SSOT)', async () => {
    // makeRec: BOJ, GOLD, level 13 → solved.ac 세부 티어 "Gold III"(대분류 "Gold" 아님).
    // 활성 탭이 PROGRAMMERS여도 항목 자체 플랫폼(BOJ) 체계로 표기해야 한다.
    mockGetRecommendations.mockResolvedValue([makeRec(1)]);
    renderWithI18n(<Harness initialPlatform="PROGRAMMERS" />);

    const card = (await screen.findByText('Recommended 1')).closest('button')!;
    expect(within(card).getByText('Gold III')).toBeTruthy();
  });

  it('shows a Programmers level label (Lv.N) on the card, not a BOJ tier name', async () => {
    const progRec: RecommendationItem = {
      title: 'Prog Rec',
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42576',
      sourcePlatform: 'PROGRAMMERS',
      difficulty: 'SILVER',
      level: 2,
      tags: ['해시'],
      category: 'ALGORITHM',
    };
    mockGetRecommendations.mockResolvedValue([progRec]);
    // 활성 탭 BOJ여도 프로그래머스 항목은 Lv.N 으로 표기 (항목 플랫폼 SSOT).
    renderWithI18n(<Harness initialPlatform="BOJ" />);

    const card = (await screen.findByText('Prog Rec')).closest('button')!;
    expect(within(card).getByText('Lv.2')).toBeTruthy();
    // 기존 버그: 티어명 "Silver"로 표기되던 것 — 카드 내에는 없어야 한다.
    expect(within(card).queryByText('Silver')).toBeNull();
  });

  it('rotates to the next candidate when Refresh is clicked (no re-fetch)', async () => {
    mockGetRecommendations.mockResolvedValue([makeRec(1), makeRec(2)]);
    renderWithI18n(<Harness />);

    await screen.findByText('Recommended 1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /새로고침/ }));
    });

    expect(await screen.findByText('Recommended 2')).toBeTruthy();
    // prefetch only — rotation is client-side.
    expect(mockGetRecommendations).toHaveBeenCalledTimes(1);
  });

  it('maps the recommendation to a SolvedProblem and fires onSelect on card click', async () => {
    mockGetRecommendations.mockResolvedValue([makeRec(1234)]);
    const onSelect = jest.fn();
    renderWithI18n(<Harness onSelect={onSelect} />);

    const card = await screen.findByText('Recommended 1234');
    await act(async () => { fireEvent.click(card); });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      problemId: 1234,
      titleKo: 'Recommended 1234',
      sourceUrl: 'https://www.acmicpc.net/problem/1234',
      category: 'algorithm',
    });
  });

  it('shows the error notice when the recommendation fetch rejects', async () => {
    mockGetRecommendations.mockRejectedValue(new Error('rec boom'));
    renderWithI18n(<Harness />);

    expect(await screen.findByText('추천 문제를 불러오지 못했습니다.')).toBeTruthy();
  });

  // ── 난이도 선택 (Sprint 256) — 플랫폼별 라벨 (Sprint 257) ───────
  it('renders the difficulty chips with Programmers levels (자동 + Lv.1~Lv.5)', async () => {
    mockGetRecommendations.mockResolvedValue([makeRec(1)]);
    renderWithI18n(<Harness initialPlatform="PROGRAMMERS" />);

    await screen.findByText('Recommended 1');
    expect(screen.getByRole('button', { name: '자동' })).toBeTruthy();
    // 프로그래머스는 네이티브 레벨 체계(Lv.1~5)로 표기 (백준 티어명 아님)
    expect(screen.getByRole('button', { name: 'Lv.1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lv.2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lv.3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lv.4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lv.5' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bronze' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Platinum' })).toBeNull();
    // 초기 상태: 자동 칩이 눌림
    expect(
      screen.getByRole('button', { name: '자동' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('renders the difficulty chips with BOJ tiers (자동 + Bronze~Diamond)', async () => {
    mockGetRecommendations.mockResolvedValue([makeRec(1)]);
    renderWithI18n(<Harness initialPlatform="BOJ" />);

    await screen.findByText('Recommended 1');
    // 백준은 solved.ac 티어명(Bronze~Diamond)으로 표기
    expect(screen.getByRole('button', { name: 'Bronze' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Silver' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gold' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Platinum' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Diamond' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lv.1' })).toBeNull();
    // RUBY는 프로그래머스 대응 레벨이 없어 제외 — BOJ에서도 칩 없음
    expect(screen.queryByRole('button', { name: 'Ruby' })).toBeNull();
  });

  it('re-fetches with the selected difficulty when a chip is clicked', async () => {
    mockGetRecommendations.mockResolvedValue([makeRec(1)]);
    renderWithI18n(<Harness initialPlatform="PROGRAMMERS" />);

    await screen.findByText('Recommended 1');
    mockGetRecommendations.mockClear();

    // 프로그래머스 Lv.3 칩 → 내부적으로 difficulty=GOLD 전송 (밴드 매핑)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lv.3' }));
    });

    await waitFor(() =>
      expect(mockGetRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: 'GOLD' }),
      ),
    );
    expect(
      screen.getByRole('button', { name: 'Lv.3' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('toggles back to auto (no difficulty) when the active chip is re-clicked', async () => {
    mockGetRecommendations.mockResolvedValue([makeRec(1)]);
    renderWithI18n(<Harness initialPlatform="PROGRAMMERS" />);

    await screen.findByText('Recommended 1');

    // Lv.3 선택
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lv.3' }));
    });
    mockGetRecommendations.mockClear();

    // Lv.3 재클릭 → 자동으로 토글 → difficulty 없이 재조회
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lv.3' }));
    });

    // 쿼리 빌더가 falsy difficulty를 직렬화하지 않으므로, 값이 undefined면 자동(전체) 추천.
    await waitFor(() => {
      expect(mockGetRecommendations).toHaveBeenCalled();
      expect(mockGetRecommendations.mock.calls.at(-1)![0].difficulty).toBeUndefined();
    });
    expect(
      screen.getByRole('button', { name: '자동' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
