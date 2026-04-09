/**
 * @file Gateway 루트 모듈 — 미들웨어 체인 + 글로벌 인터셉터 설정
 * @domain common
 * @layer config
 */

import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { OAuthModule } from './auth/oauth/oauth.module';
import { InternalModule } from './internal/internal.module';
import { StudyModule } from './study/study.module';
import { ExternalModule } from './external/external.module';
import { ProxyModule } from './proxy/proxy.module';
import { SseModule } from './sse/sse.module';
import { JwtMiddleware } from './auth/jwt.middleware';
import { TokenRefreshInterceptor } from './auth/token-refresh.interceptor';
import { RedisThrottlerStorage } from './rate-limit/redis-throttler.storage';
import { RateLimitMiddleware } from './rate-limit/rate-limit.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { LoggerModule } from './common/logger/logger.module';
import { StructuredLoggerService } from './common/logger/structured-logger.service';
import { MetricsModule } from './common/metrics/metrics.module';
import { NotificationModule } from './notification/notification.module';
import { ShareLinkModule } from './share/share-link.module';
import { AvatarModule } from './avatar/avatar.module';
import { ReviewProxyModule } from './review/review.module';
import { StudyNoteProxyModule } from './study-note/study-note.module';
import { IdentityClientModule } from './identity-client/identity-client.module';
import { EventLogModule } from './event-log/event-log.module';
import { FeedbackModule } from './feedback/feedback.module';
import { DemoWriteGuard } from './common/guards/demo-write.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 60 },
          { name: 'submission', ttl: 60_000, limit: 10 },
        ],
        storage: new RedisThrottlerStorage(configService, new StructuredLoggerService()),
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    OAuthModule,
    InternalModule,
    StudyModule,
    ShareLinkModule,
    NotificationModule,
    AvatarModule,
    ReviewProxyModule,
    StudyNoteProxyModule,
    SseModule,
    MetricsModule,
    ExternalModule,
    IdentityClientModule,
    EventLogModule,
    FeedbackModule,
    LoggerModule,
    ProxyModule, // CatchAllController(@All('*')) 포함 — 반드시 마지막 import
  ],
  controllers: [HealthController],
  providers: [
    JwtMiddleware,
    RedisThrottlerStorage,
    RateLimitMiddleware,
    // 데모 유저 쓰기 차단 가드 — x-demo-user: true 시 CUD 요청 차단
    {
      provide: APP_GUARD,
      useClass: DemoWriteGuard,
    },
    // Sprint 71-1R: 토큰 자동 갱신 인터셉터 — 임계값은 SessionPolicyService(env SESSION_REFRESH_THRESHOLD)
    {
      provide: APP_INTERCEPTOR,
      useClass: TokenRefreshInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Request ID — 모든 요청에 X-Request-Id, X-Trace-Id 부여 (가장 먼저 실행)
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // Security Headers — 모든 응답에 보안 헤더 5종 추가
    consumer
      .apply(SecurityHeadersMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // Rate Limit — JWT 검증 전 실행 (인증 불필요)
    consumer
      .apply(RateLimitMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // JWT 검증
    // OAuth 콜백, 로그인 시작, JWT 갱신, Internal API, SSE, 세션 정책 공개 조회는 제외
    consumer
      .apply(JwtMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'metrics', method: RequestMethod.GET },
        { path: 'auth/oauth/(.*)', method: RequestMethod.GET },
        { path: 'auth/github/link/callback', method: RequestMethod.GET },
        { path: 'auth/demo', method: RequestMethod.POST },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/logout', method: RequestMethod.POST },
        // Sprint 71-1R: SessionPolicy 공개 엔드포인트 — FE 로그인 전/후 무관 조회
        { path: 'auth/session-policy', method: RequestMethod.GET },
        { path: 'internal/(.*)', method: RequestMethod.ALL },
        { path: 'sse/submissions/:id', method: RequestMethod.GET },
        { path: 'sse/notifications', method: RequestMethod.GET },
        { path: 'api/public/(.*)', method: RequestMethod.GET },
        { path: 'api/events', method: RequestMethod.POST },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
