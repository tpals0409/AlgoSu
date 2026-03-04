# AlgoSu 마이그레이션 규칙 요약

> 원본: `/root/AlgoSu/docs/migration-rules.md`

## 핵심 원칙
1. 모든 마이그레이션 `down()` 필수
2. 프로덕션 `synchronize: true` 절대 금지
3. Rolling Update 중 구/신 버전 공존 가정
4. DB별 마이그레이션 분리

## Expand-Contract 패턴
- 컬럼 추가 (nullable): 한 번에 배포 허용
- 컬럼 추가 (NOT NULL): DEFAULT 값 필수
- 컬럼 삭제/rename: 3단계 (Expand → Migrate → Contract)
- 인덱스: `CREATE INDEX CONCURRENTLY` 필수 (트랜잭션 외부)

## UUID publicId 표준 패턴
```
1. nullable UUID 컬럼 추가
2. 기존 데이터 gen_random_uuid()
3. NOT NULL 제약 추가
4. UNIQUE INDEX CONCURRENTLY
```

## 파일 네이밍
`{unix_timestamp}-{PascalCaseDescription}.ts`

## 마이그레이션 인벤토리 (UI v2, 11개)
1-5: AddPublicId (Users/Studies/Problems/Submissions/Notifications)
6: ExtendNotificationTypeEnum9
7: AddGroundRulesToStudies
8: AddIsLateToSubmissions
9: AddNicknameToStudyMembers
10: CreateReviewTables (soft-delete)
11: CreateStudyNotes

## 금지 사항
- `synchronize: true`, `down()` 누락, `DROP COLUMN` 단독
- CONCURRENTLY 미사용, 다른 DB 혼재, 실행된 파일 삭제, ENUM 값 삭제
- k8s에서 `npm run migration:run` (npm 없음 → `node` 직접 호출)

## 실행 환경
```yaml
initContainers:
  - command: ["node", "./node_modules/typeorm/cli.js", "migration:run", "-d", "dist/src/data-source.js"]
```
