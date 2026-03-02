# TypeORM 마이그레이션 작성 규칙

> Librarian(기록관리자) 관리 문서 | 2026-03-02 (v2.0: UI v2 전면 교체 반영)
> 참조: `docs/AlgoSu_UIv2_실행계획서.md` (Section 5), `docs/monitoring-log-rules.md` (Section 8)

---

## 1. 핵심 원칙

1. **모든 마이그레이션은 반드시 롤백 가능해야 합니다** — `down()` 함수 필수
2. **프로덕션에서 `synchronize: true` 절대 금지**
3. **Rolling Update 중 구/신 버전 공존 상황을 항상 가정합니다**
4. **DB별 마이그레이션 분리** — 각 서비스 DB에 해당하는 마이그레이션만 포함

---

## 2. DB 구조 (3-DB 분리)

| DB | 서비스 | 엔티티 |
|---|---|---|
| `identity_db` | Identity, Gateway | users, studies, study_members, notifications |
| `problem_db` | Problem | problems, algorithm_tags |
| `submission_db` | Submission | submissions, review_comments, review_replies, study_notes |

**마이그레이션 실행 위치**: 각 서비스의 initContainer에서 실행

```yaml
initContainers:
  - name: migration
    command: ["node", "./node_modules/typeorm/cli.js", "migration:run", "-d", "dist/src/data-source.js"]
```

> `npm run migration:run` 대신 `node` 직접 호출 — npm 제거된 runner 이미지 호환

---

## 3. Expand-Contract 패턴

### 3-1. 컬럼 추가 (nullable)

```typescript
// 한 번에 배포 허용
await queryRunner.addColumn('table', new TableColumn({
  name: 'publicId',
  type: 'uuid',
  isNullable: true,  // 기존 데이터 호환
}));
```

### 3-2. 컬럼 추가 (NOT NULL)

```typescript
// DEFAULT 값 필수 — 기존 행 즉시 적용
await queryRunner.addColumn('table', new TableColumn({
  name: 'isLate',
  type: 'boolean',
  default: false,
  isNullable: false,
}));
```

### 3-3. 컬럼 삭제/rename — 반드시 3단계

```
1단계 (Expand):   새 컬럼 추가 + 구 컬럼 유지 (1차 배포)
2단계 (Migrate):  데이터 복사 + 코드 전환 (2차 배포)
3단계 (Contract): 구 컬럼 삭제 (3차 배포)
```

### 3-4. 인덱스 추가

```sql
-- CONCURRENTLY 옵션 필수 (테이블 락 방지)
CREATE INDEX CONCURRENTLY idx_name ON table (column);
```

TypeORM에서는 `QueryRunner.query()` 직접 실행:

