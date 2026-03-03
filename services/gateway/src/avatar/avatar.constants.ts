/**
 * @file 프로필 이미지 업로드 상수 정의
 * @domain identity
 * @layer config
 * @related AvatarService, AvatarController
 */

// ─── CONSTANTS ────────────────────────────────

/** 허용 MIME 타입 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** 최대 파일 크기 (2MB) */
export const MAX_FILE_SIZE = 2 * 1024 * 1024;

/** 리사이징 크기 (px) */
export const AVATAR_SIZE = 200;

/** MinIO 버킷 이름 */
export const AVATAR_BUCKET = 'avatars';

/**
 * Magic Byte 시그니처 — 파일 확장자 위조 방어
 * JPEG: FF D8 FF
 * PNG: 89 50 4E 47
 * WebP: 52 49 46 46 (RIFF) + offset 8: 57 45 42 50 (WEBP)
 */
export const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }> = {
  'image/jpeg': { offset: 0, bytes: [0xff, 0xd8, 0xff] },
  'image/png': { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  'image/webp': { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
};

/** WebP 추가 시그니처 (offset 8) */
export const WEBP_SIGNATURE = { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] };
