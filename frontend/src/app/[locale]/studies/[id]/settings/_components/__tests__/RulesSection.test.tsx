/**
 * @file RulesSection 컴포넌트 단위 테스트
 * @domain study
 * @layer test
 * @related RulesSection, studyApi
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { RulesSection } from '../RulesSection';

const mockUpdateGroundRules = jest.fn();
jest.mock('@/lib/api', () => ({
  studyApi: {
    updateGroundRules: (...args: unknown[]) => mockUpdateGroundRules(...args),
  },
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

jest.mock('@/components/ui/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div data-testid="markdown-viewer">{content}</div>
  ),
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Eye: Icon, Pencil: Icon };
});

describe('RulesSection', () => {
  const defaultProps = {
    studyId: 'study-1',
    initialRulesText: '## 그라운드룰\n\n- 규칙 1',
    onSuccess: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('초기 텍스트로 편집 영역이 렌더링된다', () => {
    renderWithI18n(<RulesSection {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/마크다운|그라운드/);
    expect(textarea).toHaveValue('## 그라운드룰\n\n- 규칙 1');
  });

  it('미리보기 버튼 클릭 시 MarkdownViewer가 표시된다', () => {
    renderWithI18n(<RulesSection {...defaultProps} />);
    const previewBtn = screen.getByRole('button', { name: /미리보기/ });
    fireEvent.click(previewBtn);
    expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument();
  });

  it('편집 버튼 클릭 시 편집 모드로 돌아온다', () => {
    renderWithI18n(<RulesSection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /미리보기/ }));
    fireEvent.click(screen.getByRole('button', { name: /편집/ }));
    expect(screen.getByPlaceholderText(/마크다운|그라운드/)).toBeInTheDocument();
  });

  it('저장 버튼 클릭 시 확인 모달이 표시된다', () => {
    renderWithI18n(<RulesSection {...defaultProps} />);
    const saveBtn = screen.getByRole('button', { name: /저장/ });
    fireEvent.click(saveBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('확인 모달에서 확인 클릭 시 studyApi.updateGroundRules가 호출된다', async () => {
    mockUpdateGroundRules.mockResolvedValue({});
    renderWithI18n(<RulesSection {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /저장/ }));
    // 저장 확인 모달의 confirm 버튼 (두 번째 저장 버튼)
    const confirmBtns = screen.getAllByRole('button', { name: /저장/ });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(mockUpdateGroundRules).toHaveBeenCalledWith(
        'study-1',
        '## 그라운드룰\n\n- 규칙 1',
      );
    });
    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });
});
