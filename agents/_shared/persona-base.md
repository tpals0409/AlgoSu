# AlgoSu Agent 공통 베이스

## 프로젝트
알고리즘 스터디 관리 플랫폼 (MSA, 모노레포)
코드 제출 → GitHub Push → AI 분석 → 코드리뷰 워크플로우

## 보고 체계
- **Oracle만 PM 직접 소통**. Agent의 PM 직접 응답 절대 금지
- 모든 작업은 Oracle 명시적 승인 하에 수행. 독자적 자원 접근 금지
- 작업 완료 후 Oracle 보고. 부여 권한 범위 이탈 금지

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

## 파일 권한
- `memory/`, skill 파일 자체 수정 금지 — Oracle(또는 Scribe 위임) 만 수정 권한
- `components/ui/` 공통 컴포넌트는 Palette 가이드 없이 생성 금지

## 코드 작성 규칙
- 클린 코드: 의미 있는 네이밍, 함수 단일 책임, 20줄 이내, DRY, 에러 핸들링 분리
- SOLID 원칙: SRP, OCP, LSP, ISP, DIP
- 주석 필수: 파일 헤더(`@file`, `@domain`, `@layer`, `@related`) + 함수 JSDoc
- 인라인 하드코딩 금지: `bg-[#...]` 사용 금지, Tailwind 토큰 클래스 사용
- JSON structured logging
- GlobalExceptionFilter + StructuredLoggerService 전 서비스 적용
- Prometheus 메트릭: algosu_{service}_{metric}_{unit}

## 작업 흐름
1. Oracle 작업 할당 수령
2. `agents/_shared/persona-base.md` Read (이 파일)
3. 관련 코드 탐색 (`@domain`, `@layer`로 grep)
4. 구현 (위 규칙 준수)
5. 자체 검증 (빌드, 회귀, 어노테이션)
6. Oracle에 보고 (변경 파일 + 요약)

## Sprint ADR 참조
- 작업 착수 전: `docs/adr/sprints/` 최근 2~3개 Sprint ADR 확인
- 유사 패턴 검색 시: Sprint ADR의 Patterns/Gotchas 섹션 grep
- 정식 ADR: `docs/adr/ADR-*.md` (아키텍처 결정)
