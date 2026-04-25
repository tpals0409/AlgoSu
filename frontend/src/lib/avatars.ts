/**
 * @file 프리셋 아바타 시스템 (키/라벨/URL 변환)
 * @domain common
 * @layer lib
 * @related ProfilePage, AppLayout
 */

export interface AvatarPreset {
  key: string;
  label: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'default', label: 'AlgoSu 로고' },
  { key: 'tree', label: '이진 트리' },
  { key: 'graph', label: '노드 그래프' },
  { key: 'stack', label: '적층 블록' },
  { key: 'queue', label: '양방향 큐' },
  { key: 'sort', label: '막대 정렬' },
  { key: 'hash', label: '해시 기호' },
  { key: 'dp', label: '격자 패턴' },
  { key: 'recursion', label: '나선형' },
  { key: 'binary', label: '01 패턴' },
  { key: 'greedy', label: '그리디' },
  { key: 'bfs', label: 'BFS' },
  { key: 'dfs', label: 'DFS' },
  { key: 'twopointer', label: '투 포인터' },
  { key: 'string', label: '문자열' },
];

export const STUDY_AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'study-default', label: '기본' },
  { key: 'study-code', label: '코드' },
  { key: 'study-review', label: '리뷰' },
  { key: 'study-challenge', label: '챌린지' },
  { key: 'study-pair', label: '페어' },
  { key: 'study-trophy', label: '트로피' },
];

const PRESET_PREFIX = 'preset:';

/** avatar_url에서 프리셋 키 추출. 비프리셋이면 'default' */
export function getAvatarPresetKey(avatarUrl: string | null | undefined): string {
  if (avatarUrl && avatarUrl.startsWith(PRESET_PREFIX)) {
    return avatarUrl.slice(PRESET_PREFIX.length);
  }
  return 'default';
}

/** 프리셋 키 → 이미지 경로 */
export function getAvatarSrc(presetKey: string): string {
  return `/avatars/${presetKey}.svg`;
}

/** 프리셋 키 → DB 저장용 문자열 */
export function toAvatarUrl(presetKey: string): string {
  return `${PRESET_PREFIX}${presetKey}`;
}
