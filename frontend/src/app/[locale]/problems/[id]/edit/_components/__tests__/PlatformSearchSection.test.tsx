/**
 * @file PlatformSearchSection 컴포넌트 단위 테스트
 * @domain problem
 * @layer test
 * @related PlatformSearchSection
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { PlatformSearchSection } from '../PlatformSearchSection';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Search: Icon, ExternalLink: Icon, X: Icon };
});

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

const defaultProps = {
  activePlatform: 'BOJ' as const,
  onPlatformChange: jest.fn(),
  bojQuery: '',
  setBojQuery: jest.fn(),
  bojSearching: false,
  bojError: null,
  setBojError: jest.fn(),
  bojResult: null,
  bojApplied: false,
  handleBojSearch: jest.fn(),
  handleBojKeyDown: jest.fn(),
  handleBojReset: jest.fn(),
  programmersQuery: '',
  setProgrammersQuery: jest.fn(),
  programmersSearching: false,
  programmersError: null,
  setProgrammersError: jest.fn(),
  programmersResult: null,
  programmersApplied: false,
  handleProgrammersSearch: jest.fn(),
  handleProgrammersKeyDown: jest.fn(),
  handleProgrammersReset: jest.fn(),
  isSubmitting: false,
};

describe('PlatformSearchSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('기본적으로 BOJ 탭이 활성화된다', () => {
    renderWithI18n(<PlatformSearchSection {...defaultProps} />);
    const bojTab = screen.getByRole('tab', { name: /BOJ|백준/ });
    expect(bojTab).toHaveAttribute('aria-selected', 'true');
  });

  it('프로그래머스 탭 클릭 시 onPlatformChange가 호출된다', () => {
    renderWithI18n(<PlatformSearchSection {...defaultProps} />);
    const programmersTab = screen.getByRole('tab', { name: /프로그래머스/ });
    fireEvent.click(programmersTab);
    expect(defaultProps.onPlatformChange).toHaveBeenCalledWith('PROGRAMMERS');
  });

  it('BOJ 탭이 활성화되면 검색 버튼이 표시된다', () => {
    renderWithI18n(<PlatformSearchSection {...defaultProps} />);
    const searchBtn = screen.getByRole('button', { name: /검색/ });
    expect(searchBtn).toBeInTheDocument();
  });

  it('PROGRAMMERS 탭이 활성화되면 프로그래머스 검색 UI가 표시된다', () => {
    renderWithI18n(
      <PlatformSearchSection {...defaultProps} activePlatform="PROGRAMMERS" />,
    );
    const programmersTab = screen.getByRole('tab', { name: /프로그래머스/ });
    expect(programmersTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /검색/ })).toBeInTheDocument();
  });

  it('bojApplied=true이면 연결 해제 버튼이 표시된다', () => {
    renderWithI18n(
      <PlatformSearchSection {...defaultProps} bojApplied bojQuery="1000" />,
    );
    expect(screen.getByRole('button', { name: /연결 해제/ })).toBeInTheDocument();
  });
});
