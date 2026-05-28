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

> **운영 성숙 단계 (Sprint 209)**: Sprint 206 시드 → Sprint 208 Item 2 자동 매핑·Item 3 `--full`·Item 4 window 검증 → Sprint 209 Item 5 3-way·Item 6 정리 로드맵 점검 심화로 6-항목 전부 실제 검증 단계 진입. `--full`(실제 LLM ping)은 로컬 sprint마감 전용이며 CI 게이트로 통합하지 않는다(§3 참조). 스크립트 로직 회귀는 `tests/ci/harness-checkup-test.sh`가 CI에서 portable하게 검증한다.

## 1. 실행 방법

```bash
# 모든 항목 실제 검증 (Item 3는 명령 영속화만 — API 호출 없음)
scripts/harness-checkup.sh

# Item 3까지 실제 LLM ping 호출 (unique 모델 전체, API 비용 발생)
scripts/harness-checkup.sh --full

# 명령 영속화만 확인 (실제 호출/네트워크 없음)
scripts/harness-checkup.sh --dry-run

# CI 로직 회귀 테스트 (소스 가드·dry-run·Item 5/6 degrade — API/oracle 인프라 불요)
bash tests/ci/harness-checkup-test.sh
```

종료 코드:
- `0` — 모든 FAIL 항목 0건 (WARN은 통과로 간주)
- `1` — 1건 이상 FAIL

## 2. 6 자동화 항목

