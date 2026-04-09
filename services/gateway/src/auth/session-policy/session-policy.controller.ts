/**
 * @file Session Policy 공개 엔드포인트
 * @domain identity
 * @layer controller
 * @related session-policy.service.ts, jwt.middleware.ts (public exclude)
 *
 * GET /auth/session-policy
 * - 인증 불필요 (app.module.ts JwtMiddleware exclude 목록에 등록)
 * - FE는 로그인 이전/이후 무관하게 이 엔드포인트로 세션 파라미터 동기화
 */

import { Controller, Get } from '@nestjs/common';
import {
  SessionPolicyService,
  ClientSessionPolicyDto,
} from './session-policy.service';

@Controller('auth')
export class SessionPolicyController {
  constructor(private readonly sessionPolicyService: SessionPolicyService) {}

  @Get('session-policy')
  getPolicy(): ClientSessionPolicyDto {
    return this.sessionPolicyService.getClientPolicy();
  }
}
