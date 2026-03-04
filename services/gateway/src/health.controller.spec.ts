import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: dataSource }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health', () => {
    it('status: ok 와 timestamp 반환', () => {
      const result = controller.check();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('DB 정상: status ok 반환', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.readiness();

      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });

    it('DB 실패: ServiceUnavailableException 발생', async () => {
      dataSource.query.mockRejectedValue(new Error('Connection refused'));

      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
