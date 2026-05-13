# Migration 파일명 규칙

## 신규 규칙 (Sprint 50~)

```
YYYYMMDDHHMMSS-<Issue번호>-<설명>.ts
```

| 항목 | 형식 | 예시 |
|------|------|------|
| 타임스탬프 | `YYYYMMDDHHMMSS` (14자리) | `20260316120000` |
| Issue 번호 | `SP{스프린트번호}` 또는 GitHub Issue `#{번호}` | `SP50`, `#142` |
| 설명 | PascalCase, 동사+명사 | `CreateShareLinksTable` |

**예시**: `20260316120000-SP50-CreateShareLinksTable.ts`

## 기존 패턴 (레거시)

TypeORM 타임스탬프 패턴 `{13자리숫자}-<설명>.ts`를 사용 중이다.

| 서비스 | 경로 | 파일 예시 |
|--------|------|-----------|
| identity | `services/identity/src/database/migrations/` | `1700000300000-CreateStudiesTables.ts` |
| identity | 〃 | `1709000001000-AddPublicIdToUsers.ts` |
| identity | 〃 | `1709000010000-AddStatusToStudies.ts` |
| problem | `services/problem/src/database/migrations/` | `1700000100000-CreateProblemsTable.ts` |
| problem | 〃 | `1709000012000-AddLevelToProblems.ts` |
| submission | `services/submission/src/database/migrations/` | `1709000010000-CreateReviewTables.ts` |
| submission | 〃 | `1709000011000-CreateStudyNotes.ts` |

> gateway 서비스는 `synchronize: false` 설정이지만 별도 migration 디렉토리가 아직 없다.

## 규칙 요약

1. **파일명 정렬 = 실행 순서**. 타임스탬프가 정렬 기준이므로 UTC 기준으로 기록한다.
2. **1 마이그레이션 = 1 변경 단위**. DDL과 DML을 혼합하지 않는다.
3. **up/down 필수 구현**. 롤백 불가능한 경우 down에 주석으로 사유를 명시한다.
4. **기존 레거시 파일은 리네이밍하지 않는다**. 신규 파일부터 적용한다.
