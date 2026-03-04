/**
 * @file SSE Controller — Redis Pub/Sub 기반 실시간 제출 상태 스트리밍
 * @domain submission
 * @layer controller
 * @related NotificationService, SubmissionService
 *
 * 구독 채널: submission:status:{submissionId}
 * 메시지 포맷: { submissionId, status, userId?, timestamp }
 *
 * 보안:
 * - H1: JWT 쿼리 토큰 또는 Cookie 인증
 * - S6: submission 소유권 검증 (IDOR 방어)
 * - H16: 최대 연결 시간 5분 (MAX_CONNECTION_MS)
 * - M13: 공유 Redis subscriber 사용 (연결 풀 고갈 방지)
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  Logger,
  ParseUUIDPipe,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';

@Controller('sse')
export class SseController {
  private readonly logger = new Logger(SseController.name);
  private readonly jwtSecret: string;

  // M13: 공유 Redis subscriber (연결마다 새 인스턴스 생성 방지)
  private readonly subscriber: Redis;
  private readonly listeners = new Map<string, Set<(message: string) => void>>();

  // H16: 최대 SSE 연결 유지 시간 (5분)
  private static readonly MAX_CONNECTION_MS = 5 * 60 * 1000;

  // H15: 최종 상태 → 알림 타입 매핑
  private readonly STATUS_NOTIFICATION_MAP: Record<string, { type: NotificationType; title: string }> = {
    ai_completed: { type: NotificationType.AI_COMPLETED, title: 'AI 분석 완료' },
    ai_failed: { type: NotificationType.AI_COMPLETED, title: 'AI 분석 실패' },
    github_token_invalid: { type: NotificationType.GITHUB_FAILED, title: 'GitHub 토큰 오류' },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');

    // M13: 단일 Redis subscriber 인스턴스
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.subscriber = new Redis(redisUrl);

    this.subscriber.on('error', (err: Error) => {
      this.logger.error(`SSE 공유 Redis subscriber 오류: ${err.message}`);
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      const channelListeners = this.listeners.get(channel);
      if (channelListeners) {
        for (const listener of channelListeners) {
          listener(message);
        }
      }
    });
  }

  /**
   * SSE 제출 상태 스트리밍
   * @api GET /sse/submissions/:id
   * @guard cookie-auth, submission-owner
   */
  @Get('submissions/:id')
  async streamStatus(
    @Param('id', ParseUUIDPipe) submissionId: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // H1: JWT 인증 — 쿼리 토큰 또는 Cookie
    const cookieToken = req.cookies?.['token'] as string | undefined;
    const userId = this.verifyToken(token ?? cookieToken);

    // S6: submission 소유권 검증 (IDOR 방어)
    await this.verifySubmissionOwnership(submissionId, userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    this.logger.log(`SSE 연결: submissionId=${submissionId}, userId=${userId}`);

    const channel = `submission:status:${submissionId}`;

    // 이중 cleanup 방지 플래그
    let cleaned = false;

    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      clearTimeout(connectionTimeout);
      this.removeChannelListener(channel, messageHandler);
      if (!res.writableEnded) res.end();
      this.logger.log(`SSE 연결 종료: submissionId=${submissionId}`);
    };

    // M13: 공유 subscriber에 채널 리스너 등록
    const terminalStatuses = ['ai_completed', 'ai_failed', 'github_token_invalid'];

    const messageHandler = (message: string): void => {
      try {
        const event = JSON.parse(message) as {
          submissionId: string;
          status: string;
          userId?: string;
          timestamp: string;
        };

        res.write(`event: status\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        if (terminalStatuses.includes(event.status)) {
          // 알림 자동 생성 — 인증된 userId 사용 (event.userId 미전달 이슈 해소)
          const notifConfig = this.STATUS_NOTIFICATION_MAP[event.status];
          if (notifConfig) {
            this.notificationService
              .createNotification({
                userId,
                type: notifConfig.type,
                title: notifConfig.title,
                message: `제출(${event.submissionId}) ${notifConfig.title}`,
              })
              .catch((err: Error) => {
                this.logger.error(`알림 생성 실패: ${err.message}`);
              });
          }

          if (!res.writableEnded) {
            res.write(`event: done\n`);
            res.write(`data: ${JSON.stringify({ status: 'stream_end' })}\n\n`);
          }
          setTimeout(cleanup, 500);
        }
      } catch (err) {
        this.logger.error(`SSE 메시지 파싱 오류: ${(err as Error).message}`);
      }
    };

    await this.addChannelListener(channel, messageHandler);

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': heartbeat\n\n');
    }, 30_000);

    // H16: 최대 연결 시간 (5분) — 타임아웃 시 자동 종료
    const connectionTimeout = setTimeout(() => {
      if (!res.writableEnded) {
        res.write(`event: timeout\n`);
        res.write(`data: ${JSON.stringify({ status: 'connection_timeout', maxMs: SseController.MAX_CONNECTION_MS })}\n\n`);
      }
      cleanup();
    }, SseController.MAX_CONNECTION_MS);

    req.on('close', cleanup);
  }

  // --- H1: JWT 토큰 검증 ---

  private verifyToken(token: string | undefined): string {
    if (!token) {
      throw new UnauthorizedException('SSE 연결에 인증 토큰이 필요합니다 (?token=xxx).');
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      });

      if (typeof decoded === 'string' || !decoded) {
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      }

      const payload = decoded as jwt.JwtPayload;
      const userId = payload['sub'];

      if (!userId || typeof userId !== 'string') {
        throw new UnauthorizedException('토큰에 사용자 ID가 없습니다.');
      }

      return userId;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }

  // --- S6: submission 소유권 검증 ---

  /**
   * Submission Service internal API로 소유권 확인
   * @guard submission-owner
   */
  private async verifySubmissionOwnership(
    submissionId: string,
    userId: string,
  ): Promise<void> {
    const submissionServiceUrl = this.configService.getOrThrow<string>('SUBMISSION_SERVICE_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');

    try {
      const response = await fetch(
        `${submissionServiceUrl}/internal/submissions/${submissionId}/owner`,
        {
          method: 'GET',
          headers: {
            'x-internal-key': internalKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new ForbiddenException('제출물 소유권을 확인할 수 없습니다.');
      }

      const data = (await response.json()) as { userId: string };
      if (data.userId !== userId) {
        throw new ForbiddenException('본인의 제출물만 실시간 추적할 수 있습니다.');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`소유권 검증 실패: ${(error as Error).message}`);
      throw new ForbiddenException('제출물 소유권을 확인할 수 없습니다.');
    }
  }

  // --- M13: 공유 Redis subscriber 채널 관리 ---

  private async addChannelListener(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    let channelListeners = this.listeners.get(channel);
    if (!channelListeners) {
      channelListeners = new Set();
      this.listeners.set(channel, channelListeners);
      await this.subscriber.subscribe(channel);
    }
    channelListeners.add(handler);
  }

  private removeChannelListener(
    channel: string,
    handler: (message: string) => void,
  ): void {
    const channelListeners = this.listeners.get(channel);
    if (!channelListeners) return;

    channelListeners.delete(handler);
    if (channelListeners.size === 0) {
      this.listeners.delete(channel);
      this.subscriber.unsubscribe(channel).catch(() => {});
    }
  }
}
