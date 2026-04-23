---
sprint: 118
service: problem
audited_at: 2026-04-22
loc_audited: 2542
files_audited: 32
codex_sessions: [019db3cc-bd51-7842-8000-bc23d97106bd, 019db3cd-da2e-73f3-8ec5-eec511843bff, 019db3cf-0d05-73d0-a619-a0118676c4a8, 019db3d0-c6f0-7c03-ac68-a18f009fcf08]
severity_counts: { P0: 2, P1: 31, P2: 8, Low: 0 }
---

# Audit — problem

> 감사 일자: 2026-04-22 | LOC: 2542 | 파일: 32개
> P0: 2 | P1: 31 | P2: 8 | Low: 0

## P0 (머지 차단)

### P0-01 — services/problem/src/problem/internal-problem.controller.ts:67
- **category**: security
- **message**: 내부 deadline 조회가 x-study-id 헤더를 UUID로 검증하지 않아 누락 시 TypeORM where 조건에서 studyId가 무시될 수 있고, problem id만으로 다른 스터디 문제를 조회할 위험이 있습니다.
- **suggestion**: x-study-id를 필수 UUID로 검증하는 파이프나 전용 DTO/가드를 적용하고, 서비스 레이어에서도 studyId 누락 시 BadRequest를 던지도록 방어 로직을 추가하세요.

### P0-02 — services/problem/src/problem/internal-problem.controller.ts:82
- **category**: security
- **message**: 내부 단건 조회가 x-study-id 헤더를 검증하지 않아 헤더 누락 또는 undefined 전달 시 스터디 스코프가 빠진 조회가 발생할 수 있습니다.
- **suggestion**: @Headers('x-study-id', ParseUUIDPipe)처럼 런타임 검증을 적용하고, findByIdInternal 호출 전 studyId 존재 여부를 명시적으로 확인하세요.

## P1 (재검증 필수)

### P1-01 — services/problem/src/app.module.ts:40
- **category**: security
- **message**: PostgreSQL SSL 사용 시 `rejectUnauthorized: false`로 서버 인증서 검증을 비활성화해 중간자 공격에 취약합니다.
- **suggestion**: 운영 환경에서는 CA 인증서를 설정하고 `rejectUnauthorized: true`를 사용하도록 변경하세요.

### P1-02 — services/problem/src/common/metrics/metrics.controller.ts:21
- **category**: security
- **message**: `/metrics` 엔드포인트가 인증 없이 노출되어 내부 메트릭과 서비스 상태 정보가 외부에 유출될 수 있습니다.
- **suggestion**: 내부 네트워크에서만 접근하도록 제한하거나 Internal Key/IP allowlist 가드를 적용하세요.

### P1-03 — services/problem/src/common/guards/study-member.guard.ts:71
- **category**: security
- **message**: 헤더에서 받은 `studyId`, `userId`를 검증이나 URL 인코딩 없이 내부 Gateway URL 경로에 삽입해 경로 조작이 가능합니다.
- **suggestion**: ID 형식을 UUID 등으로 검증하고 URL 생성 시 `encodeURIComponent`를 적용하세요.

### P1-04 — services/problem/src/common/guards/study-member.guard.ts:74
- **category**: performance
- **message**: Gateway 멤버십 확인 `fetch`에 타임아웃이 없어 Gateway가 지연되면 보호된 요청이 무기한 대기할 수 있습니다.
- **suggestion**: `AbortController` 또는 HTTP 클라이언트 타임아웃을 설정하고 실패 시 fail-close 처리하세요.

### P1-05 — services/problem/src/common/metrics/metrics.module.ts:48
- **category**: correctness
- **message**: HTTP 메트릭 기록과 active request 감소가 tap(next/error)에 묶여 있어 Observable이 여러 값을 emit하면 중복 기록/음수 Gauge가 발생하고, emit 없이 complete되면 Gauge가 감소하지 않습니다.
- **suggestion**: tap 대신 finalize에서 요청당 1회만 duration/카운터/Gauge 감소를 수행하도록 변경하세요.

