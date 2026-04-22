/**
 * @file TokenEncryptionService 유닛 테스트
 * @domain identity
 * @layer service
 * @related token-encryption.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenEncryptionService } from './token-encryption.service';

/** 테스트용 32바이트(64자) hex 키 */
const TEST_KEY_HEX = 'a'.repeat(64);

const makeModule = async (keyHex: string): Promise<TokenEncryptionService> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TokenEncryptionService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, defaultVal = '') =>
            key === 'GITHUB_TOKEN_ENCRYPTION_KEY' ? keyHex : defaultVal,
          ),
        },
      },
    ],
  }).compile();
  return module.get(TokenEncryptionService);
};

describe('TokenEncryptionService', () => {
  let service: TokenEncryptionService;

  beforeEach(async () => {
    service = await makeModule(TEST_KEY_HEX);
  });

  // ─── encrypt ──────────────────────────────────────────────────
  describe('encrypt', () => {
    it('iv:ciphertext:tag 형식을 반환한다', () => {
      const result = service.encrypt('ghp_testtoken');
      const parts = result.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]+$/i); // iv
      expect(parts[1]).toMatch(/^[0-9a-f]+$/i); // ciphertext
      expect(parts[2]).toMatch(/^[0-9a-f]+$/i); // auth tag
    });

    it('동일 평문도 호출 시마다 다른 IV(랜덤)로 암호화된다 (IND-CPA)', () => {
      const enc1 = service.encrypt('ghp_sametoken');
      const enc2 = service.encrypt('ghp_sametoken');

      expect(enc1).not.toBe(enc2);
    });

    it('IV는 12바이트(24 hex chars)이다', () => {
      const iv = service.encrypt('ghp_testtoken').split(':')[0];
      expect(iv).toHaveLength(24);
    });

    it('Auth Tag는 16바이트(32 hex chars)이다', () => {
      const tag = service.encrypt('ghp_testtoken').split(':')[2];
      expect(tag).toHaveLength(32);
    });
  });

  // ─── isEncryptedFormat ────────────────────────────────────────
  describe('isEncryptedFormat', () => {
    it('encrypt 결과를 true로 판별한다', () => {
      const encrypted = service.encrypt('ghp_testtoken');
      expect(service.isEncryptedFormat(encrypted)).toBe(true);
    });

    it('평문 토큰을 false로 판별한다', () => {
      expect(service.isEncryptedFormat('ghp_plaintexttoken123')).toBe(false);
    });

    it('파트가 2개이면 false', () => {
      expect(service.isEncryptedFormat('aabbcc:ddeeff')).toBe(false);
    });

    it('파트가 4개이면 false', () => {
      expect(service.isEncryptedFormat('aa:bb:cc:dd')).toBe(false);
    });

    it('비-hex 문자가 포함되면 false', () => {
      expect(service.isEncryptedFormat('zz:aabb:ccdd')).toBe(false);
    });
  });

  // ─── 프로덕션 키 검증 ─────────────────────────────────────────
  describe('생성자 키 검증', () => {
    it('test 환경에서는 빈 키로 초기화 허용된다', async () => {
      // NODE_ENV=test이므로 예외 없이 생성되어야 함
      await expect(makeModule('')).resolves.toBeDefined();
    });

    it('프로덕션 환경에서 빈 키로 초기화 시 에러를 던진다', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      try {
        await expect(makeModule('')).rejects.toThrow(
          'GITHUB_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)',
        );
      } finally {
        process.env['NODE_ENV'] = originalEnv;
      }
    });

    it('프로덕션 환경에서 64자 미만 키로 초기화 시 에러를 던진다', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      try {
        await expect(makeModule('aabb')).rejects.toThrow(
          'GITHUB_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)',
        );
      } finally {
        process.env['NODE_ENV'] = originalEnv;
      }
    });
  });
});
