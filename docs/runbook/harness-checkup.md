---
type: runbook
domain: local-dev
related:
  - docs/runbook/claude-tools.md
  - docs/runbook/oracle-model-ssot.md
  - docs/runbook/oracle-tmux-path.md
---
# AlgoSu 하네스 정기점검 (Harness Checkup)

AlgoSu 에이전트 하네스(Cmux.app 번들 claude + tmux Oracle dispatch + Codex CLI 교차 리뷰)의 정기점검 절차를 자동화합니다. Sprint 202에서 정의한 6-항목 신규 패턴을 Sprint 206에서 스크립트로 시드했습니다.

> **시드 단계**: 본 sprint(206)에서는 스크립트와 RUNBOOK까지 작성하고, 실제 정기점검 실행은 다음 정기점검 sprint에서 본 스크립트를 활용합니다. Item 2·3은 명령 영속화 위주이며 향후 sprint에서 자동 비교/실제 호출 로직을 보강합니다.

## 1. 실행 방법

```bash
# 모든 항목 실제 검증
scripts/harness-checkup.sh

# 명령 영속화만 확인 (실제 호출/네트워크 없음)
scripts/harness-checkup.sh --dry-run
```

종료 코드:
- `0` — 모든 FAIL 항목 0건 (WARN은 통과로 간주)
- `1` — 1건 이상 FAIL

## 2. 6 자동화 항목

| # | 항목 | 검증 명령 | 정합 기준 | 실패 시 조치 |
|---|------|----------|----------|------------|
| 1 | CLI 백엔드 가용성 | `command -v claude && command -v codex && command -v tmux` | 셋 다 PATH에서 발견 | 누락 CLI 설치 또는 PATH 확인. Sprint 202 Cmux.app PATH 1순위 패치 참조 (`docs/runbook/oracle-model-ssot.md`) |
| 2 | SSOT 일치 | `jq -r '.agents[] \| .name+" "+.model' .claude-team.json` ↔ `oracle-spawn.sh get_model()` | 12 에이전트 모델 매핑 모두 일치 | 신규 모델 출시 시 양쪽 동기 (Sprint 202 패턴) |
| 3 | 모델 ID 호환 | `claude --model <ID> -p "ping"` → "pong" | 모든 활성 모델 정상 응답 | Cmux.app 업데이트 또는 모델 ID rollback (Sprint 202 dry-run 패턴) |
| 4 | dispatch fire 흔적 | `find ~/.claude/oracle/logs/ -name '*.out' -mtime -7` | 최근 7일 정상 종료 로그 ≥1 | 디스패치 정상 동작 검증 또는 cleanup 정책 확인 |
| 5 | autoCritic 동기화 | `.claude-team.json dispatch.codeChangingAgents` ↔ `oracle-auto-critic.sh CODE_CHANGING_AGENTS` | 9 에이전트 동일 | 한쪽 변경 시 양쪽 동시 갱신 (`_base.md §자동 Critic 리뷰`) |
| 6 | dormant 잔재 | `git grep -n 'discord-send\|oracle-respond\|discord-receiver' -- ':!docs/' ':!_base.md'` | 0건 | 잔재 위치 정리 또는 RUNBOOK 명시적 예외 추가 |

## 3. 권장 주기

- **Sprint 단위 1회** — 새 sprint 시작 시 `/start` 흐름에 통합 가능 (시드 — 다음 sprint에서 hook 시도)
- **월 1회 정기점검 sprint** — Sprint 202 같은 정기점검 sprint에서 본 스크립트 실행 + 결과를 ADR에 영속화
- **모델/하네스 큰 변경 직후** — Cmux.app 업데이트, claude/codex CLI 메이저 업데이트, `.claude-team.json` 변경 시 즉시 1회

## 4. 트러블슈팅

### Item 1 FAIL — CLI 누락
- `claude` 누락: Cmux.app 미설치 또는 `/Applications/cmux.app/Contents/Resources/bin/` 미PATH. Cmux.app 재설치 또는 PATH 1순위 확인.
- `codex` 누락: `npm install -g @openai/codex` 또는 Cmux.app 번들 확인.
- `tmux` 누락: `brew install tmux`.

### Item 2 FAIL — SSOT 불일치
- 신규 모델 출시(예: opus 4.7 → 4.8) 시 `.claude-team.json agents[].model` 갱신했으나 `oracle-spawn.sh get_model()` case 분기 미갱신 시 발생.
- 양쪽 모두 갱신 후 재실행. Sprint 202 ADR §"모델 SSOT 통합 패턴" 참조.

### Item 3 WARN — 시드 단계 메시지
- 정상. 다음 정기점검 sprint에서 실제 LLM 호출 추가 예정.

### Item 4 WARN — 로그 0건
- 최근 7일 디스패치 미사용. 정상일 수도 있으나 일반적으로 활성 sprint면 흔적 존재. 직전 dispatch가 정상 완료되었는지 `oracle-status.sh`로 확인.

### Item 5 FAIL — autoCritic 동기화 깨짐
- 자동 critic이 잘못된 에이전트를 큐잉하거나 누락 가능. 양쪽 SSOT 정합 복원 후 재실행.
- 변경 시 `_base.md §자동 Critic 리뷰` 9 에이전트 목록도 동기.

### Item 6 FAIL — dormant 잔재
- `discord-send`/`oracle-respond`/`discord-receiver` 키워드가 코드에 남아있음. 위치 확인 후 정리.
- 의도된 placeholder(`_base.md:51`)는 자동 제외됨.

## 5. 이력

| 시점 | 내용 |
|------|------|
| Sprint 202 | 하네스 정기점검 6-항목 신규 패턴 정의 (ADR sprint-202 §"신규 패턴 ①") |
| Sprint 206 | 본 스크립트 + RUNBOOK 시드 — Item 1·4·5·6은 실제 검증, Item 2·3은 명령 영속화 단계 |
| Sprint 207+ (계획) | Item 2 — JSON↔Shell 매핑 자동 비교, Item 3 — 12 모델 전체 dry-run 호출 |