### P1-06 — services/problem/src/common/metrics/metrics.module.ts:35
- **category**: performance
- **message**: 라우트 매칭에 실패한 요청은 req.path가 그대로 path 라벨에 들어가므로 임의 URL로 Prometheus 라벨 카디널리티를 폭증시킬 수 있습니다.
- **suggestion**: req.route가 없으면 '/unmatched' 같은 고정 라벨을 사용하고, 정규화 대상도 허용된 라우트 템플릿 중심으로 제한하세요.

### P1-07 — services/problem/src/common/metrics/metrics.service.ts:50
- **category**: correctness
- **message**: SERVICE_NAME 환경값을 검증 없이 Prometheus metric name에 사용해 하이픈/공백 등 잘못된 문자가 있으면 애플리케이션 시작 시 메트릭 생성이 실패합니다.
- **suggestion**: SERVICE_NAME을 `[a-zA-Z_:][a-zA-Z0-9_:]*` 규칙에 맞게 검증하거나 안전한 문자로 치환한 뒤 prefix에 사용하세요.

### P1-08 — services/problem/src/database/data-source.ts:28
- **category**: security
- **message**: DATABASE_SSL=true일 때 TLS 인증서 검증을 rejectUnauthorized:false로 비활성화해 DB 연결이 중간자 공격에 취약해질 수 있습니다.
- **suggestion**: 프로덕션에서는 CA 인증서를 설정하고 rejectUnauthorized:true를 기본값으로 사용하세요.

### P1-09 — services/problem/src/database/dual-write.module.ts:35
- **category**: performance
- **message**: Dual Write OFF 모드에서도 기존 DB로 별도 TypeORM 연결 풀을 생성해 실제로는 불필요한 DB 연결을 방지하지 못하고 커넥션 한도를 두 배로 소모할 수 있습니다.
- **suggestion**: OFF 모드에서는 신규 연결과 신규 Repository 등록을 생략하거나 기존 Repository를 주입하도록 모듈 구성을 분리하세요.

### P1-10 — services/problem/src/database/dual-write.module.ts:72
- **category**: security
- **message**: 신규 DB SSL 연결에서도 rejectUnauthorized:false를 사용해 서버 인증서 검증이 꺼져 있습니다.
- **suggestion**: NEW_DATABASE_SSL 사용 시 CA를 명시하고 인증서 검증을 활성화하세요.

### P1-11 — services/problem/src/database/dual-write.service.ts:130
- **category**: data-integrity
- **message**: 신규 DB 쓰기가 fire-and-forget으로 실행되어 실패해도 호출자는 성공을 받으며, 재시도/보상 저장소가 없어 두 DB가 영구적으로 불일치할 수 있습니다.
- **suggestion**: outbox/재시도 큐를 도입하거나 switch-read 전환 이후에는 신규 DB 쓰기 성공을 확인한 뒤 응답하도록 일관성 정책을 명확히 구현하세요.

### P1-12 — services/problem/src/database/migrations/1700000100000-CreateProblemsTable.ts:51
- **category**: correctness
- **message**: id 기본값으로 gen_random_uuid()를 사용하지만 pgcrypto 확장을 생성하지 않아 확장이 없는 DB에서는 마이그레이션이 실패합니다.
- **suggestion**: 테이블 생성 전에 `CREATE EXTENSION IF NOT EXISTS pgcrypto`를 실행하거나 DB 초기화 스크립트 의존성을 명시적으로 보장하세요.

### P1-13 — services/problem/src/database/migrations/1700000100001-WeekNumberToVarchar.ts:18
- **category**: data-integrity
- **message**: down 마이그레이션이 week_number를 integer로 강제 변환하므로 up 이후 숫자가 아닌 값이 저장되면 롤백이 실패합니다.
- **suggestion**: varchar 전환 후 허용 포맷을 체크 제약으로 제한하거나, 롤백 전에 비숫자 값을 처리하는 검증/마이그레이션 단계를 추가하세요.

