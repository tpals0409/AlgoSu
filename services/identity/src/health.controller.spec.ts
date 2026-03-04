import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let mockDataSource: Partial<DataSource>;

  beforeEach(() => {
    mockDataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    controller = new HealthController(mockDataSource as DataSource);
  });

  describe('check()', () => {
    it('status "ok"과 timestamp를 반환한다', () => {
      const result = controller.check();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });

  describe('readiness()', () => {
    it('DB 연결 정상이면 ok를 반환한다', async () => {
      const result = await controller.readiness();
      expect(result.status).toBe('ok');
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('DB 연결 실패 시 ServiceUnavailableException을 던진다', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('connection failed'));
      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
