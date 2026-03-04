/**
 * @file useRequireAuth 단위 테스트
 */
import { renderHook } from '@testing-library/react';
import { useRequireAuth } from '../useRequireAuth';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('useRequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 중이면 isReady=false, 리다이렉트 안 함', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isReady).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('인증 완료 시 isReady=true, 리다이렉트 안 함', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isReady).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('미인증 + 로딩 완료 시 /login으로 리다이렉트', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isReady).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
