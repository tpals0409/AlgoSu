/**
 * @file EventLogController 단위 테스트 — 컨트롤러 로직 + DTO 검증 동작
 * @domain event-log
 * @layer test
 */
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EventLogController } from './event-log.controller';
import { EventLogService } from './event-log.service';
import { IngestEventsDto, EventItemDto } from './dto/ingest-events.dto';

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

  function makeDto(events: Partial<EventItemDto>[]): IngestEventsDto {
    const dto = new IngestEventsDto();
    dto.events = events as EventItemDto[];
    return dto;
  }

  it('이벤트 배열을 bufferEvents에 전달한다', async () => {
    const events: EventItemDto[] = [
      { type: 'click', sessionId: 's1', ts: '2026-01-01T00:00:00Z' } as EventItemDto,
    ];
    await controller.ingest(makeDto(events));
    expect(service.bufferEvents).toHaveBeenCalledWith(events);
  });

  it('빈 배열이면 bufferEvents를 호출하지 않는다', async () => {
    await controller.ingest(makeDto([]));
    expect(service.bufferEvents).not.toHaveBeenCalled();
  });

  it('null/undefined events에도 안전하게 동작한다 (no-op)', async () => {
    const dto = new IngestEventsDto();
    // 명시적으로 undefined 케이스 — ValidationPipe가 transform 시 빈 배열로 만들지 않은 경계
    (dto as unknown as { events?: EventItemDto[] }).events = undefined;
    await controller.ingest(dto);
    expect(service.bufferEvents).not.toHaveBeenCalled();
  });
});

/* ───────── DTO 검증 동작 ─────────────────────────────────────────────────────────
 * ValidationPipe(whitelist+forbidNonWhitelisted+transform)는 main.ts에서 글로벌 등록.
 * 본 스펙은 class-validator 메타데이터가 실제로 작동하는지 직접 validate()로 검증한다.
 */
describe('IngestEventsDto — class-validator 메타데이터', () => {
  function buildDto(raw: unknown): IngestEventsDto {
    return plainToInstance(IngestEventsDto, raw);
  }

  it('정상 케이스 — 단건 이벤트', async () => {
    const dto = buildDto({
      events: [
        {
          type: 'PAGE_VIEW',
          page: '/dashboard',
          sessionId: 'session-abc',
          ts: '2026-01-01T00:00:00Z',
          meta: { ref: 'gnb' },
        },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('정상 케이스 — 자유형 네임스페이스 type (guest:cta_signup_click)', async () => {
    const dto = buildDto({
      events: [
        {
          type: 'guest:cta_signup_click',
          sessionId: 's1',
          ts: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('51건 초과 — ArrayMaxSize 위반', async () => {
    const dto = buildDto({
      events: Array.from({ length: 51 }, (_, i) => ({
        type: 'view',
        sessionId: `s${i}`,
        ts: '2026-01-01T00:00:00Z',
      })),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('arrayMaxSize');
  });

  it('type 패턴 위반 — 공백 포함', async () => {
    const dto = buildDto({
      events: [
        {
          type: 'invalid type with spaces',
          sessionId: 's1',
          ts: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const errors = await validate(dto);
    expect(JSON.stringify(errors)).toContain('matches');
  });

  it('type 길이 초과 — 64자 초과', async () => {
    const dto = buildDto({
      events: [
        {
          type: 'a'.repeat(65),
          sessionId: 's1',
          ts: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const errors = await validate(dto);
    expect(JSON.stringify(errors)).toContain('maxLength');
  });

  it('sessionId 누락', async () => {
    const dto = buildDto({
      events: [
        {
          type: 'click',
          ts: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const errors = await validate(dto);
    expect(JSON.stringify(errors)).toContain('isString');
  });

  it('ts 형식 오류 — ISO8601 위반', async () => {
    const dto = buildDto({
      events: [
        {
          type: 'click',
          sessionId: 's1',
          ts: 'not-a-date',
        },
      ],
    });
    const errors = await validate(dto);
    expect(JSON.stringify(errors)).toContain('isIso8601');
  });

  it('meta 직렬화 크기 초과 (2KB)', async () => {
    const big = 'x'.repeat(2500);
    const dto = buildDto({
      events: [
        {
          type: 'click',
          sessionId: 's1',
          ts: '2026-01-01T00:00:00Z',
          meta: { huge: big },
        },
      ],
    });
    const errors = await validate(dto);
    expect(JSON.stringify(errors)).toContain('metaSize');
  });

  it('meta 정상 크기 (1KB 미만)', async () => {
    const dto = buildDto({
      events: [
        {
          type: 'click',
          sessionId: 's1',
          ts: '2026-01-01T00:00:00Z',
          meta: { okSize: 'x'.repeat(500) },
        },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('events 가 배열이 아닐 때 — 타입 위반', async () => {
    const dto = buildDto({ events: 'not-an-array' as unknown });
    const errors = await validate(dto);
    expect(JSON.stringify(errors)).toContain('isArray');
  });
});
