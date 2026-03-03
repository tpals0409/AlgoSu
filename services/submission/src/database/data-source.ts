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
});
