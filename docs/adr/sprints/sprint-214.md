---
sprint: 214
title: "Echelon 1 티어 모델 claude-opus-4-8 전환"
date: "2026-05-29"
status: completed
agents: [Oracle, Critic]
related_adrs: ["sprint-202", "sprint-208", "sprint-209"]
related_memory: ["sprint-window", "oracle-dispatch"]
topics: ["oracle", "agents", "harness", "config"]
tldr: "AlgoSu 에이전트 하네스의 Echelon 1(tier 1) 에이전트 conductor·gatekeeper·librarian 모델을 claude-opus-4-7에서 claude-opus-4-8로 승격했다. Sprint 202에서 확립한 모델 ID SSOT 3곳(.claude-team.json agents[].model / 각 agent .md frontmatter / oracle-spawn.sh get_model() 폴백 case)을 동기 갱신하고, RUNBOOK oracle-model-ssot.md의 패치 코드·기대 출력도 Sprint 214 상태로 갱신했다. palette(tier 3 opus 예외)와 Oracle lead 자체 모델은 사용자 스코프 지시('에셜론 1티어')에 따라 4-7로 유지하여, 종전 conductor|gatekeeper|librarian|palette 단일 case를 Echelon 1(→4-8)과 palette(→4-7) 두 case로 분리했다. 착수 전 claude-opus-4-8 ping(→pong)으로 Cmux/CLI 호환을 확인하고, harness Item 2(.claude-team.json ↔ oracle-spawn.sh --show-model 3-way 정합) PASS + jq-lookup·폴백 양쪽 경로를 직접 검증했다. Critic(Codex) CLEAN."
---
# Sprint 214 — Echelon 1 티어 모델 claude-opus-4-8 전환

## 목표

- Echelon 1(tier 1) 에이전트 **conductor·gatekeeper·librarian**의 모델을 `claude-opus-4-7` → `claude-opus-4-8`로 승격한다.
- [Sprint 202](./sprint-202.md)에서 확립한 모델 ID SSOT 3곳을 동기 갱신하여 정합을 유지한다.
- palette(tier 3 opus 예외)와 Oracle lead 자체 모델은 사용자 스코프 지시에 따라 4-7로 유지한다.

## 배경

[Sprint 202](./sprint-202.md)에서 `.claude-team.json` `agents[].model`이 데드 코드였던 문제를 해소하고, `oracle-spawn.sh` `get_model()`을 `.claude-team.json`을 jq-lookup하도록 리팩토링하여 모델 ID SSOT를 통합했다. 이후 모델 ID는 다음 3곳이 정합을 이뤄야 한다.

1. `.claude-team.json` `agents[].model` — 주 SSOT (jq-lookup 대상)
2. `~/.claude/oracle/bin/oracle-spawn.sh` `get_model()` 폴백 `case` — jq 미설치/JSON 손상 시 안전망 (repo 외부, RUNBOOK [oracle-model-ssot.md](../../runbook/oracle-model-ssot.md)에 패치 보존)
3. 각 에이전트 `.claude/commands/agents/{name}.md` frontmatter `model:`

`harness-checkup.sh` Item 2가 (1) ↔ (2)의 정합을, Item 3(`--full`)이 unique 모델 ID의 실제 ping 응답을 검증한다.

사용자 지시는 "에셜론 1티어 모델 변경 Opus4.8" — **Echelon 1 티어(tier 1)** 에이전트만 대상으로 명시했다. Echelon 1은 conductor·gatekeeper·librarian 3개다. palette는 tier 3이나 opus를 쓰는 예외 케이스이고, Oracle은 lead(tier 외)이므로 이번 스코프에서 제외한다.

## 결정

### D0. 스코프 — Echelon 1(tier 1) 3개 에이전트만 승격

- **대상**: conductor, gatekeeper, librarian → `claude-opus-4-8`
- **제외 (4-7 유지)**:
  - **palette** (tier 3, opus 예외) — 사용자가 "에셜론 1티어"로 한정. 디자인 시스템 작업의 모델 정책은 별개 결정 사항이므로 본 스프린트에서 변경하지 않는다.
  - **Oracle lead** (`.claude/commands/algosu-oracle.md` frontmatter) — tier 1 에이전트가 아닌 lead/심판관. 스코프 외.
  - **번역 도구** (`docs/adr-en/README.md`의 translate-adr.mjs 모델) — 에이전트 모델과 무관.

