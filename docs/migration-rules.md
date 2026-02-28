# TypeORM 마이그레이션 작성 규칙

> Librarian(기록관리자) 관리 문서

## 핵심 원칙

1. **모든 마이그레이션은 반드시 롤백 가능해야 합니다** — `down()` 함수 필수
2. **프로덕션에서 `synchronize: true` 절대 금지**
3. **Rolling Update 중 구/신 버전 공존 상황을 항상 가정합니다**

## Expand-Contract 패턴

### 컬럼 추가 (nullable)
```typescript
// 한 번에 배포 허용
await queryRunner.addColumn('table', new TableColumn({ isNullable: true, ... }))
```

### 컬럼 추가 (NOT NULL)
```typescript
// DEFAULT 값 필수
await queryRunner.addColumn('table', new TableColumn({ default: 'value', isNullable: false, ... }))
```

### 컬럼 삭제/rename — 반드시 3단계
```
1단계 (Expand):  새 컬럼 추가 + 구 컬럼 유지
2단계 (Migrate): 데이터 복사 (별도 배포)
3단계 (Contract): 구 컬럼 삭제 (별도 배포)
```

### 인덱스 추가
```sql
-- CONCURRENTLY 옵션 필수 (테이블 락 방지)
CREATE INDEX CONCURRENTLY idx_name ON table (column);
```

## 마이그레이션 파일 네이밍

```
{unix_timestamp}-{PascalCaseDescription}.ts
예: 1700000000000-CreateSubmissionsAndDrafts.ts
```

## 금지 사항

- `auto-synchronize: true` — 프로덕션 절대 금지
- `down()` 함수 없는 마이그레이션 — PR 머지 불가
- 롤백 불가능한 `DROP COLUMN` 단독 마이그레이션
- 인덱스 추가 시 `CONCURRENTLY` 미사용
