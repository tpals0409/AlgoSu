/**
 * @file quiz/page.tsx 통합 테스트 — idle→loading→playing→result 전체 플로우
 * @domain quiz
 * @layer page
 * @related quiz/page.tsx
 *
 * Sprint 217: useAuth 모킹 추가, async finish(waitFor), 게스트 분기 검증.
 * Sprint 218 Wave C: 인증 경로(apiStore), merge-up 멱등성, 네트워크 실패 폴백,
 *   재플레이 best 갱신 배지, 난이도별 기록 분리 시나리오 추가.
 * Sprint 228 Wave C: getRandomQuestions → async mock(mockResolvedValue).
 *   start() 내부가 async이므로 startGame()이 waitFor로 playing phase를 기다린다.
 *   loading 경유 흐름(idle→loading→playing) 명시.
 */
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizCategory, type QuizQuestion } from '@/data/quiz';
import QuizPage from '../page';
import { fetchApi } from '@/lib/api/client';
import { createLocalStorageQuizStore } from '@/lib/quiz/storage';
import { getRandomQuestions } from '@/data/quiz';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/hooks/useAnimVal', () => ({
  useAnimVal: (value: number) => [{ current: null }, value],
}));

/**
 * 가변 인증 상태 — 게스트(false) 기본값.
 * 인증 경로 테스트 describe에서 true로 전환한다.
 * babel-jest hoisting 규칙: mock* 접두사로 외부 스코프 참조 허용.
 */
let mockIsAuthenticated = false;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
    user: null,
  }),
}));

/**
 * fetchApi 모킹 — 인증 경로(apiStore) 테스트 전용.
 * 게스트 테스트(isAuthenticated=false)에서는 fetchApi가 호출되지 않는다.
 */
jest.mock('@/lib/api/client', () => ({
  fetchApi: jest.fn(),
}));

const mockFetchApi = jest.mocked(fetchApi);

const MOCK_QUESTIONS: QuizQuestion[] = [
  {
    id: 'ds-01',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: { ko: 'LIFO 자료구조는?', en: 'Which is LIFO?' },
    acceptedAnswers: ['스택', 'stack'],
    explanation: { ko: '스택입니다.', en: 'It is a stack.' },
    difficulty: 'EASY',
  },
  {
    id: 'ds-02',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: { ko: 'FIFO 자료구조는?', en: 'Which is FIFO?' },
    acceptedAnswers: ['큐', 'queue'],
    explanation: { ko: '큐입니다.', en: 'It is a queue.' },
    difficulty: 'EASY',
  },
];

jest.mock('@/data/quiz', () => {
  const actual = jest.requireActual('@/data/quiz');
  return {
    ...actual,
    QUIZ_CATEGORIES: [actual.QuizCategory.DATA_STRUCTURE],
    // async mock — start()가 await getRandomQuestions()를 호출하므로 Promise 반환 필수.
    // 기존 동기 반환 jest.fn(() => MOCK_QUESTIONS) → jest.fn(async () => MOCK_QUESTIONS)
    getRandomQuestions: jest.fn(async () => MOCK_QUESTIONS),
  };
});

/** 현재 렌더된 화면에서 답안을 입력하고 제출한다. */
function answerCurrent(text: string): void {
  const input = screen.getByLabelText('답안');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: '제출' }));
}

/** 테스트 간 인증 상태·API mock 오염 방지 (각 테스트 전 초기화). */
beforeEach(() => {
  mockIsAuthenticated = false;
  mockFetchApi.mockReset();
});

// ─── 기존: 게스트(미인증) 경로 ────────────────────────────────────────────────

