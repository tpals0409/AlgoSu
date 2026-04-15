/**
 * @file oauth.module.ts — GitHub OAuth 인증 모듈
 * @domain auth
 * @layer module
 * @related oauth.controller.ts, oauth.service.ts, session-policy.module.ts
 */
import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { SessionPolicyModule } from '../session-policy/session-policy.module';

@Module({
  imports: [SessionPolicyModule],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
