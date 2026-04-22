/**
 * @file data-source.ts — TypeORM CLI용 DataSource 설정
 * @domain identity
 * @layer config
 * @related migrations/
 */
import { DataSource } from 'typeorm';

/**
 * PostgreSQL TLS 옵션을 빌드합니다.
 *
 * 운영 환경에서는 `DATABASE_SSL=true` + `DATABASE_SSL_CA`(base64 PEM) 을 함께 설정해야
 * 중간자 공격(MITM)을 방어할 수 있습니다.
 * CA를 생략하면 Node.js 기본 시스템 CA 번들로 검증합니다(공인 인증서에 적합).
 *
 * @returns TypeORM `ssl` 옵션 객체 또는 `false`
 */
function buildSslOptions(): { rejectUnauthorized: boolean; ca?: string } | false {
  if (process.env['DATABASE_SSL'] !== 'true') {
    return false;
  }

  const rawCa = process.env['DATABASE_SSL_CA'];
  return {
    rejectUnauthorized: true, // 인증서 검증 비활성화 금지 (MITM 방어)
    ...(rawCa ? { ca: Buffer.from(rawCa, 'base64').toString('utf-8') } : {}),
  };
}

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
  ssl: buildSslOptions(),
  extra: {
    max: parseInt(process.env['DATABASE_POOL_MAX'] ?? '20', 10),
    min: parseInt(process.env['DATABASE_POOL_MIN'] ?? '5', 10),
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
  },
});
