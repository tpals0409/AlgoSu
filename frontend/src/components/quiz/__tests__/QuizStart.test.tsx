/**
 * @file QuizStart 컴포넌트 테스트 — 선택·시작·빈 상태 + radiogroup 접근성
 * @domain quiz
 * @layer component
 * @related QuizStart, PillRadioGroup
 */
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizCategory } from '@/data/quiz';
import { QuizStart } from '../QuizStart';

/**
 * 테스트용 분야별 풀 크기 (실제 데이터와 무관한 제어 가능한 목)
 * DS:ALL=30, ALGO:ALL=17/HARD=9, NETWORK:ALL=30/HARD=4
 */
const MOCK_POOL: Record<string, Record<string, number>> = {
  ALL:         { ALL: 77, EASY: 26, MEDIUM: 27, HARD: 24 },
  DATA_STRUCTURE: { ALL: 30, EASY: 10, MEDIUM: 10, HARD: 10 },
  ALGORITHM:   { ALL: 17, EASY: 4,  MEDIUM: 4,  HARD: 9  },
  NETWORK:     { ALL: 30, EASY: 14, MEDIUM: 12, HARD: 4  },
};

jest.mock('@/data/quiz', () => {
  const actual = jest.requireActual('@/data/quiz');
  return {
    ...actual,
    QUIZ_CATEGORIES: [
      actual.QuizCategory.DATA_STRUCTURE,
      actual.QuizCategory.ALGORITHM,
      actual.QuizCategory.NETWORK,
    ],
    getQuestionsByFilter: (
      category: string,
      difficulty: string,
    ): { id: string; category: string; difficulty: string }[] => {
      const catKey = category === 'ALL' ? 'ALL' : category;
      const poolSizes = MOCK_POOL[catKey] ?? { ALL: 0, EASY: 0, MEDIUM: 0, HARD: 0 };
      const size = poolSizes[difficulty] ?? 0;
      return Array.from({ length: size }, (_, i) => ({
        id: `${catKey}-${String(i + 1).padStart(2, '0')}`,
        category,
        difficulty: difficulty === 'ALL' ? 'EASY' : difficulty,
      }));
    },
  };
});

