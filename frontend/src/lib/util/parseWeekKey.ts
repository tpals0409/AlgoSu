/**
 * @file 주차 문자열 파서 — 사용자 입력 ko 형식("1월3주차")을 정렬 가능한 정수로 변환
 * @domain analytics
 * @layer util
 * @related app/[locale]/analytics/page.tsx, app/[locale]/dashboard/page.tsx
 */

/**
 * 사용자가 문제 등록 시 입력한 주차 문자열을 정렬 가능한 정수로 변환한다.
 *
 * 형식: `{N}월{N}주차` 예) "1월3주차" → 20260103
 * 비매칭 시 0 반환.
 *
 * 현재 월 기준으로 연도를 추정하여 연도 경계(12월 → 1월) 정렬 문제를 해결한다.
 * 현재 월보다 6개월 이상 뒤의 월이면 전년도로 간주.
 *
 * NOTE: 데이터 자체가 ko 형식 사용자 입력이므로 i18n locale 분리는 백엔드
 * 데이터 모델 변경 후(Sprint 127+) 별도 작업으로 처리한다.
 */
export function parseWeekKey(w: string): number {
  const m = w.match(/^(\d+)월(\d+)주차$/);
  if (!m) return 0;
  const month = Number(m[1]);
  const week = Number(m[2]);
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const year = month > curMonth + 6 ? curYear - 1 : curYear;
  return year * 10000 + month * 100 + week;
}
