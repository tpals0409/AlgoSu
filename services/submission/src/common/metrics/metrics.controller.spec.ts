import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: {
            getMetrics: jest.fn().mockResolvedValue('# HELP test_metric\ntest_metric 1'),
            getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4'),
          },
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    metricsService = module.get(MetricsService);
  });

  describe('getMetrics()', () => {
    it('메트릭을 반환하고 Content-Type을 설정한다', async () => {
      const mockSet = jest.fn();
      const mockEnd = jest.fn();
      const res = { set: mockSet, end: mockEnd } as any;

      await controller.getMetrics(res);

      expect(metricsService.getMetrics).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4');
      expect(mockEnd).toHaveBeenCalledWith('# HELP test_metric\ntest_metric 1');
    });
  });
});
