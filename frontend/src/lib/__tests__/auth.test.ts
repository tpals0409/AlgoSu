/**
 * @file auth.ts 단위 테스트
 */
import {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  setToken,
  getToken,
  removeToken,
  isAuthenticated,
  isTokenExpired,
  getTokenTtlMs,
  setRefreshToken,
  getRefreshToken,
  removeRefreshToken,
  decodeTokenPayload,
  getCurrentUserId,
  getCurrentUserEmail,
  getCurrentUserName,
  getCurrentOAuthProvider,
  getGitHubConnected,
  setGitHubConnected,
  getGitHubUsername,
  setGitHubUsername,
} from '@/lib/auth';

// JWT 테스트 토큰 생성 헬퍼 (한글 등 유니코드 안전)
function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>): string =>
    Buffer.from(JSON.stringify(obj), 'utf-8').toString('base64');
  const header = encode({ alg: 'HS256', typ: 'JWT' } as Record<string, unknown>);
  const body = encode(payload);
  return `${header}.${body}.fake-signature`;
}

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

// ── 토큰 저장/조회/삭제 ──

describe('setToken / getToken / removeToken', () => {
  it('토큰을 저장하고 조회한다', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc123');
  });

  it('토큰을 삭제한다', () => {
    setToken('abc123');
    removeToken();
    expect(getToken()).toBeNull();
  });

  it('SSR 환경에서 setToken은 아무 작업도 하지 않는다', () => {
    withoutWindow(() => {
      expect(() => setToken('test')).not.toThrow();
    });
  });

  it('SSR 환경에서 getToken은 null을 반환한다', () => {
    withoutWindow(() => {
      expect(getToken()).toBeNull();
    });
  });

  it('SSR 환경에서 removeToken은 아무 작업도 하지 않는다', () => {
    withoutWindow(() => {
      expect(() => removeToken()).not.toThrow();
    });
  });
});

// ── Refresh 토큰 ──

describe('setRefreshToken / getRefreshToken / removeRefreshToken', () => {
  it('리프레시 토큰을 저장하고 조회한다', () => {
    setRefreshToken('refresh-abc');
    expect(getRefreshToken()).toBe('refresh-abc');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-abc');
  });

  it('리프레시 토큰을 삭제한다', () => {
    setRefreshToken('refresh-abc');
    removeRefreshToken();
    expect(getRefreshToken()).toBeNull();
  });

  it('SSR 환경에서 setRefreshToken은 아무 작업도 하지 않는다', () => {
    withoutWindow(() => {
      expect(() => setRefreshToken('test')).not.toThrow();
    });
  });

  it('SSR 환경에서 getRefreshToken은 null을 반환한다', () => {
    withoutWindow(() => {
      expect(getRefreshToken()).toBeNull();
    });
  });

  it('SSR 환경에서 removeRefreshToken은 아무 작업도 하지 않는다', () => {
    withoutWindow(() => {
      expect(() => removeRefreshToken()).not.toThrow();
    });
  });
});

// ── isAuthenticated ──

describe('isAuthenticated', () => {
  it('토큰이 있으면 true', () => {
    setToken('token');
    expect(isAuthenticated()).toBe(true);
  });

  it('토큰이 없으면 false', () => {
    expect(isAuthenticated()).toBe(false);
  });
});

// ── decodeTokenPayload ──

describe('decodeTokenPayload', () => {
  it('유효한 JWT payload를 디코딩한다', () => {
    const token = makeJwt({ sub: 'user-1', email: 'test@example.com' });
    const payload = decodeTokenPayload(token);
    expect(payload).toEqual({ sub: 'user-1', email: 'test@example.com' });
  });

  it('파트가 3개가 아닌 문자열은 null 반환', () => {
    expect(decodeTokenPayload('invalid')).toBeNull();
    expect(decodeTokenPayload('a.b')).toBeNull();
  });

  it('잘못된 base64는 null 반환', () => {
    expect(decodeTokenPayload('a.!!!.c')).toBeNull();
  });
});

// ── isTokenExpired ──

