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

### 자동 Critic 리뷰 (Sprint 117~)

code-changing 에이전트(conductor, gatekeeper, librarian, architect, postman, curator, herald, palette, sensei)가 커밋을 남기면, 완료 후 **Critic(Codex 교차 리뷰)이 자동으로 큐잉**됩니다.
- 트리거: 에이전트 실행 전후 `git rev-parse HEAD` 비교 → 차이가 있으면 `oracle-auto-critic.sh` 호출
- Critic은 `codex review --base <에이전트_시작_HEAD>` 로 변경분만 리뷰
- 제외 대상: Scribe(기록), Critic(자기참조 방지), Scout(검증)
- P0/P1 발견 시 Oracle이 해당 도메인 에이전트에 수정 재위임

### 독립 실행 모드 (tmux dispatch)

이 에이전트가 `claude -p`로 독립 프로세스로 실행된 경우:

- **작업 수신**: 프롬프트에 `작업 ID`와 `작업 설명`이 포함됨
- **결과 보고**: 지정된 `결과 파일 경로`에 Markdown 파일을 Write
- **결과 형식**: `~/.claude/oracle/_result-protocol.md` 규약 준수
- **금지**: `discord-send.sh` 직접 호출, `memory/` 수정, 다른 에이전트 inbox 접근
- **Git**: 작업 단위별 atomic commit, 커밋 본문에 `task_id` 포함

#### inbox Write 실패 시 fallback chain (Sprint 126 A2)

`~/.claude/oracle/inbox/`는 비결정적으로 Write 권한 차단이 발생할 수 있다 (Sprint 125 D2 H1 가설 — `~/.claude/` sensitive path 보호 추정). 결과 파일 작성이 실패해도 작업 결과를 잃지 않도록 아래 순서로 fallback 시도:

1. **Write 도구** (1순위) — 표준 경로
2. **Bash heredoc** (2순위) — `cat > "$결과파일경로" <<'EOF' ... EOF`
3. **python3 file write** (3순위) — `python3 -c "open('경로','w').write(open('/dev/stdin').read())" <<'EOF' ... EOF`
4. **stdout 마커 폴백** (4순위, 최후) — Bash로 `printf '__RESULT_START__\n%s\n__RESULT_END__\n' "$결과내용"` 실행. `oracle-reap.sh`가 log에서 추출.

**보안 가드** (필수 준수):
- 결과 본문에 시크릿/JWT/API 키/PII가 포함될 가능성이 있으면 fallback 2~4 사용 금지 (Write 실패 시 작업 실패 처리)
- 일반 코드리뷰/조사 보고서는 시크릿 미포함 → fallback 사용 가능
- Bash heredoc/printf는 ps 출력 + shell history에 일시 노출되므로 민감 정보 회피
