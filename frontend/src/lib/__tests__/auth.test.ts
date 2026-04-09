/**
 * @file auth.ts 단위 테스트
 */
import {
  removeToken,
  removeRefreshToken,
  getGitHubConnected,
  setGitHubConnected,
  getGitHubUsername,
  setGitHubUsername,
} from '@/lib/auth';

beforeEach(() => {
  localStorage.clear();
});

// ── SSR 환경 (window === undefined) 시뮬레이션 헬퍼 ──
function withoutWindow(fn: () => void): void {
  const original = global.window;
  // @ts-expect-error intentionally setting window to undefined for SSR test
  delete global.window;
  try {
    fn();
  } finally {
    global.window = original;
  }
}

// ── 레거시 토큰 정리 ──

describe('removeToken / removeRefreshToken (레거시 정리)', () => {
  it('localStorage에 레거시 토큰이 있으면 삭제한다', () => {
    localStorage.setItem('algosu:token', 'old-token');
    removeToken();
    expect(localStorage.getItem('algosu:token')).toBeNull();
  });

  it('localStorage에 레거시 리프레시 토큰이 있으면 삭제한다', () => {
    localStorage.setItem('algosu:refresh_token', 'old-refresh');
    removeRefreshToken();
    expect(localStorage.getItem('algosu:refresh_token')).toBeNull();
  });

  it('SSR 환경에서 removeToken은 아무 작업도 하지 않는다', () => {
    withoutWindow(() => {
      expect(() => removeToken()).not.toThrow();
    });
  });

  it('SSR 환경에서 removeRefreshToken은 아무 작업도 하지 않는다', () => {
    withoutWindow(() => {
      expect(() => removeRefreshToken()).not.toThrow();
    });
  });
});

// ── GitHub 연동 상태 ──

describe('GitHub 연동 상태', () => {
  it('기본값은 미연동', () => {
    expect(getGitHubConnected()).toBe(false);
    expect(getGitHubUsername()).toBeNull();
  });

  it('연동 상태를 저장/조회한다', () => {
    setGitHubConnected(true);
    expect(getGitHubConnected()).toBe(true);
  });

  it('사용자명을 저장/조회한다', () => {
    setGitHubUsername('octocat');
    expect(getGitHubUsername()).toBe('octocat');
  });

  it('사용자명 null이면 삭제한다', () => {
    setGitHubUsername('octocat');
    setGitHubUsername(null);
    expect(getGitHubUsername()).toBeNull();
  });

  it('SSR 환경에서 getGitHubConnected는 false를 반환한다', () => {
    withoutWindow(() => {
      expect(getGitHubConnected()).toBe(false);
    });
  });

  it('SSR 환경에서 setGitHubConnected는 아무 작업도 하지 않는다', () => {
    withoutWindow(() => {
      expect(() => setGitHubConnected(true)).not.toThrow();
    });
  });

  it('SSR 환경에서 getGitHubUsername은 null을 반환한다', () => {
    withoutWindow(() => {
      expect(getGitHubUsername()).toBeNull();
    });
  });

  it('SSR 환경에서 setGitHubUsername은 아무 작업도 하지 않는다', () => {
    withoutWindow(() => {
      expect(() => setGitHubUsername('octocat')).not.toThrow();
    });
  });
});
