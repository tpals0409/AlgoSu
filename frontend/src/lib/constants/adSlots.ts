/**
 * @file AdSense 광고 슬롯 ID 중앙 관리
 * @domain common
 * @layer config
 *
 * ## 슬롯 ID 교체 절차
 * 1. Google AdSense 콘솔에서 새 광고 단위를 생성하고 슬롯 ID를 받는다.
 * 2. 아래 AD_SLOTS 객체에서 해당 키의 값을 새 슬롯 ID로 교체한다.
 * 3. `NEXT_PUBLIC_ADSENSE_ENABLED=true`로 설정된 환경에서 광고가 정상 노출되는지 확인한다.
 * 4. 현재 값('0000000000' 등)은 개발용 플레이스홀더이며, 프로덕션 배포 전 실제 ID로 교체 필수.
 */

export const AD_SLOTS = {
  /** 랜딩 페이지 하단 */
  LANDING_BOTTOM: '0000000000',
  /** 대시보드 하단 */
  DASHBOARD_BOTTOM: '0000000001',
  /** 문제 목록 하단 */
  PROBLEMS_LIST: '0000000002',
  /** AI 분석 결과 하단 */
  ANALYSIS_BOTTOM: '0000000003',
  /** 문제 상세 사이드바 하단 */
  PROBLEM_DETAIL: '0000000004',
  /** 제출 목록 하단 */
  SUBMISSIONS_LIST: '0000000005',
  /** 통계 차트 하단 */
  ANALYTICS_BOTTOM: '0000000006',
  /** 프로필 콘텐츠 하단 */
  PROFILE_BOTTOM: '0000000007',
  /** 스터디 목록 하단 */
  STUDIES_BOTTOM: '0000000008',
} as const;
