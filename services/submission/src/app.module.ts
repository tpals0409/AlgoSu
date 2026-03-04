import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SubmissionModule } from './submission/submission.module';
import { ReviewModule } from './review/review.module';
import { StudyNoteModule } from './study-note/study-note.module';
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
        synchronize: false, // 프로덕션 절대 금지
        logging: ['error', 'warn'],
        maxQueryExecutionTime: 200, // 200ms 초과 쿼리 경고 로그 (monitoring-log-rules.md §8-1)
      }),
    }),
    ScheduleModule.forRoot(),
    MetricsModule,
    SubmissionModule,
    ReviewModule,
    StudyNoteModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