### P1-14 — services/problem/src/database/migrations/1700000100002-AddTagsColumn.ts:12
- **category**: data-integrity
- **message**: tags 컬럼을 varchar(500)으로 생성하지만 엔티티는 simple-json 배열로 저장하므로 태그가 조금만 많아져도 저장 실패나 데이터 절단 위험이 있습니다.
- **suggestion**: 엔티티와 맞춰 jsonb 또는 text 컬럼을 사용하고, 필요하면 애플리케이션/DB 양쪽에 길이 제한을 명시하세요.

### P1-15 — services/problem/src/database/migrations/1709000003000-AddPublicIdToProblems.ts:40
- **category**: correctness
- **message**: TypeORM 기본 트랜잭션 안에서 수동 COMMIT/BEGIN을 실행해 마이그레이션 상태가 깨지거나 실패 시 부분 적용될 수 있습니다.
- **suggestion**: 컬럼 추가/백필과 CONCURRENTLY 인덱스 생성을 별도 마이그레이션으로 분리하거나, 인덱스 마이그레이션에 transaction=false를 설정하고 수동 COMMIT/BEGIN을 제거하세요.

### P1-16 — services/problem/src/database/migrations/1709000015000-BackfillLevelFromDifficulty.ts:41
- **category**: data-integrity
- **message**: level=2 조건을 모두 버그 데이터로 간주해 정상적인 Bronze II 문제까지 level=3으로 덮어쓸 수 있습니다.
- **suggestion**: 버그로 생성된 행을 식별할 수 있는 created_at/source 등 추가 조건을 사용하거나, 원본 백업 테이블을 만든 뒤 검증 가능한 대상만 보정하세요.

### P1-17 — services/problem/src/database/migrations/1709000015000-BackfillLevelFromDifficulty.ts:54
- **category**: data-integrity
- **message**: down()이 중앙값 레벨을 가진 모든 행을 NULL로 바꿔 마이그레이션이 수정하지 않은 정상 데이터까지 손상시킬 수 있습니다.
- **suggestion**: up()에서 변경 대상과 원래 값을 별도 백업 테이블에 기록하고, down()은 그 백업을 기준으로 해당 행만 복원하세요.

### P1-18 — services/problem/src/database/reconciliation.service.ts:103
- **category**: correctness
- **message**: 정합성 검증 쿼리가 실패해도 mismatchCount를 차단 상태로 갱신하지 않아 첫 실패 시 switch-read가 계속 허용될 수 있습니다.
- **suggestion**: catch 블록에서 reconciliation 상태를 unhealthy로 기록하고 hasMismatch가 true를 반환하도록 하거나 별도 readiness/전환 차단 플래그를 설정하세요.

### P1-19 — services/problem/src/database/reconciliation.service.ts:117
- **category**: correctness
- **message**: row_to_json(p)::text로 전체 행을 해시하면 컬럼 순서, 자동 timestamp, 비즈니스 무관 컬럼 차이로 실제 데이터가 같아도 불일치가 발생해 읽기 전환이 차단될 수 있습니다.
- **suggestion**: 비교 대상 컬럼을 명시적으로 고정 순서로 선택하고 timestamp 등 dual-write 시 달라질 수 있는 컬럼은 정규화하거나 제외하세요.

### P1-20 — services/problem/src/database/reconciliation.service.ts:118
- **category**: correctness
- **message**: INTERVAL :interval 형태의 바인딩은 PostgreSQL에서 INTERVAL $1 구문으로 변환되어 구문 오류가 날 수 있습니다.
- **suggestion**: NOW() - CAST(:interval AS interval)처럼 명시적 CAST를 사용하거나, cutoff Date를 애플리케이션에서 계산해 p.updated_at > :cutoff로 비교하세요.

### P1-21 — services/problem/src/database/reconciliation.service.ts:122
- **category**: performance
- **message**: 최근 2시간 변경분을 getRawMany()로 한 번에 모두 메모리에 적재해 변경량이 많으면 메모리 사용량과 실행 시간이 급증합니다.
- **suggestion**: id 기준 커서 페이지네이션으로 배치 처리하거나 DB에서 old/new checksum을 조인해 불일치만 제한적으로 가져오세요.

