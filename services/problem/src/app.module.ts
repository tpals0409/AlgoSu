import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemModule } from './problem/problem.module';
import { CacheModule } from './cache/cache.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { HealthController } from './health.controller';

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
        host: configService.getOrThrow<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT', 6432),
        database: configService.getOrThrow<string>('DATABASE_NAME'),
        username: configService.getOrThrow<string>('DATABASE_USER'),
        password: configService.getOrThrow<string>('DATABASE_PASSWORD'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false, // 프로덕션 절대 금지 — Librarian Migration Only
        logging: ['error', 'warn'],
        maxQueryExecutionTime: 1000, // 1초 초과 쿼리 경고 로그 (monitoring-log-rules.md §8)
      }),
    }),
    MetricsModule,
    ProblemModule,
    CacheModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
