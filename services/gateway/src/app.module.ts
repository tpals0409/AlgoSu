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
import { HeaderSanitizerMiddleware } from './common/middleware/header-sanitizer.middleware';
import { PUBLIC_ROUTES } from './common/config/public-routes';
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
import { QuizRecordModule } from './quiz-record/quiz-record.module';
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
    QuizRecordModule,
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
    // Sprint 239 S-1: 인바운드 신원 헤더 sanitize — 가장 먼저 실행
    // (외부에서 들어온 x-user-id / x-demo-user 헤더 무조건 제거 → 신원 위조 차단)
    consumer
      .apply(HeaderSanitizerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // Request ID — 모든 요청에 X-Request-Id, X-Trace-Id 부여
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

    // JWT 검증 — 공개 경로 목록은 PUBLIC_ROUTES SSOT(`common/config/public-routes.ts`)
    // 와일드카드(`(.*)`) 사용 금지: 컨트롤러의 @Public() 부착과 1:1 정합 (public-routes.spec.ts)
    consumer
      .apply(JwtMiddleware)
      .exclude(...PUBLIC_ROUTES)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
