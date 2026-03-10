/**
 * @file 게스트 뷰 익명화 유틸 — userId + token 해시 기반 닉네임 생성
 * @domain share
 * @layer util
 * @related GuestContext.tsx, public-share.controller.ts
 */

const ADJECTIVES = [
  '용감한', '빠른', '조용한', '밝은', '슬기로운',
  '든든한', '재빠른', '꼼꼼한', '활기찬', '차분한',
] as const;

const NOUNS = [
  '탐험가', '항해사', '설계자', '개척자', '발명가',
  '분석가', '관찰자', '수호자', '모험가', '연구자',
] as const;

/** 간단한 문자열 해시 (djb2) — 일관된 정수 반환 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * 익명 닉네임 생성 — 동일 (userId, token) 조합은 항상 같은 결과
 * @param userId 대상 유저 ID
 * @param token 공유 링크 토큰 (스터디별 다른 닉네임)
 */
export function getAnonymousName(userId: string, token: string): string {
  const hash = hashString(`${userId}:${token}`);
  const adj = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length];
  return `${adj} ${noun}`;
}

/**
 * 실명 표시 여부 판단 — 공유 링크 생성자만 실명
 * @param userId 대상 유저 ID
 * @param createdByUserId 공유 링크 생성자 ID
 */
export function shouldShowRealName(userId: string, createdByUserId: string): boolean {
  return userId === createdByUserId;
}
