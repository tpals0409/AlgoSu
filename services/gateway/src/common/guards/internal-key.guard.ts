import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

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
  private readonly logger = new Logger(InternalKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

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

    if (!this.timingSafeEqual(providedKey, expectedKey)) {
      // 로그에 키 원문 절대 포함 금지
      this.logger.warn(
        `X-Internal-Key 불일치 — path: ${request.path}, ip: ${request.ip ?? 'unknown'}`,
      );
      throw new UnauthorizedException('유효하지 않은 Internal API Key입니다.');
    }

    return true;
  }

  /**
   * 타이밍 어택 방지: 고정 시간 문자열 비교
   */
  private timingSafeEqual(a: string, b: string): boolean {
    let result = a.length === b.length ? 0 : 1;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      result |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
    }
    return result === 0;
  }
}
