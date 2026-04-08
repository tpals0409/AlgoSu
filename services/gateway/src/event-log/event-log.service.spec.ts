/**
 * @file 이벤트 로깅 서비스 단위 테스트
 * @domain event-log
 * @layer service
 * @related EventLogService
 */

/* eslint-disable @typescript-eslint/no-var-requires */

import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  rpush: jest.fn().mockResolvedValue(1),
  rename: jest.fn().mockResolvedValue('OK'),
  lrange: jest.fn().mockResolvedValue([]),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn().mockReturnThis(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// --- fs 모듈 모킹 (jest.mock 호이스팅 대응) ---
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
}));

// jest.mock 이후 require로 모킹된 fs 참조
import * as fs from 'fs';

import { EventLogService, EventPayload } from './event-log.service';

describe('EventLogService', () => {
  let service: EventLogService;
  let configService: Record<string, jest.Mock>;
  let logger: Record<string, jest.Mock>;

  const SAMPLE_EVENTS: EventPayload[] = [
    {
      type: 'click',
      page: '/problems',
      target: 'submit-btn',
      sessionId: 'session-1',
      userId: 'user-1',
      ts: '2026-04-08T12:00:00Z',
    },
    {
      type: 'view',
      page: '/dashboard',
      sessionId: 'session-1',
      ts: '2026-04-08T12:01:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new EventLogService(
      configService as unknown as ConfigService,
      logger as unknown as StructuredLoggerService,
    );
  });

  // ============================
  // 1. bufferEvents — Redis RPUSH
  // ============================
  describe('bufferEvents', () => {
    it('이벤트 배열을 JSON 직렬화하여 Redis RPUSH 호출', async () => {
      await service.bufferEvents(SAMPLE_EVENTS);

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        'events:log',
        JSON.stringify(SAMPLE_EVENTS[0]),
        JSON.stringify(SAMPLE_EVENTS[1]),
      );
    });

    it('Redis 에러 시 throw하지 않음 (silent drop)', async () => {
      mockRedis.rpush.mockRejectedValue(new Error('Redis connection refused'));

      await expect(service.bufferEvents(SAMPLE_EVENTS)).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('RPUSH 실패'),
      );
    });
  });

  // ============================
  // 2. flushToFile — NDJSON 파일 쓰기
  // ============================
  describe('flushToFile', () => {
    it('Redis에 이벤트 있을 때 NDJSON 파일 쓰기', async () => {
      const serialized = SAMPLE_EVENTS.map((e) => JSON.stringify(e));
      mockRedis.rename.mockResolvedValue('OK');
      mockRedis.lrange.mockResolvedValue(serialized);

      await service.flushToFile();

      expect(mockRedis.rename).toHaveBeenCalledWith('events:log', 'events:log:flushing');
      expect(mockRedis.lrange).toHaveBeenCalledWith('events:log:flushing', 0, -1);
      expect(mockRedis.del).toHaveBeenCalledWith('events:log:flushing');
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/var/log/algosu/events',
        { recursive: true },
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/\/var\/log\/algosu\/events\/\d{4}-\d{2}-\d{2}\.ndjson$/),
        serialized.join('\n') + '\n',
        'utf-8',
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('flush 완료: 2건'),
      );
    });

    it('Redis에 이벤트 없을 때 (키 없음) 파일 쓰기 스킵', async () => {
      mockRedis.rename.mockRejectedValue(new Error('ERR no such key'));

      await service.flushToFile();

      expect(mockRedis.lrange).not.toHaveBeenCalled();
      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it('Redis RENAME 성공 후 lrange 빈 배열 — 파일 쓰기 스킵', async () => {
      mockRedis.rename.mockResolvedValue('OK');
      mockRedis.lrange.mockResolvedValue([]);

      await service.flushToFile();

      expect(mockRedis.del).toHaveBeenCalledWith('events:log:flushing');
      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });
  });

  // ============================
  // 3. onModuleDestroy — Redis 연결 종료
  // ============================
  describe('onModuleDestroy', () => {
    it('Redis quit 호출', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  // ============================
  // 4. Redis error callback
  // ============================
  describe('Redis error callback', () => {
    it('Redis on error 핸들러가 등록되어 에러를 로깅한다', () => {
      const errorCall = (mockRedis.on as jest.Mock).mock.calls.find(
        (call: [string, ...unknown[]]) => call[0] === 'error',
      );
      expect(errorCall).toBeDefined();
      const handler = errorCall![1] as (err: Error) => void;
      expect(() => handler(new Error('Redis connection refused'))).not.toThrow();
    });
  });
});
