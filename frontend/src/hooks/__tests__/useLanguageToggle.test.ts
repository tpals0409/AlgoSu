/**
 * @file useLanguageToggle 단위 테스트
 */
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useLanguageToggle } from '../useLanguageToggle';
import type { ProblemFormState } from '@/lib/problem-form-utils';

const defaultForm: ProblemFormState = {
  title: '',
  description: '',
  difficulty: 'EASY',
  weekNumber: '1',
  deadline: '',
  allowedLanguages: ['python', 'javascript'],
  sourceUrl: '',
  sourcePlatform: '',
};

/** setForm + useLanguageToggle를 결합한 래퍼 */
function useTestHook(initial: ProblemFormState = defaultForm) {
  const [form, setForm] = useState(initial);
  const toggle = useLanguageToggle(setForm);
  return { form, toggle };
}

describe('useLanguageToggle', () => {
  it('선택된 언어를 제거한다', () => {
    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.toggle('python');
    });

    expect(result.current.form.allowedLanguages).toEqual(['javascript']);
  });

  it('미선택 언어를 추가한다', () => {
    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.toggle('java');
    });

    expect(result.current.form.allowedLanguages).toEqual(['python', 'javascript', 'java']);
  });

  it('마지막 남은 언어는 제거하지 않는다', () => {
    const { result } = renderHook(() =>
      useTestHook({ ...defaultForm, allowedLanguages: ['python'] }),
    );

    act(() => {
      result.current.toggle('python');
    });

    // 여전히 python이 남아 있어야 함
    expect(result.current.form.allowedLanguages).toEqual(['python']);
  });
});
