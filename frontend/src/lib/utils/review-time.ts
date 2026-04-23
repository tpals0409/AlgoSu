/**
 * @file 리뷰 상대 시간 포맷팅 공유 유틸
 * @domain review
 * @layer lib
 * @related CommentThread, ReplyItem
 *
 * Critic M-1/M-2 해결: CommentThread + ReplyItem에 복붙된
 * tTime 래퍼 및 formatRelativeTime 로직을 단일 소스로 통합.
 *
 * - createTimeTranslator: reviews.time.* 키를 안전하게 호출하는 래퍼
 * - formatReviewRelativeTime: 5-branch 상대 시간 변환 (방금/분/시간/일/절대)
 */

import type { TranslationValues } from 'use-intl/core';

// ─── TYPES ────────────────────────────────

/** reviews.time 네임스페이스의 허용 키 */
type TimeKey = 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo';

/** reviews 네임스페이스 t 함수 — next-intl useTranslations('reviews') 반환 타입 */
type ReviewTranslatorFn = (key: string, values?: TranslationValues) => string;

/** createTimeTranslator가 반환하는 시간 전용 번역 함수 */
export type TimeTranslatorFn = (key: TimeKey, values?: TranslationValues) => string;

// ─── PUBLIC API ──────────────────────────

/**
 * reviews 네임스페이스 번역 함수를 time.* 서브키 전용 translator로 래핑.
 *
 * 기존 패턴:
 * ```ts
 * const tTime = (key: string, values?: Record<string, number>) =>
 *   t(`time.${key}` as Parameters<typeof t>[0], values as never);
 * ```
 * → `as Parameters<typeof t>[0]` / `as never` 타입 우회 제거.
 *   TimeKey 유니온으로 키를 제한하여 컴파일 타임 안전성 확보.
 *
 * @param t - useTranslations('reviews') 반환값
 * @returns time.* 키 전용 번역 함수
 */
export function createTimeTranslator(t: ReviewTranslatorFn): TimeTranslatorFn {
  return (key: TimeKey, values?: TranslationValues): string =>
    t(`time.${key}`, values);
}

/**
 * ISO 날짜를 상대 시간 문자열로 변환.
 *
 * 분기 로직:
 * - < 1분: "방금" (justNow)
 * - < 60분: "N분 전" (minutesAgo)
 * - < 24시간: "N시간 전" (hoursAgo)
 * - < 7일: "N일 전" (daysAgo)
 * - >= 7일: locale-aware 절대 날짜 (toLocaleDateString)
 *
 * @param iso - ISO 8601 날짜 문자열
 * @param tTime - createTimeTranslator가 반환한 번역 함수
 * @param locale - 현재 로케일 (절대 날짜 포맷용)
 */
export function formatReviewRelativeTime(
  iso: string,
  tTime: TimeTranslatorFn,
  locale: string,
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return tTime('justNow');
  if (minutes < 60) return tTime('minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tTime('hoursAgo', { hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return tTime('daysAgo', { days });
  return new Date(iso).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
}
