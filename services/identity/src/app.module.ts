import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { NotificationModule } from './notification/notification.module';
import { StudyModule } from './study/study.module';
import { ShareLinkModule } from './share/share-link.module';

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
        entities: [User, Study, StudyMember, StudyInvite, Notification, ShareLink],
        synchronize: false, // 마이그레이션으로 관리
        logging: ['error', 'warn'],
        maxQueryExecutionTime: 200, // 200ms 초과 쿼리 경고 로그 (monitoring-log-rules.md §8-1)
      }),
    }),
    MetricsModule,
    UserModule,
    NotificationModule,
    StudyModule,
    ShareLinkModule,
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
