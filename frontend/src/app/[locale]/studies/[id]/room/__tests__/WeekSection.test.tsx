/**
 * @file WeekSection 렌더 게이트 회귀 테스트 (Critic P2 — PR #510)
 * @domain study
 * @layer test
 * @related ../WeekSection.tsx
 */

import { screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import koStudies from '@messages/ko/studies.json';
import { renderWithI18n } from '@/test-utils/i18n';
import type { Problem } from '@/lib/api';
import type { WeekGroup } from '../utils';
import { WeekSection } from '../WeekSection';

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { ChevronRight: Icon, ChevronDown: Icon, Check: Icon };
});

const messages = { studies: koStudies };

const makeProblem = (o: Partial<Problem> = {}): Problem =>
  ({
    id: 'p-1',
    title: 'Two Sum',
    difficulty: 'GOLD',
    level: 11,
    deadline: '2020-01-01T00:00:00.000Z',
    status: 'CLOSED',
    weekNumber: '1월1주차',
    ...o,
  }) as Problem;

const baseProps = {
  barsAnimated: false,
  submissionCountByProblem: new Map<string, { count: number; analyzedCount: number }>(),
  totalMembers: 3,
  solvedProblemIds: new Set<string>(),
  onSelect: jest.fn(),
};

const inactiveWeek: WeekGroup = {
  label: '1월1주차',
  active: false,
  problems: [makeProblem()],
  recency: 1,
};

const activeWeek: WeekGroup = {
  label: '1월1주차',
  active: true,
  problems: [makeProblem({ status: 'ACTIVE', deadline: '2999-01-01T00:00:00.000Z' })],
  recency: 2,
};

describe('WeekSection', () => {
  it('활성 주차는 토글 없이 문제 카드를 항상 렌더한다', () => {
    renderWithI18n(<WeekSection week={activeWeek} {...baseProps} />);
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    // collapsible=false → 펼치기/접기 버튼 없음
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('지난 주차는 기본 접힘 — 문제 카드 숨김', () => {
    renderWithI18n(<WeekSection week={inactiveWeek} {...baseProps} />);
    expect(screen.getByText('1월1주차')).toBeInTheDocument();
    expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();
  });

  it('회귀: 동일 인스턴스가 비활성→활성으로 전환돼도 활성 주차 카드가 숨겨지지 않는다 (Critic P2)', () => {
    // 같은 위치(인스턴스)에서 접힌 지난 주차로 마운트 → 카드 숨김
    const { rerender } = renderWithI18n(<WeekSection week={inactiveWeek} {...baseProps} />);
    expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();

    // 인스턴스 재사용: 같은 label 이 활성 주차로 전환 (refetch/스터디 전환 시나리오)
    // useState 초기화가 재실행되지 않아 open=false 잔존 → 버그면 카드 영구 숨김
    rerender(
      <NextIntlClientProvider locale="ko" messages={messages}>
        <WeekSection week={activeWeek} {...baseProps} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
  });
});
