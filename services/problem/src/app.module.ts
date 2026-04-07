import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemModule } from './problem/problem.module';
import { CacheModule } from './cache/cache.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { DualWriteModule } from './database/dual-write.module';
import { HealthController } from './health.controller';
import { StructuredLoggerService } from './common/logger/structured-logger.service';

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
        port: configService.get<number>('DATABASE_PORT', 5432),
        database: configService.getOrThrow<string>('DATABASE_NAME'),
        username: configService.getOrThrow<string>('DATABASE_USER'),
        password: configService.getOrThrow<string>('DATABASE_PASSWORD'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: ['error', 'warn'],
        maxQueryExecutionTime: 200,
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
      }),
    }),
    DualWriteModule,
    MetricsModule,
    ProblemModule,
    CacheModule,
  ],
  controllers: [HealthController],
  providers: [StructuredLoggerService],
  exports: [StructuredLoggerService],
})
export class AppModule {}