describe('QuizPage flow', () => {
  beforeEach(() => window.localStorage.clear());

  /**
   * 퀴즈 시작 헬퍼 — start()가 async이므로 loading→playing 전환을 waitFor로 대기.
   * fireEvent.click 후 getRandomQuestions(async mock) 해결까지 playing phase가 보장된다.
   */
  async function startGame(): Promise<void> {
    renderWithI18n(<QuizPage />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    // loading → playing 전환 대기 (답안 입력 필드가 나타날 때 playing phase)
    await waitFor(() => expect(screen.getByLabelText('답안')).toBeInTheDocument());
  }

  it('renders the start screen initially', () => {
    renderWithI18n(<QuizPage />);
    expect(screen.getByText('CS 퀴즈 미니게임')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
  });

  /**
   * loading 중 SkeletonCard 노출 확인 (idle→loading→playing).
   * getRandomQuestions를 지연시켜 loading phase를 관찰한다.
   */
  it('shows SkeletonCard while loading questions (loading phase)', async () => {
    // 수동 제어 Promise로 loading phase를 잡는다
    let resolveQuestions!: (v: typeof MOCK_QUESTIONS) => void;
    const deferred = new Promise<typeof MOCK_QUESTIONS>((resolve) => {
      resolveQuestions = resolve;
    });
    jest.mocked(getRandomQuestions).mockImplementationOnce(async () => deferred);

    renderWithI18n(<QuizPage />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));

    // loading phase: SkeletonCard 내부 Skeleton이 aria-busy="true" 렌더
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).not.toBeNull(),
    );

    // 이 시점에서 QuizPlay(답안 입력)는 아직 없어야 한다
    expect(screen.queryByLabelText('답안')).not.toBeInTheDocument();

    // Promise 해결 → playing phase로 전환
    await act(async () => {
      resolveQuestions(MOCK_QUESTIONS);
    });
    await waitFor(() => expect(screen.getByLabelText('답안')).toBeInTheDocument());
  });

  it('shows the first question after starting', async () => {
    await startGame();
    expect(screen.getByText('LIFO 자료구조는?')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('grades a correct answer and shows the explanation', async () => {
    await startGame();
    answerCurrent('스택');
    expect(screen.getByText('정답입니다!')).toBeInTheDocument();
    expect(screen.getByText('스택입니다.')).toBeInTheDocument();
  });

  it('grades a wrong answer as incorrect', async () => {
    await startGame();
    answerCurrent('배열');
    expect(screen.getByText('오답입니다')).toBeInTheDocument();
  });

  it('completes the full flow and shows the result with a perfect score', async () => {
    await startGame();
    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    await waitFor(() => {
      expect(screen.getByText('퀴즈 완료')).toBeInTheDocument();
    });
    expect(screen.getByText('2 / 2 문제 정답')).toBeInTheDocument();
    expect(screen.getByText('최고 기록 갱신!')).toBeInTheDocument();
  });

  /**
   * Critic R1 P2 회귀 — 동적 import 실패 시 idle 복귀.
   * getRandomQuestions가 reject되면 loading에서 idle로 복귀해
   * SkeletonCard가 사라지고 시작 화면이 재노출되어 사용자가 재시도할 수 있다.
   */
  it('returns to idle when getRandomQuestions rejects (dynamic import failure)', async () => {
    jest.mocked(getRandomQuestions).mockRejectedValueOnce(new Error('Chunk load failed'));

    renderWithI18n(<QuizPage />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));

    // reject → idle 복귀: 시작 화면이 다시 나타난다
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument(),
    );

    // QuizStart 재노출, QuizPlay(답안 입력) 없음
    expect(screen.getByText('CS 퀴즈 미니게임')).toBeInTheDocument();
    expect(screen.queryByLabelText('답안')).not.toBeInTheDocument();
  });

  it('returns to the start screen when retry is clicked', async () => {
    await startGame();
    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    await waitFor(() => expect(screen.getByText('퀴즈 완료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '다시하기' }));
    expect(screen.getByText('CS 퀴즈 미니게임')).toBeInTheDocument();
  });

  /**
   * Wave C Scenario 1: 재플레이 best 표시
   * 첫 완주(만점) → 배지 "최고 기록 갱신!" 표시.
   * 다시하기 후 동일 점수 재완주 → higher-only 정책 → 배지 미표시.
   */
  it('does not show new-best badge on equal-score replay (higher-only storage)', async () => {
    // 첫 플레이: 만점(100%) — 이전 기록 없음 → isNewBest=true
    await startGame();
    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    await waitFor(() => expect(screen.getByText('퀴즈 완료')).toBeInTheDocument());
    expect(screen.getByText('최고 기록 갱신!')).toBeInTheDocument();

    // 재플레이: 동점(100%) — higher-only(prev.scorePercent >= new) → isNewBest=false → 배지 없음
    fireEvent.click(screen.getByRole('button', { name: '다시하기' }));
    // idle로 돌아간 후 다시 loading→playing 전환 대기
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(screen.getByLabelText('답안')).toBeInTheDocument());
    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    await waitFor(() => expect(screen.getByText('퀴즈 완료')).toBeInTheDocument());
    expect(screen.queryByText('최고 기록 갱신!')).not.toBeInTheDocument();
  });
});

// ─── Wave C: 인증(apiStore) 경로 ─────────────────────────────────────────────

describe('QuizPage — authenticated (apiStore) path', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    window.localStorage.clear();
  });
  afterEach(() => {
    mockIsAuthenticated = false;
  });

  /**
   * 인증 경로 startGame — async로 loading→playing 전환을 waitFor로 대기.
   */
  async function startGame(): Promise<void> {
    renderWithI18n(<QuizPage />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    await waitFor(() => expect(screen.getByLabelText('답안')).toBeInTheDocument());
  }

  /**
   * Wave C Scenario 2: 로그인 경로(apiStore)
   * 인증 상태에서 게임 완주 시 서버 저장이 호출되고 결과 화면이 정상 표시된다.
   */
  it('completes game via apiStore — server save is called and result is shown', async () => {
    // localStorage 비어있음 → merge-up fetchApi 호출 0회
    // finish(): GET(getBest → []) + POST(saveResult → {})
    mockFetchApi
      .mockResolvedValueOnce([]) // GET /api/quiz-records (fetchAllBest → 이전 기록 없음)
      .mockResolvedValueOnce({}); // POST /api/quiz-records (saveResult)

    await startGame();
    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    await waitFor(() => expect(screen.getByText('퀴즈 완료')).toBeInTheDocument());
    expect(screen.getByText('2 / 2 문제 정답')).toBeInTheDocument();
    // 이전 기록 없음(GET → []) → prevBest=null → isNewBest=true → 배지 표시
    expect(screen.getByText('최고 기록 갱신!')).toBeInTheDocument();
    // finish() 호출 순서·캐시 단언: getBest(GET) → saveResult(POST).
    // 1번째 = 옵션 없는 GET(getBest→fetchAllBest), 2번째 = POST(saveResult).
    expect(mockFetchApi).toHaveBeenNthCalledWith(1, '/api/quiz-records');
    expect(mockFetchApi).toHaveBeenNthCalledWith(
      2,
      '/api/quiz-records',
      expect.objectContaining({ method: 'POST' }),
    );
    // GET 결과가 메모리 캐시되어 결과 화면 렌더 중 재-GET 없음 → 정확히 2회만 호출.
    expect(mockFetchApi).toHaveBeenCalledTimes(2);
  });

  /**
   * Wave C Scenario 3: merge-up 멱등성 (Sprint 224: 통계 GET 추가 반영)
   * 게스트 기록이 있는 상태에서 로그인 전환 시 localStorage→서버 1회 업로드(POST).
   * 동시에 시작 화면 통계 조회(GET)가 1회 발생한다.
   * 이후 상태 변경으로 재렌더가 일어나도 ref 플래그·idle 한정 effect가 재요청을 차단한다.
   */
  it('merge-up uploads guest records once; ref flag prevents repeat on re-render', async () => {
    // 게스트 기록 1건 사전 적재
    const localStore = createLocalStorageQuizStore();
    await localStore.saveResult({
      category: 'DATA_STRUCTURE',
      difficulty: 'ALL',
      total: 2,
      correct: 2,
      scorePercent: 100,
      playedAt: '2026-06-01T00:00:00.000Z',
    });

    mockFetchApi.mockResolvedValue({}); // 통계 GET + merge-up POST 모두 성공
    renderWithI18n(<QuizPage />);

    // 인증 idle 진입 시 두 요청: 통계 GET(getAllBest) + merge-up POST(게스트 기록 1건)
    await waitFor(() => expect(mockFetchApi).toHaveBeenCalledTimes(2));
    expect(mockFetchApi).toHaveBeenCalledWith('/api/quiz-records');
    expect(mockFetchApi).toHaveBeenCalledWith(
      '/api/quiz-records',
      expect.objectContaining({ method: 'POST' }),
    );

    // 시작하기 클릭 → 상태 변경으로 재렌더 — merge-up ref 가드 + 통계 effect는 idle 한정
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));

    // 재렌더(idle→playing) 후에도 추가 요청 없음 — 여전히 2회
    expect(mockFetchApi).toHaveBeenCalledTimes(2);
  });

  /**
   * Wave C Scenario 5: api-store 네트워크 실패 fallback
   * 서버 조회·저장 모두 실패해도 결과 화면이 크래시 없이 표시된다(best-effort).
   * api-store.test.ts에 단위 커버가 있으므로 여기서는 페이지 레벨 통합만 보강.
   */
  it('shows result screen even when all server calls fail (best-effort fallback)', async () => {
    // 모든 fetchApi 호출 실패 — GET(getBest)·POST(saveResult) 양쪽
    mockFetchApi.mockRejectedValue(new Error('Network error'));

    await startGame();
    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    // 에러 바운더리가 아닌 결과 화면 정상 표시 (best-effort 폴백)
    await waitFor(() => expect(screen.getByText('퀴즈 완료')).toBeInTheDocument());
    expect(screen.getByText('2 / 2 문제 정답')).toBeInTheDocument();
    // GET 실패 → prevBest=null → isNewBest=true → 배지 표시
    expect(screen.getByText('최고 기록 갱신!')).toBeInTheDocument();
  });
});

