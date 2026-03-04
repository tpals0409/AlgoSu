import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: { query: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    dataSource = module.get(DataSource);
  });

  describe('check()', () => {
    it('status: ok 와 timestamp를 반환한다', () => {
      const result = controller.check();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('readiness()', () => {
    it('DB 연결 정상이면 ok를 반환한다', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      const result = await controller.readiness();
      expect(result.status).toBe('ok');
      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('DB 연결 실패 시 ServiceUnavailableException을 던진다', async () => {
      dataSource.query.mockRejectedValue(new Error('DB down'));
      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
