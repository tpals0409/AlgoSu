import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: { getMetrics: jest.Mock; getContentType: jest.Mock };

  beforeEach(async () => {
    metricsService = {
      getMetrics: jest.fn().mockResolvedValue('# HELP metric\nmetric 1'),
      getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: metricsService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('GET /metrics: 메트릭 문자열과 Content-Type 헤더 설정', async () => {
    const res = {
      set: jest.fn(),
      end: jest.fn(),
    } as any;

    await controller.getMetrics(res);

    expect(metricsService.getMetrics).toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4');
    expect(res.end).toHaveBeenCalledWith('# HELP metric\nmetric 1');
  });
});
