/**
 * @file auth.module.ts — JWT/Passport 인증 모듈 구성
 * @domain auth
 * @layer module
 * @related jwt.strategy.ts, jwt.middleware.ts, oauth.module.ts, session-policy.module.ts
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { SessionPolicyModule } from './session-policy/session-policy.module';
import { SessionPolicyService } from './session-policy/session-policy.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    SessionPolicyModule,
    JwtModule.registerAsync({
      imports: [ConfigModule, SessionPolicyModule],
      inject: [ConfigService, SessionPolicyService],
      useFactory: (
        configService: ConfigService,
        sessionPolicyService: SessionPolicyService,
      ) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256', // 'none' 절대 불허 — HS256 명시 고정
          // Sprint 71-1R: SessionPolicyService SSoT 경유
          // (env JWT_EXPIRES_IN 는 SessionPolicyService 내부에서 파싱)
          expiresIn: sessionPolicyService.getAccessTokenTtl(),
        },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule, PassportModule, SessionPolicyModule],
})
export class AuthModule {}