// ─── Wave C Scenario 4: 난이도별 기록 분리 (guest, localStorage) ──────────────

describe('QuizPage — difficulty-based record separation (guest)', () => {
  beforeEach(() => window.localStorage.clear());

  /**
   * 기본 분야 'ALL' + 기본 난이도 'ALL' → localStorage 복합 키 'ALL::ALL'.
   * Sprint 227: 기본 분야가 DATA_STRUCTURE → ALL로 변경됨.
   * storage.test.ts에 단위 커버가 있으므로 여기서는 page→store 연결을 검증.
   */
  it('stores best record under composite ${category}::${difficulty} key (default ALL::ALL)', async () => {
    renderWithI18n(<QuizPage />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    // loading → playing 전환 대기 (async start())
    await waitFor(() => expect(screen.getByLabelText('답안')).toBeInTheDocument());

    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    await waitFor(() => expect(screen.getByText('퀴즈 완료')).toBeInTheDocument());

    // 기본 분야 'ALL' + 기본 난이도 'ALL' → localStorage 복합 키 'ALL::ALL' (Sprint 227)
    const stored = JSON.parse(window.localStorage.getItem('algosu.quiz.records.v2') ?? '{}');
    expect(stored).toHaveProperty('ALL::ALL');
    // 분야·난이도별 분리 — DATA_STRUCTURE::ALL 키는 별개 기록이며 혼재하지 않음
    expect(stored).not.toHaveProperty('DATA_STRUCTURE::ALL');
    expect(stored).not.toHaveProperty('DATA_STRUCTURE::EASY');
  });
});