### D1. 폴백 case 분리

종전 `oracle-spawn.sh:43`은 `conductor|gatekeeper|librarian|palette`를 한 case로 묶어 모두 `claude-opus-4-7`을 반환했다. Echelon 1만 4-8로 승격하므로 case를 둘로 분리한다.

```bash
# Before
conductor|gatekeeper|librarian|palette) echo "claude-opus-4-7" ;;
# After
conductor|gatekeeper|librarian) echo "claude-opus-4-8" ;;
palette) echo "claude-opus-4-7" ;;
```

RUNBOOK `oracle-model-ssot.md`의 §3 패치 코드, §5 기대 출력, §6 ping 예시도 동일하게 분리·갱신하여 다른 머신 replay 시 Sprint 214 상태가 재현되도록 한다.

### D2. 모델 ID 사전 검증 (ping)

신규 모델 ID `claude-opus-4-8`이 실제 호출 가능한지 착수 전 1회 확인한다 (Sprint 202의 Cmux 호환 dry-run 패턴 계승).

```bash
claude --model claude-opus-4-8 -p "ping"   # → pong (호환 OK)
```

ping 실패였다면 4-8 ID가 아직 가용하지 않다는 의미이므로 승격을 보류하는 결정 트리였다.

### D3. Oracle 직접 수행

본 변경 대상은 모두 `.claude/commands/` skill/agent 파일과 repo 외부 harness 스크립트(`~/.claude/oracle/bin/`)다. `_base.md` 규약상 일반 에이전트는 skill 파일을 수정할 수 없고(Oracle 전용), harness 스크립트는 repo 외부다. 따라서 Oracle이 직접 단순 config 수정으로 처리하고, 머지 게이트에서 Critic(Codex) 교차 리뷰를 받는다.

## 구현

단일 atomic commit `efea4d2` (`chore(oracle): bump Echelon 1 tier model to claude-opus-4-8`), PR #376 Squash merge → main `a1c9167`.

### 수정 파일 (in-repo, 5개)

- `.claude-team.json` — conductor/gatekeeper/librarian `model` 3개를 `claude-opus-4-8`로 (palette 19행은 4-7 유지)
- `.claude/commands/agents/conductor.md` — frontmatter `model: claude-opus-4-8`
- `.claude/commands/agents/gatekeeper.md` — frontmatter `model: claude-opus-4-8`
- `.claude/commands/agents/librarian.md` — frontmatter `model: claude-opus-4-8`
- `docs/runbook/oracle-model-ssot.md` — §헤더 Sprint 214 개정 노트 + §3 패치 case 분리 + §3 예시 + §5 기대 출력 + §6 ping 예시 갱신

### 수정 파일 (repo 외부, 1개)

- `~/.claude/oracle/bin/oracle-spawn.sh:43` — `get_model()` 폴백 case 분리 (Echelon 1 → 4-8, palette → 4-7). git에 추적되지 않으므로 PR diff에는 잡히지 않고, RUNBOOK에 패치 코드로 보존된다.

## 검증

Oracle 직접 검증:

- `bash -n ~/.claude/oracle/bin/oracle-spawn.sh` → 문법 OK
- `jq -r '.agents[] | "\(.name) \(.model)"' .claude-team.json` → conductor/gatekeeper/librarian = `claude-opus-4-8`, palette = `claude-opus-4-7`, 나머지 8개 = `claude-sonnet-4-6`
- `oracle-spawn.sh --show-model <agent>` (3-way SSOT 대조) → JSON 매핑과 완전 일치
- **폴백 case 경로 검증** — `PATH="/usr/bin:/bin"`로 jq를 가린 서브셸에서 `--show-model` 실행 → conductor/gatekeeper/librarian = 4-8, palette = 4-7, architect = sonnet (jq-lookup·폴백 양쪽 경로 정확)
- `bash scripts/harness-checkup.sh` Item 2 → **PASS** (`.claude-team.json ↔ oracle-spawn.sh get_model() 매핑 정합`, 12 에이전트)
- ping 검증 — `claude --model claude-opus-4-8 -p "ping"` → `pong` / `claude --model claude-opus-4-7 -p "ping"` → 정상 응답
- CI #376 — `gh pr view` `mergeable: MERGEABLE` / `state: CLEAN` / `failing: []` (commitlint scope=oracle, Secret & Env Scan, Audit/Quality/Test 전 서비스 pass)