describe('QuizStart', () => {
  it('renders category options and title', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    expect(screen.getByText('CS 퀴즈 미니게임')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '자료구조' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '알고리즘' })).toBeInTheDocument();
  });

  it('starts with the default category (ALL), count, and difficulty', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    // 기본 분야는 'ALL', 기본 난이도는 'ALL'
    expect(onStart).toHaveBeenCalledWith('ALL', 5, 'ALL');
  });

  it('reflects the selected category, count, and difficulty', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    fireEvent.click(screen.getByRole('radio', { name: '알고리즘' }));
    fireEvent.click(screen.getByRole('radio', { name: '10' }));
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.ALGORITHM, 10, 'ALL');
  });

  it('shows both count options when the filtered pool is large enough', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const categoryGroup = screen.getByRole('radiogroup', { name: '분야 선택' });
    // 분야 '전체' — ALL 풀은 충분히 커서 5·10 모두 노출
    fireEvent.click(within(categoryGroup).getByRole('radio', { name: '전체' }));
    expect(screen.getByRole('radio', { name: '5' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '10' })).toBeInTheDocument();
  });

  it('hides the 10 option when the filtered pool is below 10', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    // 알고리즘 + 어려움 = 9문항 (< 10) → [5]만 노출
    fireEvent.click(screen.getByRole('radio', { name: '알고리즘' }));
    const difficultyGroup = screen.getByRole('radiogroup', { name: '난이도' });
    fireEvent.click(within(difficultyGroup).getByRole('radio', { name: '어려움' }));
    expect(screen.getByRole('radio', { name: '5' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '10' })).not.toBeInTheDocument();
  });

  it('clamps the selected count to the available pool when difficulty narrows it', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    // 10 선택 후 풀이 작은 난이도로 좁히면 onStart count는 가용 이하로 클램프
    fireEvent.click(screen.getByRole('radio', { name: '알고리즘' }));
    fireEvent.click(screen.getByRole('radio', { name: '10' }));
    const difficultyGroup = screen.getByRole('radiogroup', { name: '난이도' });
    fireEvent.click(within(difficultyGroup).getByRole('radio', { name: '어려움' }));
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.ALGORITHM, 5, 'HARD');
  });

  it('offers the whole pool as a single option when fewer than 5 questions exist', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    // 네트워크 + 어려움 = 4문항 (< 5) → 단일 옵션 [4]
    fireEvent.click(screen.getByRole('radio', { name: '네트워크' }));
    const difficultyGroup = screen.getByRole('radiogroup', { name: '난이도' });
    fireEvent.click(within(difficultyGroup).getByRole('radio', { name: '어려움' }));
    expect(screen.getByRole('radio', { name: '4' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '5' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.NETWORK, 4, 'HARD');
  });

  it('renders difficulty options with ALL selected by default', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const difficultyGroup = screen.getByRole('radiogroup', { name: '난이도' });
    expect(within(difficultyGroup).getByRole('radio', { name: '전체' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(difficultyGroup).getByRole('radio', { name: '쉬움' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(within(difficultyGroup).getByRole('radio', { name: '보통' })).toBeInTheDocument();
    expect(within(difficultyGroup).getByRole('radio', { name: '어려움' })).toBeInTheDocument();
  });

  it('marks the active category with aria-checked (default ALL)', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const categoryGroup = screen.getByRole('radiogroup', { name: '분야 선택' });
    // 기본값이 ALL이므로 분야 '전체'가 true, 자료구조는 false
    expect(within(categoryGroup).getByRole('radio', { name: '전체' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(categoryGroup).getByRole('radio', { name: '자료구조' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(within(categoryGroup).getByRole('radio', { name: '알고리즘' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('renders a category icon that is hidden from the accessible name', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    // 특정 분야(자료구조)를 클릭해 해당 radio의 icon aria-hidden 확인
    fireEvent.click(screen.getByRole('radio', { name: '자료구조' }));
    const radio = screen.getByRole('radio', { name: '자료구조' });
    const icon = radio.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the category accent color to the active category pill (specific category)', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    // '전체'는 accent style이 없으므로 특정 분야를 클릭해 active로 만든 뒤 확인
    fireEvent.click(screen.getByRole('radio', { name: '자료구조' }));
    const active = screen.getByRole('radio', { name: '자료구조' });
    expect(active).toHaveStyle({ color: 'var(--quiz-cat-data-structure-color)' });
  });

  it('exposes each pill group as a labeled radiogroup', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    expect(screen.getByRole('radiogroup', { name: '분야 선택' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '난이도' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '문항 수' })).toBeInTheDocument();
  });

  it('applies roving tabindex — only the checked pill is tabbable (default ALL for category)', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const categoryGroup = screen.getByRole('radiogroup', { name: '분야 선택' });
    // 분야: 기본 선택은 '전체'(ALL) → tabIndex 0, 나머지 -1
    expect(within(categoryGroup).getByRole('radio', { name: '전체' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(within(categoryGroup).getByRole('radio', { name: '자료구조' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
    expect(within(categoryGroup).getByRole('radio', { name: '알고리즘' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
    expect(within(categoryGroup).getByRole('radio', { name: '네트워크' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('moves selection with ArrowRight and wraps at the end (category group)', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const categoryGroup = screen.getByRole('radiogroup', { name: '분야 선택' });
    // 분야 그룹 순서: [전체, 자료구조, 알고리즘, 네트워크] (mock 기준 ALL + 3개)
    const allRadio = within(categoryGroup).getByRole('radio', { name: '전체' });
    fireEvent.keyDown(allRadio, { key: 'ArrowRight' });
    expect(within(categoryGroup).getByRole('radio', { name: '자료구조' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // 끝에서 ArrowRight → 처음(전체)으로 순환
    fireEvent.keyDown(within(categoryGroup).getByRole('radio', { name: '자료구조' }), {
      key: 'ArrowRight',
    });
    fireEvent.keyDown(within(categoryGroup).getByRole('radio', { name: '알고리즘' }), {
      key: 'ArrowRight',
    });
    fireEvent.keyDown(within(categoryGroup).getByRole('radio', { name: '네트워크' }), {
      key: 'ArrowRight',
    });
    expect(within(categoryGroup).getByRole('radio', { name: '전체' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('moves selection with ArrowLeft, Home, and End keys (difficulty group)', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const difficultyGroup = screen.getByRole('radiogroup', { name: '난이도' });
    const all = within(difficultyGroup).getByRole('radio', { name: '전체' });
    // ArrowLeft from first → wraps to last (어려움)
    fireEvent.keyDown(all, { key: 'ArrowLeft' });
    expect(within(difficultyGroup).getByRole('radio', { name: '어려움' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Home → first (전체)
    fireEvent.keyDown(within(difficultyGroup).getByRole('radio', { name: '어려움' }), {
      key: 'Home',
    });
    expect(within(difficultyGroup).getByRole('radio', { name: '전체' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // End → last (어려움)
    fireEvent.keyDown(within(difficultyGroup).getByRole('radio', { name: '전체' }), {
      key: 'End',
    });
    expect(within(difficultyGroup).getByRole('radio', { name: '어려움' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('ignores non-navigation keys without changing selection', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const categoryGroup = screen.getByRole('radiogroup', { name: '분야 선택' });
    // 기본 선택은 ALL이므로 자료구조는 false
    const ds = within(categoryGroup).getByRole('radio', { name: '자료구조' });
    fireEvent.keyDown(ds, { key: 'a' });
    // 자료구조는 여전히 비선택 상태
    expect(ds).toHaveAttribute('aria-checked', 'false');
    // '전체'는 여전히 선택 상태
    expect(within(categoryGroup).getByRole('radio', { name: '전체' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  // ─── 작업 2: 'ALL' 분야 신규 테스트 ───────────────────────────────────────

  it("category group has '전체'(ALL) radio with aria-checked=true by default", () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const categoryGroup = screen.getByRole('radiogroup', { name: '분야 선택' });
    expect(within(categoryGroup).getByRole('radio', { name: '전체' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onStart with the selected enum when a specific category is chosen', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    fireEvent.click(screen.getByRole('radio', { name: '자료구조' }));
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.DATA_STRUCTURE, 5, 'ALL');
  });

  it("'전체' category radio contains a Shuffle icon (aria-hidden svg)", () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const categoryGroup = screen.getByRole('radiogroup', { name: '분야 선택' });
    const allRadio = within(categoryGroup).getByRole('radio', { name: '전체' });
    const icon = allRadio.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it("'전체' category active state has no accent inline color style (primary class only)", () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const categoryGroup = screen.getByRole('radiogroup', { name: '분야 선택' });
    const allRadio = within(categoryGroup).getByRole('radio', { name: '전체' });
    // 기본 선택인 '전체'는 accent color style이 없어야 함
    expect(allRadio.getAttribute('style')).toBeNull();
  });
});
