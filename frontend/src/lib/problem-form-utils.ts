/**
 * @file 문제 생성/수정 폼 공통 유틸리티
 * @domain problem
 * @layer lib
 * @related ProblemCreatePage, ProblemEditPage
 */

// ─── TYPES ────────────────────────────────

export interface ProblemFormState {
  title: string;
  description: string;
  difficulty: string;
  weekNumber: string;
  deadline: string;
  allowedLanguages: string[];
  sourceUrl: string;
  sourcePlatform: string;
}

export interface ProblemFormErrors {
  title?: string;
  weekNumber?: string;
  deadline?: string;
}

// ─── CONSTANTS ────────────────────────────

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 레이블 스타일 (text-text-2 = var(--text2), mb-[5px]) */
export const labelClass = 'block text-[11px] font-medium text-text-2 mb-[5px]';

/** Input 컴포넌트 기준 rounded-badge (6px) + currentColor 화살표 */
export const selectClass =
  'h-[40px] w-full px-3 pr-8 rounded-badge border border-border bg-input-bg text-text text-xs outline-none cursor-pointer transition-[border-color] duration-150 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 appearance-none' +
  " bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_10px_center]";

/** textarea 공통 스타일 (rounded-badge 통일) */
export const textareaClass =
  'w-full px-3 py-2 rounded-badge border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 resize-y leading-relaxed';

// ─── HELPERS ──────────────────────────────

/**
 * 현재 날짜 기준 "X월Y주차" 문자열 생성
 * @domain problem
 */
export function getCurrentWeekLabel(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const week = Math.ceil(date.getDate() / 7);
  return `${month}월${week}주차`;
}

/**
 * 선택 가능한 주차 목록 생성
 * @domain problem
 */
export function getWeekOptions(): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalWeeks = Math.ceil(lastDay / 7);
  const options: string[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    options.push(`${month}월${w}주차`);
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  options.push(`${nextMonth}월1주차`);
  return options;
}

/**
 * 주차 문자열에서 해당 주의 날짜 목록 반환
 * @domain problem
 */
export function getWeekDates(weekLabel: string): { label: string; value: string }[] {
  const match = weekLabel.match(/^(\d+)월(\d+)주차$/);
  if (!match) return [];
  const month = Number(match[1]);
  const week = Number(match[2]);
  const now = new Date();
  const year = now.getFullYear();
  const adjustedYear = month < now.getMonth() + 1 && month === 1 ? year + 1 : year;

  const startDay = (week - 1) * 7 + 1;
  const lastDay = new Date(adjustedYear, month, 0).getDate();
  const endDay = Math.min(week * 7, lastDay);

  const dates: { label: string; value: string }[] = [];
  for (let d = startDay; d <= endDay; d++) {
    const date = new Date(adjustedYear, month - 1, d, 23, 59, 59);
    const dayName = DAY_NAMES[date.getDay()];
    dates.push({
      label: `${month}월 ${d}일 (${dayName})`,
      value: date.toISOString(),
    });
  }
  return dates;
}

/**
 * 마감일을 주차 날짜와 매칭
 * @domain problem
 */
export function matchDeadlineToWeekDate(deadline: string, weekLabel: string): string {
  const weekDates = getWeekDates(weekLabel);
  const deadlineDate = new Date(deadline);
  const deadlineDay = deadlineDate.getDate();
  const matched = weekDates.find((d) => new Date(d.value).getDate() === deadlineDay);
  return matched?.value ?? '';
}

/**
 * 폼 유효성 검증
 * @domain problem
 */
export function validateProblemForm(form: ProblemFormState): ProblemFormErrors {
  const errors: ProblemFormErrors = {};
  if (!form.title.trim()) errors.title = '문제 제목을 입력해주세요.';
  if (!form.weekNumber.trim()) errors.weekNumber = '주차를 선택해주세요.';
  if (!form.deadline) errors.deadline = '마감일을 선택해주세요.';
  return errors;
}