## 교훈

1. **모델 ID 승격은 SSOT 3곳 동기 갱신이 필수** — Sprint 202가 확립한 (1) `.claude-team.json` (2) `oracle-spawn.sh` 폴백 case (3) agent `.md` frontmatter 3곳이 모두 일치해야 한다. 주 SSOT(JSON)만 바꾸면 jq 미설치 머신에서 폴백 case가 옛 모델을 반환해 갈린다. harness Item 2가 (1)↔(2) 정합을 검증하므로 머지 전 PASS 확인이 안전선이다.
2. **부분 스코프 승격은 묶인 case를 분리해야 한다** — 종전 `conductor|gatekeeper|librarian|palette` 단일 case는 4개가 같은 모델일 때만 유효하다. Echelon 1만 올리려면 case를 분리해야 palette가 의도치 않게 함께 올라가지 않는다. "tier 1만"이라는 스코프 지시를 case 구조에 그대로 반영했다.
3. **신규 모델 ID는 착수 전 ping으로 가용성 확인** — `claude-opus-4-8`처럼 환경 컨텍스트에 명시되지 않은 신규 ID는, 설정에 박기 전에 `claude --model <ID> -p "ping"`으로 실제 호출 가능 여부를 확인한다. pong이면 진행, 무응답이면 보류 — 존재하지 않는 ID를 박으면 해당 티어 에이전트 spawn이 전부 깨진다 (Sprint 202 Cmux 호환 dry-run 패턴의 일반화).
4. **폴백 경로는 jq를 가린 서브셸로 직접 검증 가능** — `PATH="/usr/bin:/bin"`로 jq를 PATH에서 제거한 서브셸에서 `--show-model`을 호출하면 jq-lookup이 실패하고 폴백 case가 작동한다. 주 경로(jq-lookup)와 안전망(case) 양쪽을 모두 검증해 SSOT 정합을 종단 확인했다.

## 신규 패턴

- **부분 스코프 모델 승격 시 폴백 case 분리 패턴** — 여러 에이전트가 묶인 `case "a|b|c|d)"`에서 일부만 모델을 올릴 때, 올리는 그룹과 유지하는 그룹을 별도 case로 분리한다. SSOT(JSON)는 항목별이라 자연히 분리되지만, 폴백 case는 명시적으로 쪼개야 의도치 않은 동반 승격을 막는다. RUNBOOK의 기대 출력 주석도 함께 갱신해 replay 정합을 유지한다.

## Sprint 215+ 이월

- **서버 재배포 + 라이브 SEO 검증** (사용자/운영): Sprint 212/213 산출물. merge ≠ 라이브 반영, 재배포 후 `curl https://algo-su.com/sitemap.xml`·`robots.txt`로 도메인 정합 확인 <!-- doc-ref-lint: ignore -->
- **GA4 데이터 스트림 URL 정합 + Enhanced Measurement history page_view OFF** (사용자, Sprint 210/211/212 이월 지속)
- **GA4 프로덕션 page_view UAT** (사용자, Sprint 210/211 이월 지속)
- **운영 Sprint 196 마이그레이션 실행** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토** (Sprint 209 이월 지속): 모델 ID retirement·신규 ID 가용성 사전 감지 자동화

## Critic 교차 리뷰

**R1 — CLEAN** (Codex, `codex review --base a6fc66b`, codex-cli 0.130.0 / gpt-5 계열, session `019e70f6-6cc4-7f71-9cbe-f0b09bd94ee6`)

> "The changes consistently update the targeted tier 1 agent model IDs and the corresponding runbook examples while preserving the documented palette exception. No actionable regressions were found in the modified files."

발견 Critical / High / Medium / Low **모두 0건**. Echelon 1 모델 ID 갱신과 RUNBOOK 예시가 일관되고, palette 예외가 보존됨을 확인.
