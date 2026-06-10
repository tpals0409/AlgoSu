/**
 * @file MembersSection 컴포넌트 단위 테스트
 * @domain study
 * @layer test
 * @related MembersSection, studyApi
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { MembersSection } from '../MembersSection';
import type { StudyMember } from '@/lib/api';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarPresetKey: () => 'default',
  getAvatarSrc: (key: string) => `/avatars/${key}.svg`,
}));

jest.mock('@/lib/api', () => ({
  studyApi: {
    changeRole: jest.fn().mockResolvedValue({}),
    removeMember: jest.fn().mockResolvedValue({}),
    getMembers: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Crown: Icon, ShieldCheck: Icon, Trash2: Icon };
});

const mockMembers: StudyMember[] = [
  {
    id: 'mem-1',
    study_id: 'study-1',
    user_id: 'user-1',
    role: 'ADMIN',
    joined_at: '2024-01-01',
    nickname: '관리자',
    email: 'admin@example.com',
    avatar_url: null,
  },
  {
    id: 'mem-2',
    study_id: 'study-1',
    user_id: 'user-2',
    role: 'MEMBER',
    joined_at: '2024-01-02',
    nickname: '멤버',
    email: 'member@example.com',
    avatar_url: null,
  },
];

describe('MembersSection', () => {
  const defaultProps = {
    studyId: 'study-1',
    members: mockMembers,
    currentUserId: 'user-1',
    onMembersUpdate: jest.fn(),
    onSuccess: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('멤버 목록이 렌더링된다', () => {
    renderWithI18n(<MembersSection {...defaultProps} />);
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
  });

  it('멤버의 이름이 표시된다', () => {
    renderWithI18n(<MembersSection {...defaultProps} />);
    // 이름 텍스트 span만 targeting
    const spans = screen.getAllByText('관리자');
    expect(spans.length).toBeGreaterThan(0);
  });

  it('MEMBER 역할 변경 버튼 클릭 시 확인 모달이 표시된다', () => {
    renderWithI18n(<MembersSection {...defaultProps} />);
    // aria-label: "멤버 관리자" (멤버 이름 + "관리자" = changeToAdmin i18n 값)
    const changeToAdminBtn = screen.getByLabelText(/멤버 관리자$/);
    fireEvent.click(changeToAdminBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('내보내기 버튼 클릭 시 확인 모달이 표시된다', () => {
    renderWithI18n(<MembersSection {...defaultProps} />);
    // aria-label: "멤버 내보내기" (멤버 이름 + "내보내기" = removeMember i18n 값)
    const removeBtn = screen.getByLabelText(/멤버 내보내기/);
    fireEvent.click(removeBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('모달에서 취소 클릭 시 모달이 닫힌다', () => {
    renderWithI18n(<MembersSection {...defaultProps} />);
    const removeBtn = screen.getByLabelText(/멤버 내보내기/);
    fireEvent.click(removeBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /취소/ });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
