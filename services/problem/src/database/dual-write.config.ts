/**
 * Dual Write 설정 — Phase 3 DB 분리
 *
 * 모드:
 * - off: 기존 DB만 사용 (기본값, 분리 전/후)
 * - expand: 양쪽 쓰기, 구 DB에서 읽기
 * - switch-read: 양쪽 쓰기, 신 DB에서 읽기
 */

export enum DualWriteMode {
  OFF = 'off',
  EXPAND = 'expand',
  SWITCH_READ = 'switch-read',
}

export function getDualWriteMode(): DualWriteMode {
  const mode = process.env['DUAL_WRITE_MODE'] ?? 'off';
  if (Object.values(DualWriteMode).includes(mode as DualWriteMode)) {
    return mode as DualWriteMode;
  }
  return DualWriteMode.OFF;
}

export const NEW_DB_CONNECTION = 'new-problem-db';
