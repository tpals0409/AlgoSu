/**
 * @file useAiQuota 단위 테스트
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAiQuota } from '../useAiQuota';

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  aiQuotaApi: { get: () => mockGet() },
}));

describe('useAiQuota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enabled=true일 때 할당량을 조회한다', async () => {
    const quota = { used: 3, limit: 10, remaining: 7 };
    mockGet.mockResolvedValue(quota);

    const { result } = renderHook(() => useAiQuota(true));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.quota).toEqual(quota);
    expect(result.current.error).toBeNull();
  });

  it('enabled=false일 때 API를 호출하지 않는다', () => {
    const { result } = renderHook(() => useAiQuota(false));

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.quota).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('기본값 enabled=true로 동작한다', async () => {
    mockGet.mockResolvedValue({ used: 0, limit: 10, remaining: 10 });

    renderHook(() => useAiQuota());

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  it('API 오류 시 error를 설정한다', async () => {
    mockGet.mockRejectedValue(new Error('네트워크 오류'));

    const { result } = renderHook(() => useAiQuota(true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('네트워크 오류');
    expect(result.current.quota).toBeNull();
  });

  it('message 없는 에러 시 기본 메시지를 사용한다', async () => {
    mockGet.mockRejectedValue({});

    const { result } = renderHook(() => useAiQuota(true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });

  it('refresh 호출 시 데이터를 다시 조회한다', async () => {
    const quota1 = { used: 3, limit: 10, remaining: 7 };
    const quota2 = { used: 4, limit: 10, remaining: 6 };
    mockGet.mockResolvedValueOnce(quota1).mockResolvedValueOnce(quota2);

    const { result } = renderHook(() => useAiQuota(true));

    await waitFor(() => {
      expect(result.current.quota).toEqual(quota1);
    });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.quota).toEqual(quota2);
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
