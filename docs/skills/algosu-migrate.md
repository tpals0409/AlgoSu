# AlgoSu DB 마이그레이션 작성 도우미

## 역할
AlgoSu 마이그레이션 규칙에 따라 TypeORM 마이그레이션 파일을 작성하거나 검증합니다.

## 필수 참조
- 마이그레이션 규칙: `/root/AlgoSu/docs/migration-rules.md`

## DB 구조 (3-DB 분리)
- `identity_db` (Identity, Gateway): users, studies, study_members, study_invites, notifications
- `problem_db` (Problem): problems, algorithm_tags
- `submission_db` (Submission): submissions, drafts, review_comments, review_replies, study_notes

## 핵심 규칙
1. `down()` 함수 필수
2. `synchronize: true` 프로덕션 절대 금지
3. Rolling Update 구/신 공존 가정
4. 컬럼 추가: nullable 또는 DEFAULT 필수
5. 컬럼 삭제/rename: Expand-Contract 3단계
6. 인덱스: `CREATE INDEX CONCURRENTLY` (트랜잭션 외부)
7. ENUM 추가: `ALTER TYPE ADD VALUE IF NOT EXISTS` (트랜잭션 외부)

## 파일 네이밍
`{unix_timestamp}-{PascalCaseDescription}.ts`

## UUID publicId 표준 패턴
```typescript
// 1. nullable UUID 추가
// 2. gen_random_uuid() 기존 데이터
// 3. NOT NULL 제약
// 4. UNIQUE INDEX CONCURRENTLY (COMMIT → CREATE → BEGIN)
```

## k8s 실행 환경
```yaml
command: ["node", "./node_modules/typeorm/cli.js", "migration:run", "-d", "dist/src/data-source.js"]
```
npm 없음 → node 직접 호출

## 사용법
마이그레이션 설명을 인자로 전달하면 규칙에 맞는 마이그레이션 파일을 생성합니다.

$ARGUMENTS