### P1-22 — services/problem/src/health.controller.ts:23
- **category**: correctness
- **message**: readiness가 기본 DataSource만 확인해 dual-write 또는 switch-read 모드에서 신규 DB가 장애여도 준비 완료로 응답할 수 있습니다.
- **suggestion**: DUAL_WRITE_MODE가 expand/switch-read일 때 NEW_DB_CONNECTION DataSource도 주입해 SELECT 1을 함께 검사하세요.

### P1-23 — services/problem/src/problem/problem.service.ts:47
- **category**: data-integrity
- **message**: 문제 생성 시 중복 검사와 저장이 원자적으로 묶여 있지 않아 동시 요청에서 같은 studyId/weekNumber/sourceUrl 문제가 중복 생성될 수 있습니다.
- **suggestion**: DB 유니크 제약 또는 트랜잭션 내 잠금으로 중복 검사와 저장을 원자화하고, 중복 키 오류를 ConflictException으로 변환하세요.

### P1-24 — services/problem/src/problem/problem.service.ts:48
- **category**: data-integrity
- **message**: sourceUrl 중복 검사가 ACTIVE 상태만 확인해서 CLOSED 문제와 동일한 문제를 같은 주차에 다시 등록할 수 있습니다.
- **suggestion**: 의도적으로 재등록을 허용하는 경우가 아니라면 DELETED만 제외하고 ACTIVE/CLOSED/DRAFT 전체를 대상으로 중복을 검사하세요.

### P1-25 — services/problem/src/problem/problem.service.ts:167
- **category**: data-integrity
- **message**: update가 DELETED 상태 문제도 조회해 일반 필드 수정이 가능하므로 삭제된 문제의 데이터가 변경될 수 있습니다.
- **suggestion**: 수정 대상 조회 조건에 status != DELETED를 추가하거나, DELETED 상태면 즉시 BadRequest/NotFound를 반환하세요.

### P1-26 — services/problem/src/problem/problem.service.ts:181
- **category**: data-integrity
- **message**: weekNumber 또는 sourceUrl 변경 시 중복 검사를 하지 않아 기존 문제와 같은 주차/출처 URL 조합으로 충돌할 수 있습니다.
- **suggestion**: update 트랜잭션 안에서 변경 후 조합의 중복 문제를 잠금 또는 유니크 제약으로 검사하세요.

### P1-27 — services/problem/src/problem/problem.service.ts:224
- **category**: correctness
- **message**: update에서 트랜잭션 커밋 후 캐시 무효화가 실패하면 catch가 이미 커밋된 트랜잭션에 rollbackTransaction을 호출해 원래 오류를 가리고 DB는 이미 변경된 상태가 됩니다.
- **suggestion**: 커밋 이후 작업은 트랜잭션 try/catch 밖으로 분리하거나 committed 플래그를 두어 커밋 전 오류에만 rollback을 수행하세요.

### P1-28 — services/problem/src/problem/problem.service.ts:274
- **category**: correctness
- **message**: delete에서도 커밋 후 캐시 무효화나 후속 작업 실패 시 이미 커밋된 트랜잭션을 롤백하려 해 오류 처리와 API 응답이 왜곡될 수 있습니다.
- **suggestion**: 트랜잭션 범위와 커밋 후 부수효과를 분리하고, 커밋 후 실패는 별도 보상/재시도 로깅으로 처리하세요.

### P1-29 — services/problem/src/problem/problem.service.ts:218
- **category**: data-integrity
- **message**: dualWrite.saveExisting(saved)를 await 없이 호출하고 실패를 처리하지 않아 보조 저장소 쓰기 실패가 unhandled rejection이나 데이터 불일치로 남을 수 있습니다.
- **suggestion**: await 후 실패를 명시적으로 로깅/재시도 큐에 적재하거나, fire-and-forget이 필요하면 .catch로 실패 경로를 반드시 처리하세요.

### P1-30 — services/problem/src/problem/problem.service.ts:269
- **category**: data-integrity
- **message**: 삭제 후 dualWrite.saveExisting(problem) 실패를 처리하지 않아 soft delete 상태가 보조 저장소에 반영되지 않을 수 있습니다.
- **suggestion**: dual write 실패를 잡아 재시도 가능한 작업으로 기록하고, 실패가 허용되지 않는 경로라면 await하여 호출자에게 오류를 반환하세요.

