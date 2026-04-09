/**
 * @file Discord Webhook 서비스 — 피드백 알림 전송
 * @domain identity
 * @layer service
 * @related discord.module.ts, feedback.service.ts
 */
import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { Feedback, FeedbackCategory } from '../feedback/feedback.entity';

/** 카테고리별 Embed 색상 */
const CATEGORY_COLORS: Record<FeedbackCategory, number> = {
  [FeedbackCategory.BUG]: 0xff0000,
  [FeedbackCategory.FEATURE]: 0x0066ff,
  [FeedbackCategory.UX]: 0x00cc66,
  [FeedbackCategory.GENERAL]: 0x888888,
};

@Injectable()
export class DiscordWebhookService {
  private readonly webhookUrl: string | undefined;
  private warnedMissingUrl = false;

  constructor(private readonly logger: StructuredLoggerService) {
    this.logger.setContext(DiscordWebhookService.name);
    this.webhookUrl = process.env['DISCORD_FEEDBACK_WEBHOOK_URL'];
  }

  /**
   * 피드백 생성 시 Discord 채널로 알림 전송
   * fire-and-forget: 에러 시 로그만 남기고 예외를 던지지 않음
   * @param feedback - 저장된 피드백 엔티티
   */
  async sendFeedbackNotification(feedback: Feedback): Promise<void> {
    if (!this.webhookUrl) {
      if (!this.warnedMissingUrl) {
        this.logger.warn(
          'DISCORD_FEEDBACK_WEBHOOK_URL 미설정 — Discord 알림을 건너뜁니다.',
        );
        this.warnedMissingUrl = true;
      }
      return;
    }

    // 내용 200자 truncation
    const contentPreview =
      feedback.content.length > 200
        ? feedback.content.slice(0, 200) + '...'
        : feedback.content;

    // KST 시간 변환
    const kstTime = new Date(feedback.createdAt).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
    });

    // 메타정보 한 줄 구성
    const metaLine1 = `**카테고리** · \`${feedback.category}\`  |  **페이지** · \`${feedback.pageUrl ?? '-'}\``;
    const metaLine2 = `**작성자** · \`${feedback.userId}\`  |  **시간** · \`${kstTime}\``;

    const embed = {
      title: '새 피드백 접수',
      color: CATEGORY_COLORS[feedback.category] ?? 0x888888,
      description: `\`\`\`\n${contentPreview}\n\`\`\`\n\n${metaLine1}\n${metaLine2}`,
      footer: { text: 'AlgoSu Feedback' },
    };

    const body = JSON.stringify({ embeds: [embed] });

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        this.logger.warn(
          `Discord webhook 응답 오류: status=${response.status}`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Discord webhook 전송 실패: ${message}`);
    }
  }
}
