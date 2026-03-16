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

/**
 * 간단한 문자열 해시 (djb2) — 일관된 정수 반환
 *
 * ### 충돌율 분석
 *
 * 닉네임 풀: 형용사 10 × 명사 10 = **100가지** 조합.
 * 인덱스 결정: `hash % 10`(형용사) × `floor(hash / 10) % 10`(명사).
 *
 * - 스터디 5명 → 생일 역설 기반 충돌 확률 ≈ 1 - (100!/95!) / 100^5 ≈ **9.6%**
 * - 스터디 10명 → ≈ 1 - (100!/90!) / 100^10 ≈ **36.2%**
 * - 스터디 15명 → ≈ **64.4%**
 *
 * djb2는 32비트 해시이므로 modulo 분포가 거의 균등하여 이상적 생일 역설
 * 확률과 유사합니다. 현재 스터디 규모(5~10명)에서는 충돌이 드물지만,
 * 10명 이상일 경우 닉네임 풀 확대(형용사/명사 20개 → 400조합)를 권장합니다.
 *
 * @see https://en.wikipedia.org/wiki/Birthday_problem
 */
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
