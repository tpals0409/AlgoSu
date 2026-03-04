import * as crypto from 'crypto';

/**
 * GitHub OAuth Token AES-256-GCM 암복호화
 *
 * 형식: iv(hex):ciphertext(hex):tag(hex)
 * 키: GITHUB_TOKEN_ENCRYPTION_KEY (32바이트 hex = 64자)
 *
 * 보안:
 * - 매 암호화마다 랜덤 IV 생성 (nonce 재사용 방지)
 * - GCM auth tag로 무결성 검증
 * - 키/평문 로그 출력 금지
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 권장 96-bit

export function encryptToken(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptToken(encrypted: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const ciphertext = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
