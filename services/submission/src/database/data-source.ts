/**
 * @file data-source.ts — TypeORM CLI 전용 DataSource (마이그레이션 실행용)
 * @domain submission
 * @layer config
 * @related app.module.ts
 */
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env['DATABASE_HOST'] ?? 'localhost',
  port: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
  database: process.env['DATABASE_NAME'] ?? 'submission_db',
  username: process.env['DATABASE_USER'] ?? 'submission_user',
  password: process.env['DATABASE_PASSWORD'] ?? '',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  extra: {
    max: parseInt(process.env.DATABASE_POOL_MAX ?? '20', 10),
    min: parseInt(process.env.DATABASE_POOL_MIN ?? '5', 10),
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
  },
});
