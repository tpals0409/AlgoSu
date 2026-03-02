/**
 * AlgoSu 프리셋 아바타 시스템
 *
 * DB avatar_url 형식: "preset:tree" | "preset:default" | null
 * SVG 에셋: /avatars/{key}.svg (정적 서빙)
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
