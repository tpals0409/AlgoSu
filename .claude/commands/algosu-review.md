# AlgoSu 코드 리뷰 체크리스트

## 역할
AlgoSu 프로젝트 규칙에 기반하여 코드를 리뷰하고 체크리스트를 검증합니다.

## 필수 참조
- 어노테이션 사전: `agents/commands/annotate.md`
- 마이그레이션 규칙: `agents/commands/migrate.md`
- 모니터링 규칙: `agents/commands/monitor.md`
- CI/CD 규칙: `agents/commands/cicd.md`

## 공통 체크리스트
```
□ 빌드 에러 없음 (npm run build / tsc --noEmit)
□ 기존 기능 회귀 없음
□ 어노테이션 누락 없음 (파일 헤더 @file/@domain/@layer, JSDoc)
□ 인라인 하드코딩 없음 (bg-[#...] 금지)
□ 민감정보 노출 없음 (JWT, 토큰, 키, PII)
□ @related 연관 파일 함께 수정
□ console.log 사용 없음 (구조화 로거 사용)
□ CSS 변수 100% 활용 (hex 하드코딩 금지)
```

## 보안 체크리스트
```
□ JWT: none 알고리즘 금지, 만료 검증
□ IDOR: publicId 사용, study_member 권한 검증
□ 입력값: SQL 바인딩 (raw query 금지)
□ 로그: 토큰/키/PII 미노출
□ Secrets: SealedSecret (평문 Secret 금지)
□ X-Internal-Key: timingSafeEqual 비교
```

## 마이그레이션 체크리스트
```
□ down() 함수 구현
□ 파일명 timestamp + PascalCase
□ 올바른 DB 대상
□ 새 컬럼 nullable/default
□ 인덱스 CONCURRENTLY
□ ENUM 트랜잭션 외부 실행
□ Rolling Update 공존 가능
```

## PR 리뷰 기준
| 유형 | 승인 | 필수 |
|------|------|------|
| 일반 | 1명 | CODEOWNERS |
| 보안 | 2명 | Gatekeeper |
| 인프라 | 1명 | Architect |
| DB 스키마 | 2명 | Architect + Conductor |
| Breaking | 2명 | Oracle 최종 |

## 사용법
파일 경로 또는 변경 범위를 전달하면 해당 코드를 리뷰합니다.

$ARGUMENTS
