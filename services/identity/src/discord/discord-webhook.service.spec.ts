/**
 * @file Discord Webhook 서비스 단위 테스트
 * @domain identity
 * @layer test
 * @related discord-webhook.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DiscordWebhookService } from './discord-webhook.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { Feedback, FeedbackCategory, FeedbackStatus } from '../feedback/feedback.entity';

// ─── Mock 헬퍼 ───────────────────────────────────────
const mockFeedback = (overrides: Partial<Feedback> = {}): Feedback =>
  ({
    id: 1,
    publicId: 'pub-fb-1',
    userId: 'user-1',
    studyId: null,
    category: FeedbackCategory.GENERAL,
    content: '테스트 피드백입니다.',
    pageUrl: null,
    browserInfo: null,
    screenshot: null,
    status: FeedbackStatus.OPEN,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    resolvedAt: null,
    ...overrides,
  }) as Feedback;

describe('DiscordWebhookService', () => {
  let service: DiscordWebhookService;
  let mockLogger: { setContext: jest.Mock; log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  const originalFetch = global.fetch;
  const originalEnv = process.env['DISCORD_FEEDBACK_WEBHOOK_URL'];

  beforeEach(async () => {
    // 환경변수 초기화
    process.env['DISCORD_FEEDBACK_WEBHOOK_URL'] = 'https://discord.com/api/webhooks/test';

    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordWebhookService,
        { provide: StructuredLoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(DiscordWebhookService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv !== undefined) {
      process.env['DISCORD_FEEDBACK_WEBHOOK_URL'] = originalEnv;
    } else {
      delete process.env['DISCORD_FEEDBACK_WEBHOOK_URL'];
    }
    jest.clearAllMocks();
  });

  // ─── 정상 전송 ─────────────────────────────────────
  it('webhook URL 설정 시 Discord로 정상 전송한다', async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const feedback = mockFeedback();
    await service.sendFeedbackNotification(feedback);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    // body JSON 파싱 검증
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.embeds).toHaveLength(1);
    expect(body.embeds[0].title).toContain('새 피드백 접수');
  });

  // ─── webhook URL 미설정 시 skip ───────────────────
  it('webhook URL 미설정 시 fetch를 호출하지 않는다', async () => {
    // URL 미설정 상태로 새 인스턴스 생성
    delete process.env['DISCORD_FEEDBACK_WEBHOOK_URL'];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordWebhookService,
        { provide: StructuredLoggerService, useValue: mockLogger },
      ],
    }).compile();
    const svcNoUrl = module.get(DiscordWebhookService);

    global.fetch = jest.fn();

    await svcNoUrl.sendFeedbackNotification(mockFeedback());

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('DISCORD_FEEDBACK_WEBHOOK_URL 미설정'),
    );
  });

  it('webhook URL 미설정 시 경고 로그를 1회만 남긴다', async () => {
    delete process.env['DISCORD_FEEDBACK_WEBHOOK_URL'];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordWebhookService,
        { provide: StructuredLoggerService, useValue: mockLogger },
      ],
    }).compile();
    const svcNoUrl = module.get(DiscordWebhookService);

    global.fetch = jest.fn();

    await svcNoUrl.sendFeedbackNotification(mockFeedback());
    await svcNoUrl.sendFeedbackNotification(mockFeedback());

    // warn은 1회만
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  // ─── 전송 실패 시 예외 안 던짐 ────────────────────
  it('fetch 실패 시 에러 로그만 남기고 예외를 던지지 않는다', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      service.sendFeedbackNotification(mockFeedback()),
    ).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Discord webhook 전송 실패'),
    );
  });

  it('Error가 아닌 값으로 throw 시에도 로그를 남기고 예외를 던지지 않는다', async () => {
    global.fetch = jest.fn().mockRejectedValue('string error');

    await expect(
      service.sendFeedbackNotification(mockFeedback()),
    ).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Discord webhook 전송 실패: string error'),
    );
  });

  it('비정상 HTTP 응답 시 경고 로그를 남긴다', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 } as Response);

    await service.sendFeedbackNotification(mockFeedback());

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Discord webhook 응답 오류: status=429'),
    );
  });

  // ─── Embed 포맷 검증 ──────────────────────────────
  describe('Embed 포맷', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    });

    it('BUG 카테고리는 빨강 색상(0xFF0000)을 사용한다', async () => {
      await service.sendFeedbackNotification(
        mockFeedback({ category: FeedbackCategory.BUG }),
      );

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0xff0000);
    });

    it('FEATURE 카테고리는 파랑 색상(0x0066FF)을 사용한다', async () => {
      await service.sendFeedbackNotification(
        mockFeedback({ category: FeedbackCategory.FEATURE }),
      );

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0x0066ff);
    });

    it('UX 카테고리는 초록 색상(0x00CC66)을 사용한다', async () => {
      await service.sendFeedbackNotification(
        mockFeedback({ category: FeedbackCategory.UX }),
      );

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0x00cc66);
    });

    it('GENERAL 카테고리는 회색 색상(0x888888)을 사용한다', async () => {
      await service.sendFeedbackNotification(
        mockFeedback({ category: FeedbackCategory.GENERAL }),
      );

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0x888888);
    });

    it('issueUrl 전달 시 description에 이슈 링크를 포함한다', async () => {
      await service.sendFeedbackNotification(
        mockFeedback(),
        'https://github.com/tpals0409/AlgoSu/issues/42',
      );

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].description).toContain(
        'https://github.com/tpals0409/AlgoSu/issues/42',
      );
    });

    it('issueUrl이 null이면 description에 대시보드 안내 문구를 표시한다', async () => {
      await service.sendFeedbackNotification(mockFeedback(), null);

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].description).toContain('관리자 대시보드에서 확인');
    });

    it('pageUrl이 있으면 description에 페이지 경로를 포함한다', async () => {
      await service.sendFeedbackNotification(
        mockFeedback({ pageUrl: '/problems/123' }),
      );

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].description).toContain('/problems/123');
    });

    it('알 수 없는 카테고리는 회색 fallback(0x888888)을 사용한다', async () => {
      await service.sendFeedbackNotification(
        mockFeedback({ category: 'UNKNOWN' as FeedbackCategory }),
      );

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0x888888);
    });

    it('pageUrl이 없으면 description에 "-"로 표시한다', async () => {
      await service.sendFeedbackNotification(mockFeedback({ pageUrl: null }));

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].description).toContain('**페이지** · `-`');
    });

    it('description에 footer가 포함된다', async () => {
      await service.sendFeedbackNotification(mockFeedback());

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].footer.text).toBe('AlgoSu Feedback');
    });
  });

  // ─── sendFeedbackResolvedNotification ─────────────
  describe('sendFeedbackResolvedNotification', () => {
    it('RESOLVED 피드백을 Discord로 정상 전송한다', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response);

      const feedback = mockFeedback({
        status: FeedbackStatus.RESOLVED,
        resolvedAt: new Date('2026-04-09T03:00:00Z'),
      });
      await service.sendFeedbackResolvedNotification(feedback);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].title).toContain('피드백 처리 완료');
      expect(body.embeds[0].color).toBe(0x2ecc71);
      expect(body.embeds[0].footer.text).toBe('AlgoSu Feedback');
    });

    it('webhook URL 미설정 시 fetch를 호출하지 않는다', async () => {
      delete process.env['DISCORD_FEEDBACK_WEBHOOK_URL'];
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DiscordWebhookService,
          { provide: StructuredLoggerService, useValue: mockLogger },
        ],
      }).compile();
      const svcNoUrl = module.get(DiscordWebhookService);
      global.fetch = jest.fn();

      await svcNoUrl.sendFeedbackResolvedNotification(mockFeedback());

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('resolvedAt이 null이면 현재 시간으로 대체한다', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response);

      await service.sendFeedbackResolvedNotification(
        mockFeedback({ resolvedAt: null }),
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].description).toContain('처리 시간');
    });

    it('내용이 200자 초과 시 truncation한다', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response);

      await service.sendFeedbackResolvedNotification(
        mockFeedback({ content: '가'.repeat(250) }),
      );

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.embeds[0].description).toContain('가'.repeat(200) + '...');
    });

    it('fetch 실패 시 예외를 던지지 않는다', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        service.sendFeedbackResolvedNotification(mockFeedback()),
      ).resolves.toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Discord webhook 전송 실패'),
      );
    });

    it('비정상 HTTP 응답 시 경고 로그를 남긴다', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

      await service.sendFeedbackResolvedNotification(mockFeedback());

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Discord webhook 응답 오류: status=500'),
      );
    });

    it('Error가 아닌 값으로 throw 시에도 로그를 남기고 예외를 던지지 않는다', async () => {
      global.fetch = jest.fn().mockRejectedValue('string error');

      await expect(
        service.sendFeedbackResolvedNotification(mockFeedback()),
      ).resolves.toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Discord webhook 전송 실패: string error'),
      );
    });
  });
});