describe('isTokenExpired', () => {
  it('토큰이 없으면 만료 처리', () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired(undefined)).toBe(true);
  });

  it('exp가 없으면 만료 처리', () => {
    const token = makeJwt({ sub: 'user-1' });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('미래 exp면 만료되지 않음', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJwt({ exp: futureExp });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('과거 exp면 만료 처리', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 100;
    const token = makeJwt({ exp: pastExp });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('10초 이내 만료 예정이면 만료 처리', () => {
    const almostExpired = Math.floor(Date.now() / 1000) + 5;
    const token = makeJwt({ exp: almostExpired });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('인자 없으면 localStorage 토큰 사용', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setToken(makeJwt({ exp: futureExp }));
    expect(isTokenExpired()).toBe(false);
  });
});

// ── getTokenTtlMs ──

describe('getTokenTtlMs', () => {
  it('토큰이 없으면 0', () => {
    expect(getTokenTtlMs(null)).toBe(0);
  });

  it('만료된 토큰은 0', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 100;
    expect(getTokenTtlMs(makeJwt({ exp: pastExp }))).toBe(0);
  });

  it('유효한 토큰은 양수 반환', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const ttl = getTokenTtlMs(makeJwt({ exp: futureExp }));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600 * 1000);
  });

  it('인자 없으면 localStorage 토큰 사용', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    setToken(makeJwt({ exp: futureExp }));
    const ttl = getTokenTtlMs();
    expect(ttl).toBeGreaterThan(0);
  });

  it('exp가 없으면 0 반환', () => {
    expect(getTokenTtlMs(makeJwt({ sub: 'user' }))).toBe(0);
  });

  it('exp가 숫자가 아니면 0 반환', () => {
    expect(getTokenTtlMs(makeJwt({ exp: 'not-a-number' }))).toBe(0);
  });

  it('localStorage 토큰도 없으면 0', () => {
    expect(getTokenTtlMs()).toBe(0);
  });
});

// ── 사용자 정보 추출 ──

describe('getCurrentUserId', () => {
  it('sub 클레임을 반환한다', () => {
    setToken(makeJwt({ sub: 'user-42' }));
    expect(getCurrentUserId()).toBe('user-42');
  });

  it('토큰이 없으면 null', () => {
    expect(getCurrentUserId()).toBeNull();
  });

  it('sub이 문자열이 아니면 null 반환', () => {
    setToken(makeJwt({ sub: 12345 }));
    expect(getCurrentUserId()).toBeNull();
  });

  it('디코딩 불가 토큰이면 null 반환', () => {
    localStorage.setItem(TOKEN_KEY, 'invalid.token.payload');
    expect(getCurrentUserId()).toBeNull();
  });
});

describe('getCurrentUserEmail', () => {
  it('email 클레임을 반환한다', () => {
    setToken(makeJwt({ email: 'test@example.com' }));
    expect(getCurrentUserEmail()).toBe('test@example.com');
  });

  it('email이 없으면 null', () => {
    setToken(makeJwt({ sub: 'user-1' }));
    expect(getCurrentUserEmail()).toBeNull();
  });

  it('토큰이 없으면 null', () => {
    expect(getCurrentUserEmail()).toBeNull();
  });

  it('email이 문자열이 아니면 null 반환', () => {
    setToken(makeJwt({ email: 42 }));
    expect(getCurrentUserEmail()).toBeNull();
  });
});

describe('getCurrentUserName', () => {
  it('name 클레임을 반환한다', () => {
    setToken(makeJwt({ name: 'John Doe' }));
    expect(getCurrentUserName()).toBe('John Doe');
  });

  it('토큰이 없으면 null', () => {
    expect(getCurrentUserName()).toBeNull();
  });

  it('name이 문자열이 아니면 null 반환', () => {
    setToken(makeJwt({ name: 100 }));
    expect(getCurrentUserName()).toBeNull();
  });
});

describe('getCurrentOAuthProvider', () => {
  it('oauth_provider 클레임을 반환한다', () => {
    setToken(makeJwt({ oauth_provider: 'google' }));
    expect(getCurrentOAuthProvider()).toBe('google');
  });

  it('토큰이 없으면 null', () => {
    expect(getCurrentOAuthProvider()).toBeNull();
  });

  it('oauth_provider가 문자열이 아니면 null 반환', () => {
    setToken(makeJwt({ oauth_provider: true }));
    expect(getCurrentOAuthProvider()).toBeNull();
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
