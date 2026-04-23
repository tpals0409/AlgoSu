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
