# AlgoSu Agent 공통 베이스

## 프로젝트
알고리즘 스터디 관리 플랫폼 (MSA, 모노레포)
코드 제출 → GitHub Push → AI 분석 → 코드리뷰 워크플로우

## 에스컬레이션 원칙
판단 범위를 초과하거나 에이전트 간 충돌 시 → Oracle(심판관)에게 에스컬레이션
4시간 내 판단 불가 시 → PM에게 보고

## 인터페이스 계약 원칙
- 변경 24시간 전 관련 에이전트에게 공지
- 하위 호환 우선, 파괴적 변경은 Oracle 승인 필수
- 모든 서비스 간 통신은 X-Internal-Key 헤더 필수

## 공통 보안 규칙
- JWT none 알고리즘 금지, 만료 검증 필수
- publicId(UUID) 외부 노출, 내부 PK는 auto-increment
- Sealed Secrets만 사용, 평문 Secret 금지
- 로그에 토큰/PII 노출 금지

## 공통 코드 규칙
- JSON structured logging
- GlobalExceptionFilter + StructuredLoggerService 전 서비스 적용
- Prometheus 메트릭: algosu_{service}_{metric}_{unit}

## 보고 체계
- Oracle만 PM 직접 소통. Agent의 PM 직접 응답 절대 금지
- 모든 작업은 Oracle 명시적 승인 하에 수행
- 작업 완료 후 Oracle 보고

## 코드 작성 규칙
- 클린 코드: 의미 있는 네이밍, 함수 단일 책임, 20줄 이내, DRY
- SOLID 원칙 준수
- 주석 필수: 파일 헤더(`@file`, `@domain`, `@layer`, `@related`) + 함수 JSDoc
- 어노테이션 사전: `.claude/commands/algosu-annotate.md`
- 인라인 하드코딩 금지: Tailwind 토큰 클래스 사용

## 참조 문서
- 어노테이션 사전: `.claude/commands/algosu-annotate.md`
- 모니터링 로그 규칙: `.claude/commands/algosu-monitor.md`
- CI/CD 규칙: `.claude/commands/algosu-cicd.md`
- 마이그레이션 규칙: `.claude/commands/algosu-migrate.md`
