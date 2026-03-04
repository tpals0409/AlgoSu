import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Response } from 'express';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: jest.Mocked<Partial<MetricsService>>;

  beforeEach(() => {
    metricsService = {
      getMetrics: jest.fn().mockResolvedValue('# HELP test\ntest_metric 1'),
      getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4'),
    };
    controller = new MetricsController(metricsService as MetricsService);
  });

  describe('getMetrics()', () => {
    it('메트릭 문자열을 올바른 Content-Type과 함께 반환한다', async () => {
      const mockEnd = jest.fn();
      const mockSet = jest.fn().mockReturnThis();
      const res = { set: mockSet, end: mockEnd } as unknown as Response;

      await controller.getMetrics(res);

      expect(metricsService.getMetrics).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4');
      expect(mockEnd).toHaveBeenCalledWith('# HELP test\ntest_metric 1');
    });
  });
});
