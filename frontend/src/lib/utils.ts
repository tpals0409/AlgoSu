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

/** 현재 날짜 기준 "X월Y주차" 문자열 생성 */
export function getCurrentWeekLabel(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const week = Math.ceil(date.getDate() / 7);
  return `${month}월${week}주차`;
}
