/**
 * @file SubmitRedirect 테스트
 * 이 페이지는 서버 컴포넌트에서 redirect()를 호출하는 단순 리다이렉트.
 * Next.js의 redirect()는 NEXT_REDIRECT 에러를 throw하므로 이를 검증한다.
 */

const mockRedirect = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    // next/navigation redirect throws an error in server context
    throw new Error('NEXT_REDIRECT');
  },
}));

describe('SubmitRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('/submit/[problemId]에서 /problems/[problemId]로 리다이렉트한다', async () => {
    // Dynamic import to avoid module-level side effects
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: SubmitRedirect } = require('../page');
    const params = Promise.resolve({ problemId: 'prob-123' });

    try {
      await SubmitRedirect({ params });
    } catch {
      // redirect throws NEXT_REDIRECT
    }

    expect(mockRedirect).toHaveBeenCalledWith('/problems/prob-123');
  });
});
