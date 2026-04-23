/**
 * @file GitHub 토큰 암호화 서비스 — AES-256-GCM 대칭 암호화
 * @domain identity
 * @layer service
 * @related user.service.ts, github-worker/src/token-manager.ts
 *
 * 보안 요구사항 (P0 감사 지적 — audit-20260422-p0-009):
 * - GitHub 토큰은 DB 저장 전 반드시 암호화
 * - 암호화 키: GITHUB_TOKEN_ENCRYPTION_KEY (32바이트 hex, 64자)
 * - 저장 형식: iv(hex):ciphertext(hex):tag(hex)
 * - 복호화는 github-worker TokenManager.decryptUserToken()에서만 수행
 */
import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** AES-256-GCM IV 길이 (12바이트 = 96비트, GCM 권장값) */
const IV_BYTE_LENGTH = 12;

/** 암호화 형식 검증 정규식: hex:hex:hex */
const ENCRYPTED_FORMAT_REGEX = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyHex = this.configService.get<string>('GITHUB_TOKEN_ENCRYPTION_KEY', '');

    if (process.env['NODE_ENV'] !== 'test' && (!keyHex || keyHex.length !== 64)) {
      throw new Error(
        'GITHUB_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)',
      );
    }

    // test 환경에서는 빈 키 허용 (테스트에서 mock 처리)
    this.key = keyHex.length === 64
      ? Buffer.from(keyHex, 'hex')
      : Buffer.alloc(32);
  }

  /**
   * GitHub 토큰을 AES-256-GCM으로 암호화
   *
   * 매 호출 시 랜덤 IV를 생성하므로 동일 평문도 다른 암호문 출력 (IND-CPA 보장)
   * @param plaintext 평문 GitHub 토큰
   * @returns iv:ciphertext:tag (모두 hex 인코딩, ':' 구분자)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_BYTE_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      iv.toString('hex'),
      ciphertext.toString('hex'),
      tag.toString('hex'),
    ].join(':');
  }

  /**
   * 값이 암호화 형식(iv:ciphertext:tag)인지 검증
   *
   * 기존 평문 토큰 vs 암호화된 토큰 구분에 사용
   * @param value 검증할 문자열
   * @returns true이면 암호화된 형식
   */
  isEncryptedFormat(value: string): boolean {
    return ENCRYPTED_FORMAT_REGEX.test(value);
  }
}
