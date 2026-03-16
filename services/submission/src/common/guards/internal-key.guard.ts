/**
 * @file Internal Key Guard — X-Internal-Key 기반 서비스 간 인증
 * @domain common
 * @layer guard
 * @related ConfigService
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

@Injectable()
export class InternalKeyGuard implements CanActivate {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly configService: ConfigService,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger;
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
