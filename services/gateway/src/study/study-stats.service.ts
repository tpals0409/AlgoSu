/**
 * @file 스터디 통계 — Submission/Problem 내부 API 집계 조회
 * @domain study
 * @layer service
 * @related StudyController, IdentityClientService, SubmissionService
 *
 * 스터디 통계는 Submission Service 내부 API를 호출해 집계하고,
 * Problem Service에서 활성 문제 ID(DELETED 제외)를 받아 집계 대상을 한정한다.
 * 멤버 닉네임 매핑은 Identity 멤버 목록과 조인한다.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import type { MemberData } from './study.types';

@Injectable()
export class StudyStatsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    private readonly identityClient: IdentityClientService,
  ) {
    this.logger.setContext(StudyStatsService.name);
  }

  /**
   * 스터디 통계 조회 (Submission Service 내부 API 호출)
   * @domain study
   * @api GET /studies/:id/stats
   * @guard study-member
   * @param studyId - 스터디 ID
   * @param userId - 요청 사용자 ID
   * @param weekNumber - 주차 필터 (선택)
   */
  async getStudyStats(studyId: string, userId: string, weekNumber?: string) {
    // 통계 대상 문제 ID 조회 — DELETED 문제만 집계에서 제외
    const activeProblemIds = await this.fetchActiveProblemIds(studyId);

    const data = await this.fetchSubmissionStats(studyId, userId, weekNumber, activeProblemIds);

    // 멤버 이름 매핑: byMember의 userId를 멤버 목록과 매칭
    const members = await this.identityClient.getMembers(studyId) as MemberData[];
    const memberMap = new Map(members.map((m) => [m.user_id, m]));

    return this.mapStatsWithMembers(data, memberMap);
  }

  /**
   * Submission Service 내부 통계 API 호출 + 응답 파싱
   * @param studyId - 스터디 ID
   * @param userId - 요청 사용자 ID
   * @param weekNumber - 주차 필터 (선택)
   * @param activeProblemIds - 집계 대상 문제 ID (선택)
   */
  private async fetchSubmissionStats(
    studyId: string,
    userId: string,
    weekNumber: string | undefined,
    activeProblemIds: string[] | undefined,
  ): Promise<StatsData> {
    const submissionServiceUrl = this.configService.getOrThrow<string>('SUBMISSION_SERVICE_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');

    const params = new URLSearchParams();
    if (weekNumber) params.set('weekNumber', weekNumber);
    params.set('userId', userId);
    if (activeProblemIds) {
      params.set('activeProblemIds', activeProblemIds.join(','));
    }
    const qs = `?${params.toString()}`;
    const response = await fetch(
      `${submissionServiceUrl}/internal/stats/${studyId}${qs}`,
      {
        method: 'GET',
        headers: {
          'x-internal-key': internalKey,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      this.logger.error(`통계 조회 실패: studyId=${studyId}, status=${response.status}`);
      throw new NotFoundException('통계 데이터를 조회할 수 없습니다.');
    }

    const result = (await response.json()) as { data: unknown };
    return result.data as StatsData;
  }

  /**
   * 통계 raw 데이터에 멤버 닉네임/멤버 여부를 매핑
   * @param data - Submission 통계 raw 데이터
   * @param memberMap - userId → 멤버 매핑
   */
  private mapStatsWithMembers(data: StatsData, memberMap: Map<string, MemberData>) {
    const mapMemberInfo = (m: StatsByMember) => ({
      userId: m.userId,
      isMember: memberMap.has(m.userId),
      nickname: memberMap.get(m.userId)?.nickname ?? null,
      count: m.count,
      doneCount: m.doneCount,
      uniqueProblemCount: m.uniqueProblemCount,
      uniqueDoneCount: m.uniqueDoneCount,
    });

    return {
      totalSubmissions: data.totalSubmissions,
      uniqueSubmissions: data.uniqueSubmissions ?? 0,
      uniqueAnalyzed: data.uniqueAnalyzed ?? 0,
      byWeek: data.byWeek,
      byWeekPerUser: data.byWeekPerUser,
      byMember: data.byMember.map(mapMemberInfo),
      byMemberWeek: data.byMemberWeek?.map((m) => ({
        userId: m.userId,
        isMember: memberMap.has(m.userId),
        nickname: memberMap.get(m.userId)?.nickname ?? null,
        count: m.count,
      })) ?? null,
      recentSubmissions: (data.recentSubmissions as { userId: string; [key: string]: unknown }[]).map((s) => ({
        ...s,
        nickname: memberMap.get(s.userId)?.nickname ?? null,
      })),
      solvedProblemIds: data.solvedProblemIds ?? [],
      userSubmissions: data.userSubmissions ?? [],
      submitterCountByProblem: data.submitterCountByProblem ?? [],
    };
  }

  /**
   * Problem Service에서 통계 대상 문제 ID 목록 조회 (ACTIVE + CLOSED, DELETED 제외)
   * 실패 시 undefined 반환 (기존 동작 유지 — 전체 집계)
   * @param studyId - 스터디 ID
   */
  private async fetchActiveProblemIds(studyId: string): Promise<string[] | undefined> {
    try {
      const problemServiceUrl = this.configService.getOrThrow<string>('PROBLEM_SERVICE_URL');
      const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_PROBLEM');

      const response = await fetch(
        `${problemServiceUrl}/internal/active-ids/${studyId}`,
        {
          method: 'GET',
          headers: {
            'x-internal-key': internalKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`통계 대상 문제 ID 조회 실패: studyId=${studyId}, status=${response.status}`);
        return undefined;
      }

      const result = (await response.json()) as { data: string[] };
      return result.data;
    } catch (error: unknown) {
      this.logger.warn(`통계 대상 문제 ID 조회 오류: studyId=${studyId}, ${(error as Error).message}`);
      return undefined;
    }
  }
}

/** Submission 통계 byMember 항목 */
interface StatsByMember {
  userId: string;
  count: number;
  doneCount: number;
  uniqueProblemCount: number;
  uniqueDoneCount: number;
}

/** Submission Service 통계 raw 응답 구조 */
interface StatsData {
  totalSubmissions: number;
  uniqueSubmissions: number;
  uniqueAnalyzed: number;
  byWeek: { week: string; count: number }[];
  byWeekPerUser: { userId: string; week: string; count: number }[];
  byMember: StatsByMember[];
  byMemberWeek: { userId: string; count: number }[] | null;
  recentSubmissions: unknown[];
  solvedProblemIds: string[] | null;
  userSubmissions: { problemId: string; aiScore: number | null; createdAt: string }[] | null;
  submitterCountByProblem: { problemId: string; count: number; analyzedCount: number }[];
}
