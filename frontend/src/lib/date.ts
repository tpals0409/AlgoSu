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

/** locale-aware 상대 시간 레이블 맵 */
const RELATIVE_LABELS: Record<string, { justNow: string; min: string; hr: string; day: string; month: string }> = {
  ko: { justNow: '방금 전', min: '분 전', hr: '시간 전', day: '일 전', month: '개월 전' },
  en: { justNow: 'just now', min: ' min ago', hr: ' hr ago', day: ' days ago', month: ' months ago' },
};

/**
 * 상대 시간 표시 (locale 지원)
 * @param dateStr - ISO 날짜 문자열
 * @param locale - 'ko' | 'en' (기본값 'ko')
 */
export function relativeTime(dateStr: string, locale: string = 'ko'): string {
  const labels = RELATIVE_LABELS[locale] ?? RELATIVE_LABELS.en;
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return labels.justNow;
  if (minutes < 60) return `${minutes}${labels.min}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${labels.hr}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}${labels.day}`;
  return `${Math.floor(days / 30)}${labels.month}`;
}
