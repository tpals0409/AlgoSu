/**
 * @file useAutoSave 단위 테스트
 */
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const baseOptions = {
    problemId: 'prob-1',
    studyId: 'study-1',
    code: 'console.log("hello")',
    language: 'javascript',
    enabled: true,
  };

  it('1초 debounce 후 localStorage에 저장한다', () => {
    renderHook(() => useAutoSave(baseOptions));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const stored = localStorage.getItem('algosu:draft:study-1:prob-1');
    expect(stored).not.toBeNull();

    const data = JSON.parse(stored!);
    expect(data.code).toBe('console.log("hello")');
    expect(data.language).toBe('javascript');
    expect(data.savedAt).toBeDefined();
  });

  it('studyId가 null이면 키에 studyId를 포함하지 않는다', () => {
    renderHook(() => useAutoSave({ ...baseOptions, studyId: null }));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const stored = localStorage.getItem('algosu:draft:prob-1');
    expect(stored).not.toBeNull();
  });

  it('enabled=false이면 저장하지 않는다', () => {
    renderHook(() => useAutoSave({ ...baseOptions, enabled: false }));

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const stored = localStorage.getItem('algosu:draft:study-1:prob-1');
    expect(stored).toBeNull();
  });

  it('onLocalSaved 콜백을 호출한다', () => {
    const onLocalSaved = jest.fn();
    renderHook(() => useAutoSave({ ...baseOptions, onLocalSaved }));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onLocalSaved).toHaveBeenCalledTimes(1);
  });

  it('loadFromLocal로 저장된 데이터를 복원한다', () => {
    const savedData = {
      code: 'saved code',
      language: 'python',
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('algosu:draft:study-1:prob-1', JSON.stringify(savedData));

    const { result } = renderHook(() => useAutoSave(baseOptions));

    const loaded = result.current.loadFromLocal();
    expect(loaded).toEqual(savedData);
  });

  it('loadFromLocal은 데이터가 없으면 null을 반환한다', () => {
    const { result } = renderHook(() => useAutoSave(baseOptions));

    const loaded = result.current.loadFromLocal();
    expect(loaded).toBeNull();
  });

  it('loadFromLocal은 파싱 오류 시 null을 반환한다', () => {
    localStorage.setItem('algosu:draft:study-1:prob-1', 'invalid json');

    const { result } = renderHook(() => useAutoSave(baseOptions));

    const loaded = result.current.loadFromLocal();
    expect(loaded).toBeNull();
  });

  it('clearLocal로 localStorage를 정리한다', () => {
    localStorage.setItem('algosu:draft:study-1:prob-1', '{"code":"test"}');

    const { result } = renderHook(() => useAutoSave(baseOptions));

    act(() => {
      result.current.clearLocal();
    });

    expect(localStorage.getItem('algosu:draft:study-1:prob-1')).toBeNull();
  });

  it('30초 간격으로 서버에 저장한다', async () => {
    const onServerSave = jest.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoSave({ ...baseOptions, onServerSave }));

    // 30초 대기
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(onServerSave).toHaveBeenCalledTimes(1);
    expect(onServerSave).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'console.log("hello")',
        language: 'javascript',
      }),
    );
  });

  it('서버 저장 실패 시 에러를 무시한다', async () => {
    const onServerSave = jest.fn().mockRejectedValue(new Error('서버 오류'));
    renderHook(() => useAutoSave({ ...baseOptions, onServerSave }));

    // 에러가 발생해도 throw하지 않아야 함
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(onServerSave).toHaveBeenCalled();
  });

  it('onServerSave 없으면 서버 저장 interval을 생성하지 않는다', () => {
    renderHook(() => useAutoSave({ ...baseOptions }));

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // no error thrown
  });

  it('enabled=false이면 서버 저장을 하지 않는다', async () => {
    const onServerSave = jest.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAutoSave({ ...baseOptions, enabled: false, onServerSave }),
    );

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    expect(onServerSave).not.toHaveBeenCalled();
  });

  it('localStorage 저장 오류를 무시한다', () => {
    const mockSetItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    renderHook(() => useAutoSave(baseOptions));

    // 에러가 발생해도 throw하지 않아야 함
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    mockSetItem.mockRestore();
  });

  it('code가 변경되면 debounce가 재시작된다', () => {
    const { rerender } = renderHook(
      ({ code }) => useAutoSave({ ...baseOptions, code }),
      { initialProps: { code: 'first' } },
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // code 변경 → debounce 리셋
    rerender({ code: 'second' });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 아직 1초가 안 지남
    expect(localStorage.getItem('algosu:draft:study-1:prob-1')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const stored = JSON.parse(localStorage.getItem('algosu:draft:study-1:prob-1')!);
    expect(stored.code).toBe('second');
  });
});
