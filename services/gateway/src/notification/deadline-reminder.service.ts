/**
 * @file 마감 알림 스케줄러 — 24시간 전 + 1시간 전 미제출자에게 알림 발송
 * @domain notification
 * @layer service
 * @related NotificationService, ProblemService (Internal API)
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { NotificationService } from './notification.service';
import { NotificationType } from '../common/types/identity.types';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── TYPES ────────────────────────────────

interface ProblemDeadlineInfo {
  id: string;
  title: string;
  studyId: string;
  deadline: string;
  weekNumber: string;
}

interface SubmissionCheckResult {
  submittedUserIds: string[];
}

@Injectable()
export class DeadlineReminderService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly logger: StructuredLoggerService,
    private readonly identityClient: IdentityClientService,
  ) {
    this.logger.setContext(DeadlineReminderService.name);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  // ─── CRON ─────────────────────────────────

  /**
   * 매시간 정시 마감 알림 체크
   * - 24시간 이내 마감 문제 → 미제출자에게 DEADLINE_REMINDER
   * - 1시간 이내 마감 문제 → 미제출자에게 DEADLINE_REMINDER (긴급)
   * - Redis 중복 방지: `deadline_notified:{problemId}:{userId}:{24h|1h}`
   * @domain notification
   * @event DEADLINE_REMINDER (publish)
   */
  @Cron('0 * * * *')
  async checkDeadlines(): Promise<void> {
    this.logger.log('마감 알림 스케줄러 실행');

    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in1h = new Date(now.getTime() + 60 * 60 * 1000);

      // 24시간 이내 마감 문제 조회
      const problems24h = await this.fetchUpcomingDeadlines(now, in24h);
      for (const problem of problems24h) {
        await this.notifyUnsubmittedUsers(problem, '24h');
      }

      // 1시간 이내 마감 문제 조회 (더 긴급한 알림)
      const problems1h = await this.fetchUpcomingDeadlines(now, in1h);
      for (const problem of problems1h) {
        await this.notifyUnsubmittedUsers(problem, '1h');
      }

      this.logger.log(
        `마감 알림 처리 완료: 24h=${problems24h.length}건, 1h=${problems1h.length}건`,
      );
    } catch (error: unknown) {
      this.logger.error(`마감 알림 스케줄러 오류: ${(error as Error).message}`);
    }
  }

  // ─── HELPERS ──────────────────────────────

  /**
   * Problem Service Internal API로 마감 임박 문제 조회
   * @domain notification
   * @param from - 시작 시간
   * @param to - 종료 시간
   */
  private async fetchUpcomingDeadlines(
    from: Date,
    to: Date,
  ): Promise<ProblemDeadlineInfo[]> {
    const problemServiceUrl = this.configService.get<string>('PROBLEM_SERVICE_URL');
    const internalKey = this.configService.get<string>('INTERNAL_KEY_PROBLEM');

    if (!problemServiceUrl || !internalKey) {
      this.logger.warn('PROBLEM_SERVICE_URL 또는 INTERNAL_KEY_PROBLEM 미설정 — 스킵');
      return [];
    }

    try {
      const response = await fetch(
        `${problemServiceUrl}/internal/upcoming-deadlines?from=${from.toISOString()}&to=${to.toISOString()}`,
        {
          method: 'GET',
          headers: {
            'x-internal-key': internalKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`마감 문제 조회 실패: status=${response.status}`);
        return [];
      }

      const result = (await response.json()) as { data: ProblemDeadlineInfo[] };
      return result.data ?? [];
    } catch (error: unknown) {
      this.logger.error(`마감 문제 조회 오류: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 미제출자에게 알림 전송 (중복 방지 포함)
   * @domain notification
   * @param problem - 마감 임박 문제 정보
   * @param window - 알림 윈도우 ('24h' | '1h')
   */
  private async notifyUnsubmittedUsers(
    problem: ProblemDeadlineInfo,
    window: '24h' | '1h',
  ): Promise<void> {
    // 스터디 멤버 조회 (Identity 서비스 경유)
    const members = await this.identityClient.getMembers(problem.studyId);

    if (members.length === 0) return;

    // 제출자 조회 (Submission Service Internal API)
    const submittedUserIds = await this.fetchSubmittedUsers(
      problem.studyId,
      problem.id,
    );
    const submittedSet = new Set(submittedUserIds);

    // 스터디명 조회 (Identity 서비스 경유)
    const study = await this.identityClient.findStudyById(problem.studyId) as Record<string, unknown>;
    const studyName = (study?.name as string) ?? '스터디';

    // 미제출자 필터링
    const unsubmitted = members.filter(
      (m) => !submittedSet.has(m.user_id as string),
    );

    const urgencyLabel = window === '1h' ? '[긴급] ' : '';
    const timeLabel = window === '1h' ? '1시간' : '24시간';

    for (const member of unsubmitted) {
      const userId = member.user_id as string;
      const redisKey = `deadline_notified:${problem.id}:${userId}:${window}`;

      // 중복 방지: 이미 발송한 알림은 스킵
      const alreadySent = await this.redis.get(redisKey);
      if (alreadySent) continue;

      await this.notificationService.createNotification({
        userId,
        studyId: problem.studyId,
        type: NotificationType.DEADLINE_REMINDER,
        title: `${urgencyLabel}마감 임박`,
        message: `"${studyName}" — "${problem.title}" (${problem.weekNumber}) 마감까지 ${timeLabel} 남았습니다.`,
        link: `/problems/${problem.id}`,
      });

      // Redis에 발송 기록 (마감 시간 이후 자동 만료)
      const deadline = new Date(problem.deadline);
      const ttlSeconds = Math.max(
        Math.floor((deadline.getTime() - Date.now()) / 1000),
        3600,
      );
      await this.redis.set(redisKey, '1', 'EX', ttlSeconds);
    }
  }

  /**
   * Submission Service에서 특정 문제의 제출자 목록 조회
   * @domain notification
   * @param studyId - 스터디 ID
   * @param problemId - 문제 ID
   */
  private async fetchSubmittedUsers(
    studyId: string,
    problemId: string,
  ): Promise<string[]> {
    const submissionServiceUrl = this.configService.get<string>('SUBMISSION_SERVICE_URL');
    const internalKey = this.configService.get<string>('INTERNAL_KEY_SUBMISSION');

    if (!submissionServiceUrl || !internalKey) {
      this.logger.warn('SUBMISSION_SERVICE_URL 또는 INTERNAL_KEY_SUBMISSION 미설정 — 스킵');
      return [];
    }

    try {
      const response = await fetch(
        `${submissionServiceUrl}/internal/submitted-users/${studyId}/${problemId}`,
        {
          method: 'GET',
          headers: {
            'x-internal-key': internalKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`제출자 조회 실패: status=${response.status}`);
        return [];
      }

      const result = (await response.json()) as SubmissionCheckResult;
      return result.submittedUserIds ?? [];
    } catch (error: unknown) {
      this.logger.error(`제출자 조회 오류: ${(error as Error).message}`);
      return [];
    }
  }
}
