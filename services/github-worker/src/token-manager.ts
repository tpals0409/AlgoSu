/**
 * @file GitHub App Token 관리 + 유저 토큰 AES-256-GCM 복호화
 * @domain github
 * @layer service
 * @related worker.ts, github-push.service.ts, config.ts
 */
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { logger } from './logger';
import { config } from './config';

/**
 * GitHub App Installation Token 관리 — 레포별 동적 발급
 *
 * 갱신 전략:
 * - Redis 캐시 (TTL 3600s)
 * - 50분마다 전체 캐시 갱신
 * - Redis miss 시 즉시 재발급 fallback
 *
 * 보안:
 * - GitHub App Private Key는 환경변수에서만 참조
 * - 토큰을 로그에 절대 출력 금지
 * - 레포 정보를 로그에 출력 금지
 * - Redis 키: github:app:token:{owner}/{repo} (TTL 3600s 필수)
 */

export class TokenManager {
  private redis: Redis;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.redis = new Redis(config.redisUrl);

    // GITHUB_TOKEN_REFRESH_INTERVAL ms마다 캐시된 모든 토큰 갱신 (기본 50분)
    this.refreshTimer = setInterval(() => {
      void this.refreshAllCachedTokens();
    }, config.githubTokenRefreshInterval);
  }

  /**
   * 레포별 Installation Token 조회
   * 캐시 우선 → 동적 재발급 fallback
   */
  async getTokenForRepo(owner: string, repo: string): Promise<string> {
    const cacheKey = `github:app:token:${owner}/${repo}`;

    // Redis 캐시 확인
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    // 캐시 미스 → 즉시 재발급
    return this.fetchAndCacheToken(owner, repo);
  }

  /**
   * GitHub App API로 레포의 Installation ID 동적 조회 후 토큰 발급
   */
  private async fetchAndCacheToken(owner: string, repo: string): Promise<string> {
    const appId = config.githubAppId;
    const privateKeyBase64 = config.githubAppPrivateKeyBase64;

    if (!appId || !privateKeyBase64) {
      throw new Error('GitHub App 환경변수가 설정되지 않았습니다 (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_BASE64).');
    }

    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

    const { createAppAuth } = await import('@octokit/auth-app');

    // App 수준 JWT 생성 (Installation ID 조회용)
    const appAuth = createAppAuth({ appId: parseInt(appId, 10), privateKey });
    const { token: appJwt } = await appAuth({ type: 'app' });

    // GET /repos/{owner}/{repo}/installation → installation_id 획득
    const installationRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/installation`,
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (installationRes.status === 404) {
      // 레포에 GitHub App 미설치
      throw new Error('TOKEN_INVALID: GitHub App이 해당 레포에 설치되어 있지 않습니다.');
    }

    if (!installationRes.ok) {
      throw new Error(`Installation 조회 실패: ${installationRes.status}`);
    }

    const installation = (await installationRes.json()) as { id: number };
    const installationId = installation.id;

    // POST /app/installations/{installation_id}/access_tokens
    const tokenRes = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!tokenRes.ok) {
      throw new Error(`Installation Token 발급 실패: ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as { token: string };
    const token = tokenData.token;

    // Redis 캐시 저장 (레포별 키, TTL 필수)
    const cacheKey = `github:app:token:${owner}/${repo}`;
    await this.redis.set(cacheKey, token, 'EX', config.githubTokenTtl);

    // 보안: 토큰 원문 출력 금지, 레포 정보 출력 금지
    logger.info('Installation Token 갱신 완료', { action: 'TOKEN_REFRESH' });

    return token;
  }

  /**
   * 캐시된 모든 레포 토큰 갱신 (50분 주기)
   */
  private async refreshAllCachedTokens(): Promise<void> {
    try {
      const keys = await this.redis.keys('github:app:token:*');
      for (const key of keys) {
        // key 형식: github:app:token:{owner}/{repo}
        const repoPath = key.replace('github:app:token:', '');
        const slashIdx = repoPath.indexOf('/');
        if (slashIdx === -1) continue;

        const owner = repoPath.slice(0, slashIdx);
        const repo = repoPath.slice(slashIdx + 1);

        await this.fetchAndCacheToken(owner, repo).catch(() => {
          // 개별 갱신 실패는 무시 — 다음 getTokenForRepo 호출 시 재시도
        });
      }
    } catch {
      // 갱신 실패는 무시
    }
  }

  /**
   * 유저 GitHub OAuth 토큰 복호화
   * Gateway에서 AES-256-GCM으로 암호화된 토큰을 복호화
   * 형식: iv(hex):ciphertext(hex):tag(hex)
   */
  decryptUserToken(encrypted: string): string {
    const keyHex = config.githubTokenEncryptionKey;
    const key = Buffer.from(keyHex, 'hex');

    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const ciphertext = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  async close(): Promise<void> {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    await this.redis.quit();
  }
}
