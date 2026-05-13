# DB Connection Pool & DataSource 설정 현황

> Sprint 50 W3-1 / W3-7 — 2026-03-16 작성

## 1. 서비스별 TypeORM DataSource 설정 비교

| 설정 항목 | Gateway | Submission | Problem | Identity |
|-----------|---------|------------|---------|----------|
| DB 이름 | identity_db | env 필수 | env 필수 | env 선택 |
| 기본 포트 | 5432 | **6432** (PgBouncer) | 5432 | 5432 |
| env 방식 | `get` (기본값 O) | `getOrThrow` | `getOrThrow` | `get` (기본값 O) |
| synchronize | `false` | `false` | `false` | `false` |
| logging | 미설정 (TypeORM 기본) | `['error', 'warn']` | `['error', 'warn']` | `['error', 'warn']` |
| maxQueryExecutionTime | `200ms` | `200ms` | `200ms` | `200ms` |
| entities 로딩 | 명시 배열 (6개) | glob 패턴 | glob 패턴 | 명시 배열 (1개) |
| migrations | 미설정 | glob 패턴 | glob 패턴 | 미설정 |
| ssl | 미설정 | 미설정 | 미설정 | 미설정 |
| connectTimeout | 미설정 | 미설정 | 미설정 | 미설정 |
| extra (pool) | 미설정 | 미설정 | 미설정 | 미설정 |

## 2. TypeORM 기본값 (미설정 시 적용)

TypeORM은 내부적으로 `pg` 드라이버의 `Pool` 을 사용하며, 명시하지 않은 항목은 아래 기본값이 적용된다.

| 항목 | 기본값 | 비고 |
|------|--------|------|
| pool.max (최대 연결 수) | **10** | `extra.max` 로 오버라이드 |
| pool.min (최소 유휴 연결) | **0** | pg Pool 기본값 |
| pool.idleTimeoutMillis | **10000** (10초) | 유휴 연결 해제까지 대기 |
| pool.connectionTimeoutMillis | **0** (무제한) | 연결 획득 대기 타임아웃 |
| connectTimeout | 미설정 (OS TCP 기본) | pg 드라이버 레벨 |
| synchronize | `false` | 전 서비스 명시적 false |
| logging | `false` | Gateway만 해당 (나머지 명시) |
| maxQueryExecutionTime | 미설정 (측정 안 함) | 전 서비스 200ms 명시 |
| ssl | `false` | 전 서비스 미설정 |
| cache | `false` | 전 서비스 미설정 |

## 3. OCI ARM 환경 권장값

현재 OCI ARM 인스턴스 (1 OCPU / 6GB RAM) 에서 4개 서비스가 단일 PostgreSQL을 공유한다.

### 현재 상태

- 4 서비스 x pool.max 10 = **최대 40 연결**
- PostgreSQL 기본 `max_connections = 100` 기준 여유 있음
- Submission 서비스만 포트 6432 (PgBouncer 경유)

### 권장 설정

| 항목 | 권장값 | 이유 |
|------|--------|------|
| `extra.max` | **5** (서비스당) | 4서비스 x 5 = 20. ARM 1코어에서 과도한 풀 불필요 |
| `extra.min` | **1** | Cold-start 방지용 최소 1개 유지 |
| `extra.idleTimeoutMillis` | **30000** | 10초는 너무 짧아 재연결 빈번. 30초 권장 |
| `extra.connectionTimeoutMillis` | **5000** | 무제한 대기 방지 (데드락 감지) |
| `connectTimeout` | **10000** | DB 미응답 시 빠른 실패 |
| `ssl` | `{ rejectUnauthorized: false }` | TLS 도입 시 활성화 (현재 미사용) |

### 적용 예시 (공통 패턴)

```typescript
useFactory: (config: ConfigService) => ({
  type: 'postgres' as const,
  host: config.getOrThrow<string>('DATABASE_HOST'),
  port: config.get<number>('DATABASE_PORT', 5432),
  database: config.getOrThrow<string>('DATABASE_NAME'),
  username: config.getOrThrow<string>('DATABASE_USER'),
  password: config.getOrThrow<string>('DATABASE_PASSWORD'),
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: ['error', 'warn'],
  maxQueryExecutionTime: 200,
  extra: {
    max: 5,
    min: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  },
}),
```

## 4. 서비스별 차이점 요약

| 차이점 | 상세 |
|--------|------|
| Gateway logging 미설정 | 다른 3개 서비스는 `['error', 'warn']` 명시. Gateway는 TypeORM 기본 `false` 적용 중 |
| Submission 포트 6432 | PgBouncer 경유. 나머지는 직접 5432 연결 |
| Gateway env 기본값 | host/port에 fallback 있음. Submission/Problem은 `getOrThrow`로 누락 시 즉시 실패 |
| Gateway DB 직접 접근 | identity_db에 직접 연결 (ADR-001 보류 사항) |
| migrations 미설정 | Gateway, Identity는 migration glob 미설정 |
