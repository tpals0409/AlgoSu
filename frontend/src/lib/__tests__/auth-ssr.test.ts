/**
 * @jest-environment node
 */
/**
 * @file auth.ts SSR (typeof window === 'undefined') 분기 테스트
 * Node 환경에서 실행하여 window가 없는 SSR 상황을 정확히 검증
 */
import {
  removeToken,
  removeRefreshToken,
  getGitHubConnected,
  setGitHubConnected,
  getGitHubUsername,
  setGitHubUsername,
} from '@/lib/auth';

describe('auth SSR 환경 (typeof window === "undefined")', () => {
  it('removeToken은 아무 작업도 하지 않는다', () => {
    expect(() => removeToken()).not.toThrow();
  });

  it('removeRefreshToken은 아무 작업도 하지 않는다', () => {
    expect(() => removeRefreshToken()).not.toThrow();
  });

  it('getGitHubConnected는 false를 반환한다', () => {
    expect(getGitHubConnected()).toBe(false);
  });

  it('setGitHubConnected는 아무 작업도 하지 않는다', () => {
    expect(() => setGitHubConnected(true)).not.toThrow();
  });

  it('getGitHubUsername은 null을 반환한다', () => {
    expect(getGitHubUsername()).toBeNull();
  });

  it('setGitHubUsername은 아무 작업도 하지 않는다', () => {
    expect(() => setGitHubUsername('test')).not.toThrow();
  });
});
