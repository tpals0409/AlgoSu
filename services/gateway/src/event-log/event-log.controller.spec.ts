/**
 * @file EventLogController 단위 테스트
 * @domain event-log
 * @layer test
 */
import { Test, TestingModule } from '@nestjs/testing';
import { EventLogController } from './event-log.controller';
import { EventLogService } from './event-log.service';

describe('EventLogController', () => {
  let controller: EventLogController;
  let service: { bufferEvents: jest.Mock };

  beforeEach(async () => {
    service = { bufferEvents: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventLogController],
      providers: [{ provide: EventLogService, useValue: service }],
    }).compile();

    controller = module.get(EventLogController);
  });

  it('이벤트 배열을 bufferEvents에 전달한다', async () => {
    const events = [{ type: 'click', sessionId: 's1', ts: '2026-01-01T00:00:00Z' }];
    await controller.ingest({ events });
    expect(service.bufferEvents).toHaveBeenCalledWith(events);
  });

  it('빈 배열이면 bufferEvents를 호출하지 않는다', async () => {
    await controller.ingest({ events: [] });
    expect(service.bufferEvents).not.toHaveBeenCalled();
  });

  it('50개 초과 시 50개로 잘라서 전달한다', async () => {
    const events = Array.from({ length: 60 }, (_, i) => ({
      type: 'view', sessionId: `s${i}`, ts: '2026-01-01T00:00:00Z',
    }));
    await controller.ingest({ events });
    expect(service.bufferEvents.mock.calls[0][0]).toHaveLength(50);
  });
});
