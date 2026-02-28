import { Controller, Get, Param, Req, Res, Logger, ParseUUIDPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';

/**
 * SSE Controller — Redis Pub/Sub → 클라이언트 실시간 스트리밍
 *
 * 구독 채널: submission:status:{submissionId}
 * 메시지 포맷: { submissionId, status, userId?, timestamp }
 *
 * 최종 상태(ai_completed/ai_failed/github_token_invalid) 수신 시 연결 자동 종료 + 알림 생성
 * 보안: X-User-ID 기반 구독자 본인 확인 (TODO)
 */
@Controller('sse')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  private readonly STATUS_NOTIFICATION_MAP: Record<string, { type: NotificationType; title: string }> = {
    ai_completed: { type: NotificationType.AI_COMPLETED, title: 'AI 분석 완료' },
    ai_failed: { type: NotificationType.AI_COMPLETED, title: 'AI 분석 실패' },
    github_token_invalid: { type: NotificationType.GITHUB_FAILED, title: 'GitHub 토큰 오류' },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get('submissions/:id')
  async streamStatus(
    @Param('id', ParseUUIDPipe) submissionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    this.logger.log(`SSE 연결: submissionId=${submissionId}`);

    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    const subscriber = new Redis(redisUrl);
    const channel = `submission:status:${submissionId}`;

    // 이중 cleanup 방지 플래그
    let cleaned = false;

    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
      if (!res.writableEnded) res.end();
      this.logger.log(`SSE 연결 종료: submissionId=${submissionId}`);
    };

    // Redis 에러 — 프로세스 크래시 방지
    subscriber.on('error', (err: Error) => {
      this.logger.error(`SSE Redis 오류: ${err.message}`);
      cleanup();
    });

    await subscriber.subscribe(channel);

    const terminalStatuses = ['ai_completed', 'ai_failed', 'github_token_invalid'];

    subscriber.on('message', (_ch: string, message: string) => {
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
          // 알림 자동 생성 (비동기 — SSE 응답 차단 방지)
          const notifConfig = this.STATUS_NOTIFICATION_MAP[event.status];
          if (notifConfig && event.userId) {
            this.notificationService
              .createNotification(
                event.userId,
                notifConfig.type,
                notifConfig.title,
                `제출(${event.submissionId}) ${notifConfig.title}`,
              )
              .catch((err: Error) => {
                this.logger.error(`알림 생성 실패: ${err.message}`);
              });
          }

          res.write(`event: done\n`);
          res.write(`data: ${JSON.stringify({ status: 'stream_end' })}\n\n`);
          // 구독 즉시 해제 → 이후 메시지 수신 차단, 응답 종료는 500ms 후
          subscriber.unsubscribe(channel).catch(() => {});
          setTimeout(cleanup, 500);
        }
      } catch (err) {
        this.logger.error(`SSE 메시지 파싱 오류: ${(err as Error).message}`);
      }
    });

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': heartbeat\n\n');
    }, 30_000);

    req.on('close', cleanup);
  }
}