```typescript
await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_publicId" ON "users" ("publicId")`);
```

> 주의: CONCURRENTLY는 트랜잭션 내부에서 실행 불가. `await queryRunner.query('COMMIT')` 후 실행.

---

## 4. UUID publicId 마이그레이션 가이드 (Sprint UI-1)

모든 엔티티에 `publicId` UUID v4 컬럼을 추가하는 표준 패턴:

### 4-1. 마이그레이션 구조

```typescript
export class AddPublicIdToUsers1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. nullable UUID 컬럼 추가
    await queryRunner.addColumn('users', new TableColumn({
      name: 'publicId',
      type: 'uuid',
      isNullable: true,
    }));

    // 2. 기존 데이터에 UUID 생성 (gen_random_uuid)
    await queryRunner.query(`UPDATE "users" SET "publicId" = gen_random_uuid() WHERE "publicId" IS NULL`);

    // 3. NOT NULL 제약 추가
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "publicId" SET NOT NULL`);

    // 4. UNIQUE 인덱스 (CONCURRENTLY 주의)
    await queryRunner.query('COMMIT');
    await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY "IDX_users_publicId" ON "users" ("publicId")`);
    await queryRunner.query('BEGIN');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_publicId"`);
    await queryRunner.dropColumn('users', 'publicId');
  }
}
```

### 4-2. 적용 대상

| 엔티티 | DB | 마이그레이션 파일명 |
|---|---|---|
| users | identity_db | `AddPublicIdToUsers.ts` |
| studies | identity_db | `AddPublicIdToStudies.ts` |
| problems | problem_db | `AddPublicIdToProblems.ts` |
| submissions | submission_db | `AddPublicIdToSubmissions.ts` |
| notifications | identity_db | `AddPublicIdToNotifications.ts` |

---

## 5. ENUM 타입 마이그레이션 가이드

PostgreSQL ENUM은 `ALTER TYPE ... ADD VALUE`로만 값 추가 가능 (삭제 불가).

### 5-1. ENUM 값 추가

```typescript
export class ExtendNotificationTypeEnum1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ENUM에 새 값 추가 (IF NOT EXISTS로 멱등성 보장)
    await queryRunner.query(`ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'DEADLINE_REMINDER'`);
    await queryRunner.query(`ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'MEMBER_JOINED'`);
    await queryRunner.query(`ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'MEMBER_LEFT'`);
    await queryRunner.query(`ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'STUDY_CLOSED'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ENUM 값 삭제는 PostgreSQL에서 직접 불가 — 새 타입으로 교체 필요
    // 운영에서는 down() 실행하지 않음 (forward-only 원칙)
    // 개발 환경에서만: 타입 재생성으로 처리
  }
}
```

> **주의**: `ALTER TYPE ADD VALUE`는 트랜잭션 내부에서 실행 불가 (PostgreSQL 제약). TypeORM `queryRunner`가 자동 트랜잭션을 열 경우 `COMMIT` 후 실행.

### 5-2. VARCHAR → ENUM 전환 (Sprint UI-6 M2)

기존 VARCHAR `role` 컬럼을 ENUM으로 전환하는 3단계:

```
1단계: 새 ENUM 타입 생성 + 새 컬럼(ENUM) 추가
2단계: 데이터 복사 (VARCHAR → ENUM CAST)
3단계: 구 컬럼 삭제 + 새 컬럼 rename
```

---

## 6. Soft-Delete 테이블 가이드 (Sprint UI-5)

`review_comments`, `review_replies`는 soft-delete 패턴 사용:

```typescript
await queryRunner.createTable(new Table({
  name: 'review_comments',
  columns: [
    { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
    { name: 'publicId', type: 'uuid', isNullable: false },
    { name: 'submissionId', type: 'int', isNullable: false },
    { name: 'authorId', type: 'int', isNullable: false },
    { name: 'studyId', type: 'int', isNullable: false },
    { name: 'lineNumber', type: 'int', isNullable: true },
    { name: 'content', type: 'text', isNullable: false },
    { name: 'createdAt', type: 'timestamptz', default: 'now()' },
    { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
    { name: 'deletedAt', type: 'timestamptz', isNullable: true },  // soft-delete
  ],
}));
```

**규칙:**
- `deletedAt IS NULL` 조건을 모든 쿼리에 포함 (TypeORM `@DeleteDateColumn` 자동 처리)
- 삭제된 행은 "삭제된 댓글입니다" 텍스트로 대체 표시
- 물리 삭제 금지 — 감사 추적용 보존

---

## 7. DB 분리 마이그레이션 (Expand-Contract 적용)

Problem DB, Submission DB, Identity DB 분리에 사용하는 dual-write 패턴:

```
Phase 1 — expand:       구 DB primary write + 신 DB fire-and-forget write
Phase 2 — switch-read:  신 DB primary read (구 DB read fallback)
Phase 3 — switch-write: 신 DB primary write (구 DB fire-and-forget)
Phase 4 — contract:     구 DB 연결 제거
```

**Reconciliation**: 매시간 Cron, md5 checksum 비교로 양쪽 DB 정합성 검증.

현황:
- Problem DB: expand 완료 → **switch-read 대기** (Sprint 3-1 Contract)
- Submission DB: Sprint UI-2 병렬 (3-2)
- Identity DB: Sprint UI-3 병렬 (3-3)

---

## 8. 마이그레이션 파일 네이밍

```
{unix_timestamp}-{PascalCaseDescription}.ts
```

예시:
```
1700000000000-CreateSubmissionsAndDrafts.ts
1709000001000-AddPublicIdToUsers.ts
1709000002000-ExtendNotificationTypeEnum9.ts
1709000003000-AddGroundRulesToStudies.ts
1709000004000-CreateReviewTables.ts
```

---

## 9. 마이그레이션 인벤토리 (UI v2 계획)

| # | 파일명 | DB | Sprint | 내용 |
|---|---|---|---|---|
| 1 | `AddPublicIdToUsers.ts` | identity_db | UI-1 | users.publicId UUID + unique index |
| 2 | `AddPublicIdToStudies.ts` | identity_db | UI-1 | studies.publicId UUID + unique index |
| 3 | `AddPublicIdToProblems.ts` | problem_db | UI-1 | problems.publicId UUID + unique index |
| 4 | `AddPublicIdToSubmissions.ts` | submission_db | UI-1 | submissions.publicId UUID + unique index |
| 5 | `AddPublicIdToNotifications.ts` | identity_db | UI-1 | notifications.publicId UUID + unique index |
| 6 | `ExtendNotificationTypeEnum9.ts` | identity_db | UI-2 | ENUM 4개 추가 |
| 7 | `AddGroundRulesToStudies.ts` | identity_db | UI-2 | studies.groundRules TEXT nullable |
| 8 | `AddIsLateToSubmissions.ts` | submission_db | UI-2 | submissions.isLate BOOLEAN default false |
| 9 | `AddNicknameToStudyMembers.ts` | identity_db | UI-2 | study_members.nickname VARCHAR(50) NOT NULL |
| 10 | `CreateReviewTables.ts` | submission_db | UI-5 | review_comments + review_replies (soft-delete, 인덱스 4개) |
| 11 | `CreateStudyNotes.ts` | submission_db | UI-5 | study_notes (problem_id + study_id unique, content TEXT) |

---

## 10. 마이그레이션 로그

initContainer 실행 시 구조화 JSON 로그 필수 (상세: `monitoring-log-rules.md` Section 8-2):

```json
{"tag": "MIGRATION_START", "service": "identity", "db": "identity_db", "podName": "..."}
{"tag": "MIGRATION_EXECUTE", "name": "1709000001000-AddPublicIdToUsers", "seq": 1, "total": 5, "elapsedMs": 145}
{"tag": "MIGRATION_COMPLETE", "executed": 5, "skipped": 0, "totalElapsedMs": 412, "result": "success"}
```

실패 시 exit code 1 → Pod CrashLoopBackOff. 수동 개입은 Oracle 승인 필수.

---

## 11. 금지 사항

| 금지 항목 | 이유 |
|---|---|
| `synchronize: true` (프로덕션) | 자동 스키마 변경으로 데이터 손실 위험 |
| `down()` 함수 누락 | PR 머지 불가 — 롤백 불가능 마이그레이션 금지 |
| `DROP COLUMN` 단독 마이그레이션 | Expand-Contract 3단계 필수 |
| 인덱스 추가 시 `CONCURRENTLY` 미사용 | 테이블 락으로 서비스 중단 |
| 다른 DB 대상 마이그레이션 혼재 | 서비스별 DB 분리 원칙 위반 |
| `npm run migration:run` (k8s 환경) | runner 이미지에 npm 없음 → `node` 직접 호출 |
| 마이그레이션 파일 삭제 (이미 실행된 것) | TypeORM 히스토리 불일치 → 재실행 위험 |
| ENUM 값 삭제 | PostgreSQL 제약 — 새 타입 교체로만 가능 |

---

## 12. 코드 리뷰 체크리스트

PR에 마이그레이션이 포함될 때:

```
기본 검증
  □ down() 함수 구현 및 롤백 검증
  □ 파일명 타임스탬프 + PascalCase 준수
  □ 올바른 DB 대상 (identity_db / problem_db / submission_db)

스키마 변경
  □ 새 컬럼이 nullable 또는 default 있음 (기존 데이터 호환)
  □ NOT NULL 추가 시 기존 데이터 UPDATE 선행
  □ 인덱스 CONCURRENTLY 사용
  □ ENUM 변경 시 트랜잭션 외부 실행

안전성
  □ Rolling Update 중 구/신 버전 공존 가능
  □ 파괴적 변경(컬럼 삭제/rename)은 Expand-Contract 3단계
  □ 대용량 테이블 UPDATE는 배치 처리 (1000행씩)
  □ 마이그레이션 로그 태그 포함 (MIGRATION_START/EXECUTE/COMPLETE)
```
