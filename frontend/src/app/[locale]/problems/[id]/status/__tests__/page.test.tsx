import { render, act } from '@testing-library/react';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'submissionId' ? 'sub-123' : null),
  }),
}));

// React.use must return synchronously for the params Promise
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    use: (arg: unknown) => {
      // If it's our params-like promise, return the resolved value directly
      if (arg && typeof arg === 'object' && '_resolvedValue' in (arg as Record<string, unknown>)) {
        return (arg as { _resolvedValue: unknown })._resolvedValue;
      }
      return actual.use(arg);
    },
  };
});

function makeParams(value: Record<string, string>) {
  const p = Promise.resolve(value) as Promise<Record<string, string>> & { _resolvedValue: Record<string, string> };
  p._resolvedValue = value;
  return p;
}

describe('StatusRedirect', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StatusRedirect = require('../page').default;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submissionId가 있으면 /submissions/:id/status로 리다이렉트한다', () => {
    act(() => {
      render(<StatusRedirect params={makeParams({ id: 'prob-1' })} />);
    });
    expect(mockReplace).toHaveBeenCalledWith('/submissions/sub-123/status');
  });
});
