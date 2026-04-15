/**
 * @file dual-write.module.ts — Dual Write 모듈 (Phase 3 신·구 DB 연결 관리)
 * @domain problem
 * @layer module
 * @related dual-write.service.ts, dual-write.config.ts, reconciliation.service.ts
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Problem } from '../problem/problem.entity';
import { DualWriteService } from './dual-write.service';
import { ReconciliationService } from './reconciliation.service';
import { getDualWriteMode, DualWriteMode, NEW_DB_CONNECTION } from './dual-write.config';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * Dual Write Module — Phase 3 DB 물리 분리
 *
 * DUAL_WRITE_MODE=off: 구 DB fallback 연결 (실제 쓰기 안 함)
 * DUAL_WRITE_MODE=expand/switch-read: 신 DB 연결 + 양쪽 쓰기
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    // 신규 DB 연결 (Problem 전용 PostgreSQL)
    TypeOrmModule.forRootAsync({
      name: NEW_DB_CONNECTION,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const mode = getDualWriteMode();
        const isActive = mode !== DualWriteMode.OFF;

        if (!isActive) {
          // OFF 모드: 구 DB와 동일 연결로 fallback (불필요한 신 DB 연결 방지)
          return {
            type: 'postgres' as const,
            host: configService.getOrThrow<string>('DATABASE_HOST'),
            port: configService.get<number>('DATABASE_PORT', 5432),
            database: configService.getOrThrow<string>('DATABASE_NAME'),
            username: configService.getOrThrow<string>('DATABASE_USER'),
            password: configService.getOrThrow<string>('DATABASE_PASSWORD'),
            entities: [Problem],
            synchronize: false,
            logging: false,
            ssl:
              configService.get<string>('DATABASE_SSL') === 'true'
                ? { rejectUnauthorized: false }
                : false,
            extra: {
              max: parseInt(configService.get<string>('DATABASE_POOL_MAX', '20'), 10),
              min: parseInt(configService.get<string>('DATABASE_POOL_MIN', '5'), 10),
              connectionTimeoutMillis: 3000,
              idleTimeoutMillis: 30000,
            },
          };
        }

        return {
          type: 'postgres' as const,
          host: configService.getOrThrow<string>('NEW_DATABASE_HOST'),
          port: configService.get<number>('NEW_DATABASE_PORT', 5432),
          database: configService.get<string>('NEW_DATABASE_NAME', 'problem_db'),
          username: configService.get<string>('NEW_DATABASE_USER', 'problem_user'),
          password: configService.getOrThrow<string>('NEW_DATABASE_PASSWORD'),
          entities: [Problem],
          synchronize: false,
          logging: ['error', 'warn'],
          ssl:
            configService.get<string>('NEW_DATABASE_SSL', configService.get<string>('DATABASE_SSL', 'false')) === 'true'
              ? { rejectUnauthorized: false }
              : false,
          extra: {
            max: parseInt(configService.get<string>('DATABASE_POOL_MAX', '20'), 10),
            min: parseInt(configService.get<string>('DATABASE_POOL_MIN', '5'), 10),
            connectionTimeoutMillis: 3000,
            idleTimeoutMillis: 30000,
          },
        };
      },
    }),
    // 양쪽 Repository 등록
    TypeOrmModule.forFeature([Problem]),
    TypeOrmModule.forFeature([Problem], NEW_DB_CONNECTION),
  ],
  providers: [DualWriteService, ReconciliationService, StructuredLoggerService],
  exports: [DualWriteService, ReconciliationService, TypeOrmModule],
})
export class DualWriteModule {}
