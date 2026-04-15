/**
 * @file internal-key.guard.ts — X-Internal-Key 헤더 검증 (timingSafeEqual)
 * @domain common
 * @layer guard
 * @related internal-problem.controller.ts, structured-logger.service.ts
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { StructuredLoggerService } from '../logger/structured-logger.service';

/**
 * X-Internal-Key 검증 가드 (Problem Service)
 *
 * Gateway에서 주입된 X-Internal-Key를 검증
 * 타이밍 어택 방지를 위한 고정 시간 비교
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(InternalKeyGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-internal-key'];
    const expectedKey = this.configService.getOrThrow<string>('INTERNAL_API_KEY');

    if (!providedKey || typeof providedKey !== 'string') {
      this.logger.warn(`X-Internal-Key 헤더 없음 — path: ${request.path}`);
      throw new UnauthorizedException('Internal API Key가 필요합니다.');
    }

    if (!this.timingSafeEqual(providedKey, expectedKey)) {
      this.logger.warn(`X-Internal-Key 불일치 — path: ${request.path}`);
      throw new UnauthorizedException('유효하지 않은 Internal API Key입니다.');
    }

    return true;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
