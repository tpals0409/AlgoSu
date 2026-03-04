/**
 * @file Gateway 루트 모듈 — 미들웨어 체인 + 글로벌 인터셉터 설정
 * @domain common
 * @layer config
 */

import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { StructuredLoggerService } from './common/logger/structured-logger.service';
import { MetricsModule } from './common/metrics/metrics.module';
import { User } from './auth/oauth/user.entity';
import { Study, StudyMember, StudyInvite } from './study/study.entity';
import { NotificationModule } from './notification/notification.module';
import { Notification } from './notification/notification.entity';
import { AvatarModule } from './avatar/avatar.module';
import { ReviewProxyModule } from './review/review.module';
import { StudyNoteProxyModule } from './study-note/study-note.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('IDENTITY_DB_HOST', 'localhost'),
        port: configService.get<number>('IDENTITY_DB_PORT', 5432),
        username: configService.get<string>('IDENTITY_DB_USER', 'algosu'),
        password: configService.get<string>('IDENTITY_DB_PASSWORD', ''),
        database: configService.get<string>('IDENTITY_DB_NAME', 'identity_db'),
        entities: [User, Study, StudyMember, StudyInvite, Notification],
        synchronize: false, // 마이그레이션으로 관리
        maxQueryExecutionTime: 200, // 200ms 초과 쿼리 경고 로그 (monitoring-log-rules.md §8-1)
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 60 },
          { name: 'submission', ttl: 60_000, limit: 10 },
        ],
        storage: new RedisThrottlerStorage(configService),
      }),
    }),
    TypeOrmModule.forFeature([User]),
    ScheduleModule.forRoot(),
    AuthModule,
    OAuthModule,
    InternalModule,
    StudyModule,
    NotificationModule,
    AvatarModule,
    ReviewProxyModule,
    StudyNoteProxyModule,
    SseModule,
    MetricsModule,
    ExternalModule,
    ProxyModule,
  ],
  providers: [
    RedisThrottlerStorage,
    RateLimitMiddleware,
    StructuredLoggerService,
    // T1: 토큰 자동 갱신 인터셉터 — 만료 5분 이내 시 새 쿠키 발급
    {
      provide: APP_INTERCEPTOR,
      useClass: TokenRefreshInterceptor,
    },
  ],
  exports: [StructuredLoggerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Request ID — 모든 요청에 X-Request-Id, X-Trace-Id 부여 (가장 먼저 실행)
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // Rate Limit — JWT 검증 전 실행 (인증 불필요)
    consumer
      .apply(RateLimitMiddleware)
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // JWT 검증
    // OAuth 콜백, 로그인 시작, JWT 갱신, Internal API, SSE는 제외
    consumer
      .apply(JwtMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'metrics', method: RequestMethod.GET },
        { path: 'auth/oauth/(.*)', method: RequestMethod.GET },
        { path: 'auth/github/link/callback', method: RequestMethod.GET },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/logout', method: RequestMethod.POST },
        { path: 'internal/(.*)', method: RequestMethod.ALL },
        { path: 'sse/submissions/:id', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
