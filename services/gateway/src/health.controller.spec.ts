import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
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
    it('status: ok 와 timestamp 반환', () => {
      const result = controller.readiness();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });
});
