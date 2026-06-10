/**
 * @file 스터디 도메인 내부 인터페이스 — Identity API 응답 매핑 공유 타입
 * @domain study
 * @layer types
 * @related StudyService, StudyMemberService, StudyStatsService, StudyAccessService
 *
 * study.service.ts에서 분리된 도메인 서비스들이 공유하는 내부 타입 정의.
 * Identity 서비스의 raw 응답을 Gateway 레이어에서 안전하게 다루기 위한 구조.
 */

/** 스터디 엔티티 (Identity API 응답 매핑) */
export interface StudyData {
  id: string;
  name: string;
  description: string | null;
  github_repo: string | null;
  groundRules: string | null;
  avatar_url: string;
  status: string;
  created_by: string;
  [key: string]: unknown;
}

/** 스터디 멤버 엔티티 (Identity API 응답 매핑) */
export interface MemberData {
  id: string;
  study_id: string;
  user_id: string;
  role: string;
  nickname: string;
  username?: string;
  email?: string;
  avatar_url?: string | null;
  [key: string]: unknown;
}

/** 초대 코드 엔티티 (Identity API 응답 매핑) */
export interface InviteData {
  id: string;
  study_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  max_uses: number | null;
  used_count: number;
  study?: StudyData;
  [key: string]: unknown;
}