### P1-31 — services/problem/src/problem/problem.service.ts:315
- **category**: performance
- **message**: 만료 문제 종료 작업이 조건에 맞는 모든 레코드를 한 번에 조회하고 순차 저장/캐시 무효화를 수행해 데이터가 많을 때 스케줄러가 장시간 블로킹될 수 있습니다.
- **suggestion**: LIMIT 기반 배치 처리 또는 벌크 UPDATE ... RETURNING으로 상태를 일괄 변경하고 캐시 무효화도 배치/비동기로 분리하세요.

## P2 (비차단)

### P2-01 — services/problem/src/cache/cache.module.ts:54
- **category**: performance
- **message**: `onModuleDestroy`에서 Redis 연결을 종료하지 않아 종료 시 소켓이 남거나 프로세스가 정상 종료되지 않을 수 있습니다.
- **suggestion**: `REDIS_CLIENT`를 주입받아 `onModuleDestroy`에서 `redis.quit()` 또는 `disconnect()`를 호출하세요.

### P2-02 — services/problem/src/common/filters/global-exception.filter.ts:68
- **category**: security
- **message**: 에러 응답의 `path`에 `req.url`을 사용해 쿼리스트링의 토큰 등 민감 값이 클라이언트 응답에 그대로 반사될 수 있습니다.
- **suggestion**: 응답에는 `req.path`만 사용하거나 쿼리 파라미터를 마스킹하세요.

### P2-03 — services/problem/src/common/logger/structured-logger.service.ts:68
- **category**: security
- **message**: 문자열 optional param을 항상 `context`로 처리해 `logger.error(message, stack)` 호출 시 운영 로그에도 스택 일부가 `context`로 기록될 수 있습니다.
- **suggestion**: Nest 로거 시그니처에 맞게 `error(message, trace?, context?)`를 분리 처리하고 운영 환경에서는 stack/trace를 마스킹하세요.

### P2-04 — services/problem/src/common/guards/study-member.guard.ts:41
- **category**: maintainability
- **message**: `canActivate`가 헤더 검증, 캐시 조회, 외부 호출, 응답 검증, 캐시 저장을 모두 포함해 길고 책임이 과도합니다.
- **suggestion**: 헤더 파싱, Gateway 멤버십 조회, 캐시 읽기/쓰기를 별도 private 메서드로 분리하세요.

### P2-05 — services/problem/src/database/migrations/1709000012000-AddLevelToProblems.ts:16
- **category**: data-integrity
- **message**: level 컬럼에 solved.ac 난이도 범위 검증이 없어 0~30 밖의 값이 DB에 저장될 수 있습니다.
- **suggestion**: CHECK (level IS NULL OR level BETWEEN 0 AND 30) 제약을 추가하세요.

### P2-06 — services/problem/src/problem/problem.service.ts:111
- **category**: correctness
- **message**: 주차별 문제 캐시 값을 JSON.parse 할 때 파싱 실패를 처리하지 않아 손상된 캐시 한 건이 조회 API를 500으로 만들 수 있습니다.
- **suggestion**: JSON.parse 실패 시 캐시를 삭제하고 DB 조회로 fallback 하도록 예외 처리를 추가하세요.

### P2-07 — services/problem/src/problem/problem.service.ts:285
- **category**: performance
- **message**: 활성 문제 전체 목록 조회에 페이지네이션이나 제한이 없어 스터디의 문제 수가 많아지면 응답 지연과 메모리 사용량이 증가합니다.
- **suggestion**: limit/cursor 또는 page/size 파라미터를 도입하고 기본 최대 조회 건수를 설정하세요.

### P2-08 — services/problem/src/problem/problem.service.ts:296
- **category**: performance
- **message**: 전체 문제 목록 조회가 ACTIVE/CLOSED 전체를 무제한으로 반환해 통계/목록 호출에서 대량 데이터 응답이 발생할 수 있습니다.
- **suggestion**: 호출 목적별로 필요한 필드만 선택하거나 페이지네이션 및 최대 제한을 적용하세요.

## Low (선택적 개선)

(없음)

