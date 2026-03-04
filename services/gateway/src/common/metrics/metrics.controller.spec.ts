import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: { getMetrics: jest.Mock; getContentType: jest.Mock };
  let mockRes: { set: jest.Mock; end: jest.Mock };

  beforeEach(() => {
    metricsService = {
      getMetrics: jest.fn().mockResolvedValue('# HELP metric\nmetric 1'),
      getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4'),
    };
    mockRes = { set: jest.fn(), end: jest.fn() };

    controller = new MetricsController(
      metricsService as unknown as MetricsService,
    );
  });

  it('getMetrics — MetricsService에서 메트릭 문자열을 가져와 응답한다', async () => {
    await controller.getMetrics(mockRes as any);

    expect(metricsService.getMetrics).toHaveBeenCalled();
    expect(mockRes.set).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4',
    );
    expect(mockRes.end).toHaveBeenCalledWith('# HELP metric\nmetric 1');
  });

  it('getMetrics — Content-Type을 metricsService.getContentType()으로 설정한다', async () => {
    metricsService.getContentType.mockReturnValue('application/openmetrics-text');

    await controller.getMetrics(mockRes as any);

    expect(mockRes.set).toHaveBeenCalledWith(
      'Content-Type',
      'application/openmetrics-text',
    );
  });
});
