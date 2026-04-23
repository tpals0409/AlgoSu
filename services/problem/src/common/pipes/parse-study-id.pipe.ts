/**
 * @file ParseStudyIdPipe + StudyIdHeader — x-study-id 헤더 필수 UUID 검증
 * @domain common
 * @layer pipe
 * @related internal-problem.controller.ts, study-member.guard.ts
 *
 * InternalProblemController처럼 StudyMemberGuard를 거치지 않는 내부 엔드포인트에서
 * x-study-id 헤더를 필수 + UUID v4 형식��로 검증한다.
 * StudyMemberGuard 적용 엔드포인트는 가드 내부에서 이미 검��하므로 중복 적용 불필요.
 *
 * 사용법: @StudyIdHeader() studyId: string
 * (NestJS @Headers는 파이프 인자를 지원하지 않으므로 커스텀 데코레이터 사용)
 */
import {
  createParamDecorator,
  ExecutionContext,
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { isUUID } from 'class-validator';

/**
 * x-study-id 헤더 검증 파이프
 *
 * 검증 항목:
 * 1. 헤더 존재 여부 (undefined/null/빈문자열 차단)
 * 2. UUID v4 형식 검증 (cross-study 접근 방지)
 *
 * @throws BadRequestException ��더 누락 또�� UUID 형식 불일치 시
 */
@Injectable()
export class ParseStudyIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(
        'x-study-id 헤더가 필요합니다.',
      );
    }

    if (!isUUID(value, '4')) {
      throw new BadRequestException(
        'x-study-id 헤더가 유효한 UUID 형식이 아닙니다.',
      );
    }

    return value;
  }
}

/**
 * x-study-id 헤더를 추출하는 커스텀 파라미터 데코레이터
 * ParseStudyIdPipe와 함께 사용하여 헤더 추출 + UUID 검증을 한 번에 수행
 *
 * @example @StudyIdHeader() studyId: string
 */
export const StudyIdHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const studyId = request.headers['x-study-id'];
    return (Array.isArray(studyId) ? studyId[0] : studyId) ?? '';
  },
);
