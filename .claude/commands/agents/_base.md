## Oracle 프로토콜 (전 Agent 공통, 착수 전 필수 Read)

### 보고 체계
- **Oracle만 PM 직접 소통**. Agent의 PM 직접 응답 절대 금지
- 모든 작업은 Oracle 명시적 승인 하에 수행. 독자적 자원 접근 금지
- 작업 완료 후 Oracle 보고. 부여 권한 범위 이탈 금지

### 파일 권한
- `memory/` 수정 금지 — Oracle만 직접 수정 권한. Scribe는 Oracle의 명시적 위임이 있을 때 `memory/sprint-window.md`와 `memory/MEMORY.md`만 수정 가능
- skill 파일(`.claude/commands/`) 자체 수정 금지 — Oracle만 수정 권한
- `components/ui/` 공통 컴포넌트는 Palette 가이드 없이 생성 금지

### 코드 작성 규칙
- **클린 코드**: 의미 있는 네이밍, 함수 단일 책임, 작은 함수(20줄 이내), DRY, 에러 핸들링 분리
- **SOLID 원칙**: SRP, OCP, LSP, ISP, DIP
- **주석 필수**: 파일 헤더(`@file`, `@domain`, `@layer`, `@related`) + 함수 JSDoc
- **인라인 하드코딩 금지**: `bg-[#...]` 사용 금지, Tailwind 토큰 클래스 사용

### 참조 문서 (작업 시 해당 문서 Read)
- ADR: `docs/adr/ADR-*.md`
- 스프린트 기록: `docs/adr/sprints/sprint-*.md`
- 런북: `docs/runbook/*.md`
- 어노테이션 사전: `docs/conventions/annotation-dictionary.md`
- 마이그레이션 규칙: `docs/conventions/migration-naming.md`
- 모니터링 로그 규칙: `docs/conventions/monitoring-logging.md`
- CI/CD 규칙: `docs/conventions/ci-cd.md`

### 작업 흐름
1. Oracle 작업 할당 수령
2. `.claude/commands/agents/_base.md` Read (이 파일)
3. 관련 코드 탐색 (`@domain`, `@layer`로 grep)
4. 구현 (위 규칙 준수)
5. 자체 검증 (빌드, 회귀, 어노테이션)
6. Oracle에 보고 (변경 파일 + 요약)

### 자동 Critic 리뷰 (Sprint 117~ / Sprint 246 Hermes 이전)

code-changing 에이전트(conductor, gatekeeper, librarian, architect, postman, curator, herald, palette, sensei)가 커밋을 남기면, Oracle이 **직접** Critic 리뷰를 실행합니다.
- 방식: `codex review --base <에이전트_시작_HEAD> -c model="gpt-5.5"` (Oracle 직접 호출, 서브에이전트 경유 X)
- 제외 대상: Scribe(기록), Critic(자기참조 방지), Scout(검증)
- P0/P1 발견 시 Oracle이 해당 도메인 에이전트에 수정 재위임 (`delegate_task`)

### Hermes 실행 모드 (delegate_task — Sprint 246~)

이 에이전트는 Oracle이 `delegate_task`로 위임할 때 서브에이전트로 실행됩니다.
`claude -p` 독립 프로세스 + tmux 디스패치는 Sprint 246 Decision 1에서 폐기되었습니다.

- **작업 수신**: context 필드에 스킬명(`algosu-agent-{name}`)과 작업 상세가 주입됨
- **결과 보고**: `delegate_task` 반환값으로 Oracle에게 직접 전달 (inbox 파일 불필요)
- **금지**: `discord-send.sh` 직접 호출(Sprint 206 §D2 참조), `memory/` 수정, 다른 에이전트 inbox 접근
- **Git**: 작업 단위별 atomic commit
