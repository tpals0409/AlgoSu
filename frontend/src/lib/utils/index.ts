/**
 * @file Tailwind CSS 클래스 병합 유틸리티
 * @domain common
 * @layer lib
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind CSS 클래스 병합 유틸리티.
 * clsx로 조건부 클래스를 처리하고 twMerge로 충돌을 해결합니다.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 현재 날짜 기준 "X월Y주차" 문자열 생성 (달력 기준).
 *
 * 달력 기준 주차 계산:
 * - 매월 1일이 속한 주가 1주차입니다.
 * - 일요일을 주의 시작(0)으로 보며, 1일의 요일 오프셋을 더한 뒤 7로 나눈 올림값을 사용합니다.
 * - 예: 2026-04-20(월)은 2026-04-01(수, 요일=3) 기준 ceil((20+3)/7)=4 → "4월4주차".
 *
 * @param date 기준 날짜 (미지정 시 현재 시간)
 * @returns "M월W주차" 형식 문자열
 */
export function getCurrentWeekLabel(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const firstDayOfWeek = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const week = Math.ceil((date.getDate() + firstDayOfWeek) / 7);
  return `${month}월${week}주차`;
}

/** D-day 계산 결과 */
export interface DDayResult {
  /** 마감일까지 남은 캘린더 일수. 마감 당일=0, 지난 경우 음수. */
  readonly days: number;
  /** 마감일이 이미 지났는지 여부 (days < 0). */
  readonly expired: boolean;
}

/**
 * 문제 풀이 마감일까지 남은 D-day를 캘린더 일수 기준으로 계산.
 *
 * 마감일은 해당 일자의 23:59:59로 저장되므로, 시각(시/분/초)을 무시하고
 * 날짜만 비교한다. 따라서 마감 당일이면 days=0(D-Day), 하루 전이면 days=1(D-1)이며,
 * 남은 밀리초를 올림하던 기존 방식의 +1일 오차(마감 당일에 D-1 표시)를 제거한다.
 *
 * @param deadline 마감일 (ISO 문자열 또는 Date)
 * @param now 기준 시각 (미지정 시 현재 시간)
 * @returns 남은 일수와 만료 여부
 */
export function calcDDay(deadline: string | Date, now: Date = new Date()): DDayResult {
  const dl = new Date(deadline);
  const dlMidnight = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((dlMidnight.getTime() - nowMidnight.getTime()) / 86400000);
  return { days, expired: days < 0 };
}
