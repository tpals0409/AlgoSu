/**
 * @file app.module.ts — Identity 서비스 루트 모듈
 * @domain identity
 * @layer module
 * @related main.ts, user.module.ts, study.module.ts, notification.module.ts
 */
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsModule } from './common/metrics/metrics.module';
import { UserModule } from './user/user.module';
import { StructuredLoggerService } from './common/logger/structured-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthController } from './health.controller';
import { User } from './user/user.entity';
import { Study, StudyMember, StudyInvite } from './study/study.entity';
import { Notification } from './notification/notification.entity';
import { ShareLink } from './share/share-link.entity';
import { Feedback } from './feedback/feedback.entity';
import { NotificationModule } from './notification/notification.module';
import { StudyModule } from './study/study.module';
import { ShareLinkModule } from './share/share-link.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        database: config.get<string>('DATABASE_NAME'),
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        entities: [User, Study, StudyMember, StudyInvite, Notification, ShareLink, Feedback],
        synchronize: false, // 마이그레이션으로 관리
        logging: ['error', 'warn'],
        maxQueryExecutionTime: 200, // 200ms 초과 쿼리 경고 로그 (monitoring-log-rules.md §8-1)
        ssl:
          config.get<string>('DATABASE_SSL') === 'true'
            ? {
                rejectUnauthorized: true, // 인증서 검증 비활성화 금지 (MITM 방어)
                ...(config.get<string>('DATABASE_SSL_CA')
                  ? {
                      ca: Buffer.from(
                        config.get<string>('DATABASE_SSL_CA')!,
                        'base64',
                      ).toString('utf-8'),
                    }
                  : {}),
              }
            : false,
        extra: {
          max: parseInt(config.get<string>('DATABASE_POOL_MAX', '20'), 10),
          min: parseInt(config.get<string>('DATABASE_POOL_MIN', '5'), 10),
          connectionTimeoutMillis: 3000,
          idleTimeoutMillis: 30000,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    MetricsModule,
    UserModule,
    NotificationModule,
    StudyModule,
    ShareLinkModule,
    FeedbackModule,
  ],
  controllers: [HealthController],
  providers: [
    StructuredLoggerService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [StructuredLoggerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // M16: 모든 요청에 X-Request-Id, X-Trace-Id 부여
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
