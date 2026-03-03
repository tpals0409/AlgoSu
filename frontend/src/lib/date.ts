/**
 * @file 날짜 포맷 유틸리티 (서비스 전체 일관 형식)
 * @domain common
 * @layer lib
 * @related TimerBadge, NotifPanel
 */

/** 날짜+시간: "2026.03.01 14:30" */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${h}:${min}`;
}

/** 날짜만: "2026.03.01" */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** 짧은 날짜+시간: "03.01 14:30" */
export function formatShortDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}.${day} ${h}:${min}`;
}
