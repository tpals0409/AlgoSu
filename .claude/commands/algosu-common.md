## Oracle 프로토콜 (전 Agent 공통, 착수 전 필수 Read)

### 보고 체계
- **Oracle만 PM 직접 소통**. Agent의 PM 직접 응답 절대 금지
- 모든 작업은 Oracle 명시적 승인 하에 수행. 독자적 자원 접근 금지
- 작업 완료 후 Oracle 보고. 부여 권한 범위 이탈 금지

### 파일 권한
- `memory/`, skill 파일 자체 수정 금지 — Oracle(또는 Scribe 위임) 만 수정 권한
- `components/ui/` 공통 컴포넌트는 Palette 가이드 없이 생성 금지

### 코드 작성 규칙
- **클린 코드**: 의미 있는 네이밍, 함수 단일 책임, 작은 함수(20줄 이내), DRY, 에러 핸들링 분리
- **SOLID 원칙**: SRP, OCP, LSP, ISP, DIP
- **주석 필수**: 파일 헤더(`@file`, `@domain`, `@layer`, `@related`) + 함수 JSDoc
- **어노테이션 사전**: `/Users/leokim/Desktop/AlgoSu/docs/annotation-dictionary.md`
- **인라인 하드코딩 금지**: `bg-[#...]` 사용 금지, Tailwind 토큰 클래스 사용

### 참조 문서 (작업 시 해당 문서 Read)
- 어노테이션 사전: `docs/annotation-dictionary.md`
- 작업 진행 가이드: `docs/work-progress-guide.md`
- 모니터링 로그 규칙: `docs/monitoring-log-rules.md`
- CI/CD 규칙: `docs/ci-cd-rules.md`
- 마이그레이션 규칙: `docs/migration-rules.md`
- UI v2 실행계획서: `docs/AlgoSu_UIv2_실행계획서.md`
- 코드 규칙 v1.0: `/Users/leokim/Desktop/AlgoSu/plan/Code Rules/AlgoSu_Code_Conventions.md`
- 코드 규칙 v1.1: `/Users/leokim/Desktop/추가사항 문서/AlgoSu_Code_Conventions_Update_v1.1.md`

### 작업 흐름
1. Oracle 작업 할당 수령
2. `algosu-common.md` Read (이 파일)
3. 관련 코드 탐색 (`@domain`, `@layer`로 grep)
4. 구현 (위 규칙 준수)
5. 자체 검증 (빌드, 회귀, 어노테이션)
6. Oracle에 보고 (변경 파일 + 요약)
