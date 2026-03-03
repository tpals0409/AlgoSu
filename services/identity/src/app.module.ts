import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsModule } from './common/metrics/metrics.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthController } from './health.controller';
import { User } from './user/user.entity';

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
        entities: [User],
        synchronize: false, // 마이그레이션으로 관리
        logging: ['error', 'warn'],
        maxQueryExecutionTime: 200, // 200ms 초과 쿼리 경고 로그 (monitoring-log-rules.md §8-1)
      }),
    }),
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // M16: 모든 요청에 X-Request-Id, X-Trace-Id 부여
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
