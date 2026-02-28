import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './common/metrics/metrics.module';
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
        maxQueryExecutionTime: 1000, // 1초 초과 쿼리 경고 로그 (monitoring-log-rules.md §8)
      }),
    }),
    MetricsModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
