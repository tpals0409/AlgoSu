/**
 * @file avatars.ts 단위 테스트
 */
import {
  AVATAR_PRESETS,
  STUDY_AVATAR_PRESETS,
  getAvatarPresetKey,
  getAvatarSrc,
  toAvatarUrl,
} from '@/lib/avatars';

describe('AVATAR_PRESETS', () => {
  it('15개의 프리셋이 존재한다', () => {
    expect(AVATAR_PRESETS).toHaveLength(15);
  });

  it('각 프리셋에 key와 label이 있다', () => {
    for (const preset of AVATAR_PRESETS) {
      expect(preset.key).toBeTruthy();
      expect(preset.label).toBeTruthy();
    }
  });

  it('default 프리셋이 첫 번째이다', () => {
    expect(AVATAR_PRESETS[0].key).toBe('default');
  });
});

describe('STUDY_AVATAR_PRESETS', () => {
  it('6개의 스터디 프리셋이 존재한다', () => {
    expect(STUDY_AVATAR_PRESETS).toHaveLength(6);
  });

  it('각 프리셋에 key와 label이 있다', () => {
    for (const preset of STUDY_AVATAR_PRESETS) {
      expect(preset.key).toBeTruthy();
      expect(preset.label).toBeTruthy();
    }
  });

  it('study-default 프리셋이 첫 번째이다', () => {
    expect(STUDY_AVATAR_PRESETS[0].key).toBe('study-default');
  });
});

describe('getAvatarPresetKey', () => {
  it('preset: 접두사가 있으면 키를 추출한다', () => {
    expect(getAvatarPresetKey('preset:tree')).toBe('tree');
    expect(getAvatarPresetKey('preset:graph')).toBe('graph');
  });

  it('null이면 default 반환', () => {
    expect(getAvatarPresetKey(null)).toBe('default');
  });

  it('undefined이면 default 반환', () => {
    expect(getAvatarPresetKey(undefined)).toBe('default');
  });

  it('접두사가 없는 문자열이면 default 반환', () => {
    expect(getAvatarPresetKey('https://example.com/avatar.png')).toBe('default');
  });

  it('빈 문자열이면 default 반환', () => {
    expect(getAvatarPresetKey('')).toBe('default');
  });
});

describe('getAvatarSrc', () => {
  it('프리셋 키를 SVG 경로로 변환한다', () => {
    expect(getAvatarSrc('default')).toBe('/avatars/default.svg');
    expect(getAvatarSrc('tree')).toBe('/avatars/tree.svg');
    expect(getAvatarSrc('dp')).toBe('/avatars/dp.svg');
  });

  it('스터디 프리셋 키를 SVG 경로로 변환한다', () => {
    expect(getAvatarSrc('study-default')).toBe('/avatars/study-default.svg');
    expect(getAvatarSrc('study-code')).toBe('/avatars/study-code.svg');
  });
});

describe('toAvatarUrl', () => {
  it('프리셋 키를 DB 저장용 문자열로 변환한다', () => {
    expect(toAvatarUrl('tree')).toBe('preset:tree');
    expect(toAvatarUrl('default')).toBe('preset:default');
  });

  it('스터디 프리셋 키를 DB 저장용 문자열로 변환한다', () => {
    expect(toAvatarUrl('study-default')).toBe('preset:study-default');
    expect(toAvatarUrl('study-trophy')).toBe('preset:study-trophy');
  });
});

describe('getAvatarPresetKey - 스터디 아바타', () => {
  it('스터디 프리셋 접두사를 올바르게 추출한다', () => {
    expect(getAvatarPresetKey('preset:study-default')).toBe('study-default');
    expect(getAvatarPresetKey('preset:study-code')).toBe('study-code');
  });
});
