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
  database: process.env['DATABASE_NAME'] ?? 'identity_db',
  username: process.env['DATABASE_USER'] ?? 'identity_user',
  password: process.env['DATABASE_PASSWORD'] ?? '',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
