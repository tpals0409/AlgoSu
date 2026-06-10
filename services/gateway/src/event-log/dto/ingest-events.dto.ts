/**
 * @file ingest-events.dto.ts — POST /api/events 입력 DTO + class-validator 검증
 * @domain event-log
 * @layer dto
 * @related event-log.controller.ts, event-log.service.ts
 *
 * 배경 (ADR-030 S-2):
 *   기존에는 컨트롤러가 `body: { events: EventPayload[] }` 같은 plain interface로 받아
 *   글로벌 ValidationPipe(whitelist+forbidNonWhitelisted+transform)가 **검증을 0건 수행** 했다.
 *   ValidationPipe는 class-validator 메타데이터를 가진 클래스에만 동작하기 때문이다.
 *
 *   본 DTO는 이벤트별 타입/길이/형식/직렬화 크기를 클래스 메타데이터로 강제한다.
 *   - `events`: 최대 50건 (기존 `slice(0, 50)` 캡 → 51건 이상 400 reject로 변경)
 *   - `type`: 자유형 네임스페이스 ([\w:.-]) — `PAGE_VIEW`, `guest:cta_signup_click` 등 실 사용 패턴 호환
 *   - `meta`: 직렬화 크기 2048바이트 캡 — 페이로드 폭주 차단
 */

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidateNested,
  type ValidatorConstraintInterface,
  ValidatorConstraint,
} from 'class-validator';

/** meta 직렬화 크기 상한 (bytes). 폭주 차단. */
const MAX_META_SERIALIZED_BYTES = 2048;

/** 이벤트 type 화이트리스트 패턴 — `[\w:.-]` 만 허용(공백/제어문자/HTML 차단). */
const EVENT_TYPE_PATTERN = /^[\w:.-]+$/;

/**
 * @ValidateMetaSize() — meta 필드 직렬화 크기를 2KB로 제한한다.
 * 객체 자체는 IsObject로 검증하고, 크기 검증은 본 커스텀 validator가 담당한다.
 */
@ValidatorConstraint({ name: 'metaSize', async: false })
class MetaSizeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'object') return false;
    try {
      const serialized = JSON.stringify(value);
      return Buffer.byteLength(serialized, 'utf-8') <= MAX_META_SERIALIZED_BYTES;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return `meta 직렬화 크기가 ${MAX_META_SERIALIZED_BYTES} 바이트를 초과합니다.`;
  }
}

/**
 * 이벤트 페이로드 1건.
 * `event-log.service.ts` 의 `EventPayload` interface와 필드 시그니처가 일치해야 한다.
 */
export class EventItemDto {
  @IsString()
  @MaxLength(64)
  @Matches(EVENT_TYPE_PATTERN, {
    message: 'type 은 영문/숫자/`_`/`:`/`.`/`-` 문자만 허용합니다.',
  })
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  page?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  target?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsISO8601()
  ts!: string;

  @IsOptional()
  @IsObject()
  @Validate(MetaSizeConstraint)
  meta?: Record<string, unknown>;
}

/**
 * 이벤트 배치 본체.
 * `events.length > 50` 이면 400 Bad Request로 reject (의도된 행동 변화: 기존 silent slice 폐기).
 */
export class IngestEventsDto {
  @IsArray()
  @ArrayMaxSize(50, { message: '한 번에 최대 50건의 이벤트만 수신할 수 있습니다.' })
  @ValidateNested({ each: true })
  @Type(() => EventItemDto)
  events!: EventItemDto[];
}
