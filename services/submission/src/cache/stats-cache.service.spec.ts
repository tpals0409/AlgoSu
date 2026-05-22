/**
 * @file stats-cache.service.spec.ts — StatsCacheService 단위 테스트
 * @domain submission
 * @layer test
 * @related stats-cache.service.ts, cache.module.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { StatsCacheService } from './stats-cache.service';
import { REDIS_CLIENT } from './cache.constants';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const mockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  del: jest.fn(),
});

describe('StatsCacheService', () => {
  let service: StatsCacheService;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsCacheService,
        { provide: REDIS_CLIENT, useFactory: mockRedis },
        StructuredLoggerService,
      ],
    }).compile();

    service = module.get<StatsCacheService>(StatsCacheService);
    redis = module.get(REDIS_CLIENT);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── get() ──────────────────────────────────────────────────────
  describe('get()', () => {
    it('캐시 히트 시 JSON 파싱된 데이터를 반환한다', async () => {
      const data = { totalSubmissions: 42, byWeek: [] };
      redis.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.get('study-1', '3월1주차', 'user-1');

      expect(result).toEqual(data);
      expect(redis.get).toHaveBeenCalledWith('stats:study-1:w=3월1주차:u=user-1:p=-');
    });

    it('캐시 미스 시 null을 반환한다', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.get('study-1');

      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith('stats:study-1:w=-:u=-:p=-');
    });

    it('weekNumber만 지정 시 userId는 - 로 키 생성', async () => {
      redis.get.mockResolvedValue(null);

      await service.get('study-1', '3월1주차');

      expect(redis.get).toHaveBeenCalledWith('stats:study-1:w=3월1주차:u=-:p=-');
    });

    it('userId만 지정 시 weekNumber는 - 로 키 생성', async () => {
      redis.get.mockResolvedValue(null);

      await service.get('study-1', undefined, 'user-1');

      expect(redis.get).toHaveBeenCalledWith('stats:study-1:w=-:u=user-1:p=-');
    });

    it('activeProblemIds 지정 시 SHA-256 fingerprint로 키 생성', async () => {
      redis.get.mockResolvedValue(null);

      await service.get('study-1', undefined, undefined, ['p2', 'p1', 'p3']);

      // 정렬 후 'p1,p2,p3' → SHA-256 앞 8자
      const { createHash } = require('crypto');
      const expected = createHash('sha256').update('p1,p2,p3').digest('hex').slice(0, 8);
      expect(redis.get).toHaveBeenCalledWith(`stats:study-1:w=-:u=-:p=${expected}`);
    });

    it('activeProblemIds 순서가 달라도 같은 fingerprint 생성', async () => {
      redis.get.mockResolvedValue(null);

      await service.get('study-1', undefined, undefined, ['p3', 'p1', 'p2']);

      const { createHash } = require('crypto');
      const expected = createHash('sha256').update('p1,p2,p3').digest('hex').slice(0, 8);
      expect(redis.get).toHaveBeenCalledWith(`stats:study-1:w=-:u=-:p=${expected}`);
    });

    it('Fail-Open: Redis 에러 시 null 반환, 예외 전파 없음', async () => {
      redis.get.mockRejectedValue(new Error('Connection refused'));

      const result = await service.get('study-1');

      expect(result).toBeNull();
    });
  });

  // ─── set() ──────────────────────────────────────────────────────
  describe('set()', () => {
    it('JSON.stringify + EX 300으로 캐시를 설정한다', async () => {
      const data = { totalSubmissions: 10 };
      redis.set.mockResolvedValue('OK');

      await service.set('study-1', data, '3월1주차', 'user-1');

      expect(redis.set).toHaveBeenCalledWith(
        'stats:study-1:w=3월1주차:u=user-1:p=-',
        JSON.stringify(data),
        'EX',
        300,
      );
    });

    it('weekNumber/userId 미지정 시 - 로 키 생성', async () => {
      redis.set.mockResolvedValue('OK');

      await service.set('study-1', { count: 5 });

      expect(redis.set).toHaveBeenCalledWith(
        'stats:study-1:w=-:u=-:p=-',
        JSON.stringify({ count: 5 }),
        'EX',
        300,
      );
    });

    it('activeProblemIds 지정 시 fingerprint로 키 생성', async () => {
      redis.set.mockResolvedValue('OK');
      const { createHash } = require('crypto');
      const fp = createHash('sha256').update('p1,p2').digest('hex').slice(0, 8);

      await service.set('study-1', { x: 1 }, undefined, undefined, ['p2', 'p1']);

      expect(redis.set).toHaveBeenCalledWith(
        `stats:study-1:w=-:u=-:p=${fp}`,
        JSON.stringify({ x: 1 }),
        'EX',
        300,
      );
    });

    it('Fail-Open: Redis 에러 시 예외 전파 없음', async () => {
      redis.set.mockRejectedValue(new Error('OOM'));

      await expect(service.set('study-1', {})).resolves.toBeUndefined();
    });
  });

  // ─── invalidate() ───────────────────────────────────────────────
  describe('invalidate()', () => {
    it('SCAN + DEL로 패턴 키를 배치 삭제한다', async () => {
      // 첫 SCAN: cursor=42, keys=['stats:study-1:w=-:u=-:p=-']
      // 두 번째 SCAN: cursor=0 (종료), keys=['stats:study-1:w=3월1주차:u=user-1:p=-']
      redis.scan
        .mockResolvedValueOnce(['42', ['stats:study-1:w=-:u=-:p=-']])
        .mockResolvedValueOnce(['0', ['stats:study-1:w=3월1주차:u=user-1:p=-']]);
      redis.del.mockResolvedValue(1);

      await service.invalidate('study-1');

      expect(redis.scan).toHaveBeenCalledTimes(2);
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'stats:study-1:*', 'COUNT', 100);
      expect(redis.scan).toHaveBeenCalledWith('42', 'MATCH', 'stats:study-1:*', 'COUNT', 100);
      expect(redis.del).toHaveBeenCalledTimes(2);
      expect(redis.del).toHaveBeenCalledWith('stats:study-1:w=-:u=-:p=-');
      expect(redis.del).toHaveBeenCalledWith('stats:study-1:w=3월1주차:u=user-1:p=-');
    });

    it('SCAN 결과가 빈 키 배열이면 DEL 호출하지 않는다', async () => {
      redis.scan.mockResolvedValueOnce(['0', []]);

      await service.invalidate('study-1');

      expect(redis.scan).toHaveBeenCalledTimes(1);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('Fail-Open: Redis 에러 시 예외 전파 없음', async () => {
      redis.scan.mockRejectedValue(new Error('BUSY'));

      await expect(service.invalidate('study-1')).resolves.toBeUndefined();
    });
  });
});
