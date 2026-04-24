/**
 * @file useRequireStudy 단위 테스트
 */
import { renderHook } from '@testing-library/react';
import { useRequireStudy } from '../useRequireStudy';

const mockReplace = jest.fn();

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/',
  Link: () => null,
  redirect: jest.fn(),
}));

const mockUseStudy = jest.fn();
jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => mockUseStudy(),
}));

describe('useRequireStudy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 중이면 isStudyReady=false, 리다이렉트 안 함', () => {
    mockUseStudy.mockReturnValue({ studies: [], studiesLoaded: false });

    const { result } = renderHook(() => useRequireStudy());

    expect(result.current.isStudyReady).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('스터디가 있으면 isStudyReady=true, 리다이렉트 안 함', () => {
    mockUseStudy.mockReturnValue({
      studies: [{ id: '1', name: 'test', role: 'MEMBER' }],
      studiesLoaded: true,
      currentStudyId: '1',
    });

    const { result } = renderHook(() => useRequireStudy());

    expect(result.current.isStudyReady).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('스터디가 없으면 /studies로 리다이렉트', () => {
    mockUseStudy.mockReturnValue({ studies: [], studiesLoaded: true });

    const { result } = renderHook(() => useRequireStudy());

    expect(result.current.isStudyReady).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/studies');
  });
});
