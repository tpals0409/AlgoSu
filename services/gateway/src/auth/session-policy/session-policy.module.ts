/**
 * @file Session Policy 모듈 — JWT TTL / refresh / heartbeat SSoT 모듈
 * @domain identity
 * @layer config
 * @related auth.module.ts, token-refresh.interceptor.ts, oauth.service.ts
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionPolicyService } from './session-policy.service';
import { SessionPolicyController } from './session-policy.controller';

@Module({
  imports: [ConfigModule],
  providers: [SessionPolicyService],
  controllers: [SessionPolicyController],
  exports: [SessionPolicyService],
})
export class SessionPolicyModule {}
