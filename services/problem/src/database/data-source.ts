import { DataSource } from 'typeorm';

/**
 * TypeORM CLI용 DataSource 설정
 * migration:run, migration:revert 명령에서 사용
 *
 * synchronize: false — 프로덕션 절대 금지
 */
export default new DataSource({
  type: 'postgres',
  host: process.env['DATABASE_HOST'] ?? 'localhost',
  port: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
  database: process.env['DATABASE_NAME'] ?? 'problem_db',
  username: process.env['DATABASE_USER'] ?? 'problem_user',
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