| # | 항목 | 검증 명령 | 정합 기준 | 실패 시 조치 |
|---|------|----------|----------|------------|
| 1 | CLI 백엔드 가용성 | `command -v claude && command -v codex && command -v tmux` | 셋 다 PATH에서 발견 | 누락 CLI 설치 또는 PATH 확인. Sprint 202 Cmux.app PATH 1순위 패치 참조 (`docs/runbook/oracle-model-ssot.md`) |
| 2 | SSOT 일치 | `jq -r '.agents[] \| .name+" "+.model' .claude-team.json` ↔ `oracle-spawn.sh --show-model <agent>` 12 에이전트 자동 비교 (Sprint 208 D') | 12 에이전트 모델 매핑 모두 일치 | 신규 모델 출시 시 양쪽 동기 (Sprint 202 패턴) |
| 3 | 모델 ID 호환 | (기본) 명령 영속화 / (`--full`) `.claude-team.json` unique 모델 전체 `claude --model <ID> -p "ping"` 실호출 (Sprint 208 D') | `--full` 시 모든 unique 모델 정상 응답 | Cmux.app 업데이트 또는 모델 ID rollback (Sprint 202 dry-run 패턴) |
| 4 | dispatch fire 흔적 + window 상태 | `find ~/.claude/oracle/logs/ -name '*.out' -mtime -7` + `tmux list-windows -t oracle` (control/tier1/tier2/tier3) (Sprint 208 D) | 최근 7일 로그 ≥1 + 4 window 존재 | 디스패치 동작 검증 / tier2 window 자동 소멸 회귀는 oracle-spawn.sh 자동 재생성 (ADR sprint-208) |
| 5 | autoCritic 동기화 3-way | `.claude-team.json dispatch.codeChangingAgents` ↔ `oracle-auto-critic.sh CODE_CHANGING_AGENTS` ↔ `_base.md §자동 Critic 리뷰` (Sprint 209) | 9 에이전트 3종 SSOT 동일 (git 외부 `oracle-auto-critic.sh` 부재 시 json↔_base.md 2-way degrade WARN) | 한쪽 변경 시 3종 동시 갱신 |
| 6 | dormant 잔재 + 정리 로드맵 | `git grep 'discord-send\|oracle-respond\|discord-receiver'` + `git ls-files .claude-tools/` + `claude-tools.md §4` 삭제 Phase ✅ 점검 (Sprint 209) | 키워드 0건 + tracked 잔재 0건 + 삭제 작업 Phase 전체 ✅ | 잔재 정리 / `.claude-tools/` gitignore 확인 / 미완료 cleanup Phase 종결 |

## 3. 권장 주기

### 기본 실행 (`harness-checkup.sh` — API 호출 없음)
- **Sprint 단위 1회** — 새 sprint 시작 시 `/start` 흐름에 통합 가능
- **월 1회 정기점검 sprint** — Sprint 202 같은 정기점검 sprint에서 본 스크립트 실행 + 결과를 ADR에 영속화
- **모델/하네스 큰 변경 직후** — Cmux.app 업데이트, claude/codex CLI 메이저 업데이트, `.claude-team.json` 변경 시 즉시 1회

### `--full` 실행 (실제 LLM ping — API 비용 발생, Sprint 209 결정)
- **sprint마감 시점 1회 권장** — `/stop` 흐름에 비블로킹 리마인더 명시 (`stop.md` 1단계). unique 모델 ID retirement를 sprint마감마다 사전 감지.
- **Cmux.app 업데이트 직후 1회** — 모델 ID retirement 발생 가능성이 가장 높은 시점.
- **로컬 전용** — `--full`은 `~/.claude/oracle/` 인프라 + claude CLI + API 키에 의존하므로 **GitHub CI 게이트로 통합하지 않는다**. CI는 GitHub-hosted `ubuntu-latest` fresh clone이라 해당 인프라/키가 부재 → Item 1 FAIL·2/4/5 degrade로 노이즈가 된다. CI에서는 `tests/ci/harness-checkup-test.sh`가 스크립트 **로직 회귀**만 portable하게 검증한다(소스 가드·dry-run·Item 5/6 degrade). ADR sprint-209 §Phase A 참조.

## 4. 트러블슈팅

### Item 1 FAIL — CLI 누락
- `claude` 누락: Cmux.app 미설치 또는 `/Applications/cmux.app/Contents/Resources/bin/` 미PATH. Cmux.app 재설치 또는 PATH 1순위 확인.
- `codex` 누락: `npm install -g @openai/codex` 또는 Cmux.app 번들 확인.
- `tmux` 누락: `brew install tmux`.

### Item 2 FAIL — SSOT 불일치
- 신규 모델 출시(예: opus 4.7 → 4.8) 시 `.claude-team.json agents[].model` 갱신했으나 `oracle-spawn.sh get_model()` case 분기 미갱신 시 발생.
- 양쪽 모두 갱신 후 재실행. Sprint 202 ADR §"모델 SSOT 통합 패턴" 참조.

### Item 3 WARN — 시드 단계 메시지
- 기본 실행(`--full` 없음)에서는 정상 — 명령 영속화만. 실제 LLM ping 호출은 `scripts/harness-checkup.sh --full`로 실행 (Sprint 208 D').

### Item 3 FAIL — `--full` 모델 ID 호환 실패
- `--full` 실행 시 unique 모델 중 일부가 ping 무응답. Cmux.app 업데이트로 모델 ID retirement 발생 가능 — `.claude-team.json` 모델 ID 갱신 또는 rollback.

### Item 4 FAIL — oracle window 누락
- `control/tier1/tier2/tier3` 중 일부 누락. `oracle-spawn.sh`가 다음 spawn 시 자동 재생성하나(Sprint 208 B2), 점검 단계 사전 감지 신호. `tmux list-windows -t oracle`로 확인 후 dispatch 1회로 자동 복구.

### Item 4 WARN — 로그 0건
- 최근 7일 디스패치 미사용. 정상일 수도 있으나 일반적으로 활성 sprint면 흔적 존재. 직전 dispatch가 정상 완료되었는지 `oracle-status.sh`로 확인.

### Item 5 FAIL — autoCritic 동기화 3-way 깨짐 (Sprint 209)
- 3종 SSOT(`.claude-team.json dispatch.codeChangingAgents` ↔ `oracle-auto-critic.sh CODE_CHANGING_AGENTS` ↔ `_base.md §자동 Critic 리뷰`) 중 불일치.
- `json ↔ _base.md 불일치` FAIL: 둘 다 git tracked이라 CI/로컬 공통. 양쪽 9 에이전트 목록 정합 복원 후 재실행.
- `json ↔ oracle-auto-critic.sh 불일치` FAIL: git 외부 스크립트가 stale. `~/.claude/oracle/bin/oracle-auto-critic.sh CODE_CHANGING_AGENTS` 갱신.

### Item 5 WARN — 2-way degrade (정상)
- `oracle-auto-critic.sh 미발견(git 외부)` WARN: CI/다른 머신에서 정상. tracked SSOT 2종(json↔_base.md)만 검증됨. 로컬 oracle 세션 환경에서는 3-way PASS여야 함.

### Item 6 FAIL/WARN — dormant 잔재 + 정리 로드맵 (Sprint 209)
- `dormant 키워드 N건 잔존` FAIL: `discord-send`/`oracle-respond`/`discord-receiver` 키워드가 코드에 남아있음. 위치 확인 후 정리. 의도된 placeholder(`_base.md:51`)는 자동 제외됨.
- `.claude-tools/ git-tracked 잔재 N건` WARN: `.claude-tools/`는 gitignore 정책상 untracked여야 함(`claude-tools.md §1`). `git rm --cached` 후 `.gitignore` 확인.
- `§4 정리 로드맵 미완료(삭제 작업 ✅ 누락)` WARN: `claude-tools.md §4` 표에 삭제(deletion) 작업 Phase 행이 추가되었으나 ✅ 미표기. 해당 cleanup Phase 종결 후 ✅ 표기. 명문화 단계(Phase 1)는 '삭제' 미포함이라 자연 제외됨.

## 5. 이력

| 시점 | 내용 |
|------|------|
| Sprint 202 | 하네스 정기점검 6-항목 신규 패턴 정의 (ADR sprint-202 §"신규 패턴 ①") |
| Sprint 206 | 본 스크립트 + RUNBOOK 시드 — Item 1·4·5·6은 실제 검증, Item 2·3은 명령 영속화 단계 |
| Sprint 208 | Item 2 — `oracle-spawn.sh --show-model` 비파괴 서브커맨드로 12 에이전트 매핑 자동 비교, Item 3 — `--full` 플래그 시 unique 모델 전체 실호출, Item 4 — tmux oracle 4 window 상태 검증 추가 (ADR sprint-208) |
| Sprint 209 | Item 5 — autoCritic 동기화 3-way 확장(`+_base.md §자동 Critic 리뷰`, git 외부 `oracle-auto-critic.sh` 부재 시 2-way degrade), Item 6 — `.claude-tools/` git-tracked 잔재 0건 + `§4 정리 로드맵` 삭제 Phase ✅ 점검 심화. `--full` 로컬 전용 결정(CI 게이트 미통합) + `tests/ci/harness-checkup-test.sh` 로직 회귀 테스트 + 소스 가드 + `/stop` 비블로킹 리마인더 (ADR sprint-209) |
