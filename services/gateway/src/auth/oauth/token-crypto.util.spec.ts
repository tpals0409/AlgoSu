import { encryptToken, decryptToken } from './token-crypto.util';
import * as crypto from 'crypto';

describe('token-crypto.util', () => {
  // 32바이트 = 64 hex chars
  const VALID_KEY = crypto.randomBytes(32).toString('hex');
  const PLAINTEXT = 'gho_testGitHubOAuthToken123456';

  describe('encryptToken', () => {
    it('암호화된 문자열을 iv:ciphertext:tag 형식으로 반환', () => {
      const encrypted = encryptToken(PLAINTEXT, VALID_KEY);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      // IV: 12바이트 = 24 hex chars
      expect(parts[0]).toHaveLength(24);
      // ciphertext: 비어있지 않음
      expect(parts[1].length).toBeGreaterThan(0);
      // auth tag: 16바이트 = 32 hex chars
      expect(parts[2]).toHaveLength(32);
    });

    it('같은 평문이라도 매번 다른 IV로 다른 결과 생성', () => {
      const a = encryptToken(PLAINTEXT, VALID_KEY);
      const b = encryptToken(PLAINTEXT, VALID_KEY);

      expect(a).not.toBe(b);
    });

    it('키가 32바이트가 아니면 에러', () => {
      const shortKey = crypto.randomBytes(16).toString('hex'); // 16바이트

      expect(() => encryptToken(PLAINTEXT, shortKey)).toThrow(
        'GITHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)',
      );
    });
  });

  describe('decryptToken', () => {
    it('암호화한 토큰을 정상 복호화', () => {
      const encrypted = encryptToken(PLAINTEXT, VALID_KEY);
      const decrypted = decryptToken(encrypted, VALID_KEY);

      expect(decrypted).toBe(PLAINTEXT);
    });

    it('다른 키로 복호화 시도 → 에러', () => {
      const encrypted = encryptToken(PLAINTEXT, VALID_KEY);
      const otherKey = crypto.randomBytes(32).toString('hex');

      expect(() => decryptToken(encrypted, otherKey)).toThrow();
    });

    it('키가 32바이트가 아니면 에러', () => {
      const encrypted = encryptToken(PLAINTEXT, VALID_KEY);
      const shortKey = crypto.randomBytes(16).toString('hex');

      expect(() => decryptToken(encrypted, shortKey)).toThrow(
        'GITHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)',
      );
    });

    it('형식이 잘못된 문자열 → 에러', () => {
      expect(() => decryptToken('invalid-format', VALID_KEY)).toThrow(
        'Invalid encrypted token format',
      );
      expect(() => decryptToken('a:b', VALID_KEY)).toThrow(
        'Invalid encrypted token format',
      );
      expect(() => decryptToken('a:b:c:d', VALID_KEY)).toThrow(
        'Invalid encrypted token format',
      );
    });

    it('변조된 ciphertext → 복호화 실패', () => {
      const encrypted = encryptToken(PLAINTEXT, VALID_KEY);
      const parts = encrypted.split(':');
      // ciphertext를 변조
      parts[1] = '00'.repeat(parts[1].length / 2);
      const tampered = parts.join(':');

      expect(() => decryptToken(tampered, VALID_KEY)).toThrow();
    });

    it('빈 문자열 암호화/복호화 라운드트립', () => {
      const encrypted = encryptToken('', VALID_KEY);
      const decrypted = decryptToken(encrypted, VALID_KEY);

      expect(decrypted).toBe('');
    });
  });
});
