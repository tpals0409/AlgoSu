/**
 * @file X-Internal-Key 검증 가드 — 서비스 간 통신 인증
 * @domain common
 * @layer guard
 * @related .env.example, internal controllers
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
 * X-Internal-Key 검증 가드
 *
 * 보안 요구사항:
 * - 키 값은 ConfigService(환경변수)에서 주입 — 코드 하드코딩 절대 금지
 * - k3s Secret으로 관리, 서비스 간 Key 공유 금지
 * - 타이밍 어택 방지를 위한 고정 시간 비교
 * - 로그에 키 원문 출력 금지
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
      this.logger.warn(
        `X-Internal-Key 헤더 없음 — path: ${request.path}, ip: ${request.ip ?? 'unknown'}`,
      );
      throw new UnauthorizedException('Internal API Key가 필요합니다.');
    }

    if (!this.timingSafeCompare(providedKey, expectedKey)) {
      // 로그에 키 원문 절대 포함 금지
      this.logger.warn(
        `X-Internal-Key 불일치 — path: ${request.path}, ip: ${request.ip ?? 'unknown'}`,
      );
      throw new UnauthorizedException('유효하지 않은 Internal API Key입니다.');
    }

    return true;
  }

  /**
   * M10: Node.js 내장 crypto.timingSafeEqual 사용
   */
  private timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
