/**
 * @file 데모 유저 쓰기 차단 가드 — 데모 모드에서 CUD 작업 차단
 * @domain common
 * @layer guard
 * @guard demo-write
 * @related JwtMiddleware (x-demo-user 헤더 주입)
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

/** POST/PATCH/DELETE 중 데모 유저에게 허용할 경로 */
const DEMO_WRITE_ALLOWLIST = [
  'POST /auth/logout',
  'POST /auth/refresh',
  'GET /auth/heartbeat',
];

/**
 * 데모 유저(x-demo-user: true)의 쓰기 요청을 차단한다.
 * GET 요청은 무조건 통과, 허용 목록에 있는 경로도 통과.
 * @guard demo-write
 */
@Injectable()
export class DemoWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.headers['x-demo-user'] !== 'true') {
      return true;
    }

    if (request.method === 'GET') {
      return true;
    }

    const routeKey = `${request.method} ${request.path}`;
    if (DEMO_WRITE_ALLOWLIST.some((allowed) => routeKey.startsWith(allowed))) {
      return true;
    }

    throw new ForbiddenException('데모 모드에서는 수정할 수 없습니다.');
  }
}
