---
sprint: 202
title: "하네스 정기점검 — Cmux/Codex/Claude Code 에이전트 소통 다형성"
date: "2026-05-27"
status: completed
agents: [Oracle, Architect, Librarian, Scribe, Critic]
related_adrs: ["sprint-141", "sprint-150", "sprint-156", "sprint-191"]
related_memory: ["sprint-window", "oracle-dispatch"]
topics: ["oracle", "infrastructure", "cleanup"]
tldr: "AlgoSu 에이전트 하네스(Cmux/tmux 기반 Oracle 디스패치 + Codex 교차 리뷰)의 정기점검. 두 Explore 에이전트의 병렬 탐색으로 3가지 결함을 발견 — ① `.claude-team.json`의 `agents[].model` 필드가 데드 코드(실제 SSOT는 `~/.claude/oracle/bin/oracle-spawn.sh:28-33` `get_model()` 하드코딩, Opus는 4-6 고정) ② Cmux.app(`/Applications/cmux.app/Contents/Resources/bin/claude` v2.1.152)이 시스템 PATH 1순위라 Sprint 141 PATH export(`/opt/homebrew/bin` 1순위)와 실제 동작이 갈림 ③ `.claude-tools/oracle-respond.sh`+`discord-receiver.py` live caller 0건 — 사용자 선택 \"보고 + 전면 정비\"로 단일 스프린트에서 처리. Phase A·B: `get_model()`을 `.claude-team.json`을 jq lookup하도록 SSOT 통합(fallback case 옵스도 4-7로 갱신) + runner PATH에 Cmux.app 경로 1순위 명시 + `oracle-auto-critic.sh:12` CODE_CHANGING_AGENTS ↔ `.claude-team.json` line 36 동기화 정합 확인(변경 불요). Phase C: dormant 3파일(`oracle-respond.sh`, `discord-receiver.py`, `discord-last-id`) 로컬 삭제(.claude-tools/는 gitignored, git diff 0) + `discord-send.sh` live → dormant 재분류(유일 caller였던 `oracle-respond.sh` 삭제로 caller 완전 0건, BOT_TOKEN 평문이라 단순 삭제는 Phase 4로 이연). repo 외부 변경(`~/.claude/oracle/bin/`)은 신규 RUNBOOK `docs/runbook/oracle-model-ssot.md`에 패치 코드 보존(다른 머신 동기화 가능). Critic(Codex) Critical/High 0건. 정상 확인: autoCritic 파이프라인 실제 fire 흔적(2026-05-22 `critic-task-...` 로그) + Codex CLI 0.130.0 가용 + Cmux Opus 4.7 호환 dry-run 통과(`claude --model claude-opus-4-7 -p \"ping\"` → `pong`)."
---
# Sprint 202 — 하네스 정기점검 — Cmux/Codex/Claude Code 에이전트 소통 다형성

## 목표

- AlgoSu 에이전트 하네스(Cmux.app 번들 claude + tmux 기반 Oracle 디스패치 + Codex 교차 리뷰)의 **정기점검**.
- 의사소통 다형성(다중 모델/CLI 백엔드 — Claude Opus·Sonnet + Codex)이 의도대로 작동하는지 점검하고, 점검에서 드러난 결함을 같은 스프린트에서 정비한다.
- 점검 결과를 ADR로 영속화해 다음 정기점검의 기준점 마련.

## 배경

- 에이전트 하네스 인프라:
  - **Cmux.app** (`/Applications/cmux.app/Contents/Resources/bin/claude` v2.1.152, macOS 데스크탑 앱이 번들한 claude CLI) — 시스템 PATH 1순위.
  - **tmux** 3.6a (Homebrew) — Oracle 디스패치 파이프라인의 병렬 에이전트 spawn 백엔드(`~/.claude/oracle/bin/oracle-*.sh` 17 스크립트, Sprint 82~).
  - **Codex CLI** 0.130.0 (Homebrew) — Critic 에이전트의 교차 리뷰 백엔드(`codex review --base main`, Sprint 116~).
  - **Claude Code (Homebrew)** — 대체 백엔드(`/opt/homebrew/bin/claude`), 현재 PATH 2순위라 미사용.
- 자동 Critic 체인(Sprint 117~)이 code-changing 에이전트 커밋 감지 시 `oracle-auto-critic.sh`를 통해 `codex review --base <HEAD_BEFORE>` 자동 호출(`requireSessionId: true` 강제).
- 점검 직전 메모리에 누적된 안정성 신호: 최근 Sprint 199~201 모두 `codex review --base main`으로 Critical/High 0건 머지 게이트 통과.
- 환경 컨텍스트의 최신 Claude 모델 ID: `claude-opus-4-7` / `claude-sonnet-4-6` / `claude-haiku-4-5-20251001`. `.claude-team.json`의 `claude-opus-4-6`은 한 세대 뒤처진 상태로 의심됨 → 점검 핵심.

## 결정

### D0. 점검 절차 — 두 Explore 에이전트 병렬 탐색

- 점검 영역을 둘로 분할해 병렬 Explore: ① Oracle dispatch 라이프사이클 + 모델 다형성 경로(`oracle-spawn.sh`의 모델 ID 소비 라인 + `.claude-team.json` 활용) ② Codex 통합 + autoCritic 파이프라인 라이브니스 + dormant Discord 잔재.
- 결과 통합 후 사용자에게 수행 범위(`보고만 / 보고+핵심 갱신 / 보고+전면 정비`)를 AskUserQuestion으로 확정 → **"보고 + 전면 정비"** 선택. 단일 스프린트에서 점검 ADR + 결함 정비 동시 수행.

### D1. 결함 3건 — 점검에서 드러난 항목

1. **모델 ID SSOT 분기 (심각)** — `.claude-team.json`의 `agents[].model` 필드는 데드 코드. 실제 모델 ID 결정은 `~/.claude/oracle/bin/oracle-spawn.sh:28-33` `get_model()` 함수의 하드코딩된 case 문이 담당. JSON 갱신만으로 모델 전환 불가능. 결과적으로 Opus 4명(`conductor`/`gatekeeper`/`librarian`/`palette`)이 한 세대 뒤처진 `claude-opus-4-6`을 계속 사용.
2. **Cmux/Homebrew claude PATH 우선순위 불일치 (중간)** — `which -a claude`로 두 본 확인: Cmux.app(1순위) + Homebrew(2순위). Sprint 141 runner export PATH는 `/opt/homebrew/bin`을 1순위로 명시했지만, tmux pane이 부모 셸 PATH를 상속하면 Cmux.app이, 미상속하면 Homebrew가 사용되어 runner의 의도와 실제 동작이 갈렸다.
3. **Dormant Discord 잔재 (정리)** — `docs/runbook/claude-tools.md`의 Phase 3 대상이었던 `.claude-tools/oracle-respond.sh` + `discord-receiver.py`가 live caller 0건. 2026-02-28 이후 inactive. Sprint 191 deprecation 패턴(trigger path 검증 후 삭제)과 동일 조건 충족.

### D2. 정상 확인 — 개입 불요

- Oracle dispatch 인프라 17 스크립트 모두 존재. 라이프사이클(`init → build-prompts → create-task → dispatch → spawn → auto-critic → reap → cleanup`) 정상.
- autoCritic 파이프라인 **실제 fire 흔적** 확인 — `~/.claude/oracle/logs/critic-task-20260522-105029-34585.out` (2026-05-22 10:52:11, Codex 세션 `019e4d60-c3a1-76c2-bcff-8acae901ceeb`). `requireSessionId: true` 강제 동작 중.
- Codex CLI 0.130.0 가용. 최근 Sprint 199~201 모두 동일 패턴(`codex review --base main`)으로 Critical/High 0건 머지 게이트 통과.
- `oracle-auto-critic.sh:12` CODE_CHANGING_AGENTS ↔ `.claude-team.json` `dispatch.codeChangingAgents` (line 36) — **동일 9개 정합 확인**(`conductor gatekeeper librarian architect postman curator herald palette sensei`). 변경 불요.

### D3. 정비 범위 — Phase A·B·C·D

- **Phase A·B (oracle dispatch 결함 정비)**: 모델 SSOT 통합 + Cmux PATH 우선순위 명시. repo 외부 패치는 신규 RUNBOOK으로 보존.
- **Phase C (Discord 잔재 삭제)**: dormant 3파일 로컬 삭제 + RUNBOOK 갱신. `discord-send.sh`는 BOT_TOKEN 평문 보존 위험이 있어 단순 삭제 보류, dormant 재분류로 향후 Discord 운영 방향 결정 시 처분(Phase 4로 이연).
- **Phase D (ADR + 영속화)**: 점검 결과 + 결정 + 정비 내역 + 검증을 KR/EN ADR로 작성.

### D4. Cmux Opus 4.7 호환성 — 사전 dry-run

- A2의 `.claude-team.json` opus 4-6 → 4-7 갱신은 Cmux.app v2.1.152가 새 모델 ID를 호출 가능해야만 안전. 착수 전 단발 dry-run으로 `claude --model claude-opus-4-7 -p "ping"` 실행 → `pong`, exit 0 정상 응답 확인. 호환 OK → 정비 진행. 실패였다면 A2 opus를 4-6 유지 + Cmux.app 업데이트 sprint 이월이 결정 트리였다.

## 구현

### Phase A — 모델 SSOT 통합 + Opus 4.7 전환 (PR #357 `0cdcd4e` chore(runbook))

#### A1. `~/.claude/oracle/bin/oracle-spawn.sh:28-45` `get_model()` jq lookup 리팩토링 (repo 외부, PR diff 0)

- 기존(라인 28-33)은 case 하드코딩만. 수정 후 `.claude-team.json`의 `agents[].model`을 jq로 lookup하고, JSON 부재 또는 jq 미설치 시 fallback case로 회귀. fallback의 opus도 동기 갱신 4-7로 변경(JSON 손상 시에도 최신 모델 보장).
- `detect_project_dir()` (라인 64-78) 재사용해 프로젝트 경로 결정. 함수 정의 순서와 호출 순서는 bash가 호출 시점에 평가하므로 문제 없음(get_model이 main() 안 라인 96에서 호출됨).

#### A2. `.claude-team.json` opus 4-6 → 4-7 (4줄, lines 10·11·12·19)

- conductor·gatekeeper·librarian·palette 4명의 `model` 필드 일괄 치환. `replace_all`로 한 번에. Sonnet 8명은 4-6이 환경 최신과 일치하므로 그대로.
- 검증: `jq -r '.agents[] | "\(.name)\t\(.model)"' .claude-team.json` → opus 4명 모두 4-7, sonnet 8명 4-6.

#### A3·B3. `docs/runbook/oracle-model-ssot.md` 신설 (repo 외부 패치 보존)

- `docs/runbook/oracle-tmux-path.md`(Sprint 141)와 동일 패턴 — repo 외부 변경(`~/.claude/oracle/bin/oracle-spawn.sh`)을 다른 머신에서도 재현 가능하도록 패치 코드 전문 보존.
- 섹션: 배경 / 사전 조건(`brew install jq`) / 패치 A1(get_model jq lookup) / 패치 B1(PATH Cmux 1순위) / 적용 절차 / 검증 / 롤백 / 향후 시드.
- §6 검증에 함수 정의 블록 추출 → source → 12 에이전트 모델 매핑 출력 절차 포함.

### Phase B — Cmux PATH 우선순위 명시 + autoCritic 동기화 확인 (PR #357 동일 commit)

#### B1. `~/.claude/oracle/bin/oracle-spawn.sh:131-134` runner PATH export Cmux 1순위 (repo 외부)

- Sprint 141 라인을 보존하면서 Sprint 202 주석 + Cmux.app 경로를 PATH 첫 토큰으로 추가:

```bash
export PATH="/Applications/cmux.app/Contents/Resources/bin:/opt/homebrew/bin:/opt/local/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
```

- Cmux.app 미설치 머신은 해당 토큰이 디렉토리 부재로 무시되어 다음 토큰부터 검색 → 부작용 없음. Sprint 141 fail-fast `command -v claude` 가드는 그대로 유지.

#### B2. `~/.claude/oracle/bin/oracle-auto-critic.sh:12` CODE_CHANGING_AGENTS 동기화 검증

- 사전 검증: `oracle-auto-critic.sh:12`의 `CODE_CHANGING_AGENTS="conductor gatekeeper librarian architect postman curator herald palette sensei"` ↔ `.claude-team.json` line 36 `dispatch.codeChangingAgents` 배열 — **동일 9개 정합 확인**. 변경 불요, ADR 한 줄 기록만.

### Phase C — Dormant Discord 잔재 삭제 (PR #357 `0fb4340` chore(runbook))

#### C1. `.claude-tools/` 로컬 삭제 (gitignored, git diff 0)

- `rm /Users/leokim/Desktop/leo.kim/AlgoSu/.claude-tools/oracle-respond.sh`
- `rm /Users/leokim/Desktop/leo.kim/AlgoSu/.claude-tools/discord-receiver.py`
- `rm /Users/leokim/Desktop/leo.kim/AlgoSu/.claude-tools/discord-last-id` (discord-receiver의 polling state 파일, 부속물)
- `.claude-tools/`가 `.gitignore` 대상이라 `git status` 변동 0. 다른 머신 동기화는 RUNBOOK §5 이력에 명시한 수동 절차로 진행.

#### C2. `discord-send.sh` 처분 결정 — Phase 4로 이연

- C1으로 유일 caller였던 `oracle-respond.sh`가 사라지면서 caller 완전 0건. 그러나 BOT_TOKEN 평문이 들어 있어 단순 삭제 시 다음 머신 셋업 시 의도치 않은 토큰 노출/회수 누락 위험 → 본 스프린트에서는 `live` → `dormant` 재분류만 하고, Phase 4(Discord 운영 방향 결정 + BOT_TOKEN 회수 확정 후)로 처분을 이연.

#### C3. `docs/runbook/claude-tools.md` 갱신

- §2 표에서 dormant 3파일(`oracle-respond.sh`, `discord-receiver.py`, `discord-last-id`) 행 제거.
- `discord-send.sh` 상태 `live` → `dormant` 재분류 + 비고에 "Sprint 202 caller 0건 확인 + BOT_TOKEN 평문 보존 중이라 단순 삭제 보류" 명기.
- `discord-inbox.md`는 비고에 "수신 trigger 부재라 사실상 freeze" 추가(log 분류는 유지).
- §4 정리 로드맵 표에 `Phase 3 (Sprint 202 ✅)` 행 추가, `Phase 4 (미정)`은 `discord-send.sh` 처분 + BOT_TOKEN 회수로 재정의.
- §5 이력에 Sprint 202 라인 추가 — 삭제 파일·재분류 사유·다른 머신 동기화 절차 명시.

### Phase D — ADR + README index

- `docs/adr/sprints/sprint-202.md` 신설 (본 문서, KR — MEMORY 패턴 + sprint-201 구조 계승).
- `docs/adr-en/sprints/sprint-202.md` 신설 (EN 번역, 한글 잔류 0 필수).
- `docs/adr/README.md` 갱신: 회고형 sprint ADR `(139개)` → `(140개)`, `Sprint 62~201` → `Sprint 62~202` (총 3곳).
- `docs/adr-en/README.md`는 카운트/range 미명시 → 갱신 불요.

## 검증

### 정적 검증

- `bash -n ~/.claude/oracle/bin/oracle-spawn.sh` — 문법 OK.
- `jq -r '.agents[] | "\(.name)\t\(.model)"' .claude-team.json` — opus 4명 4-7, sonnet 8명 4-6.
- `which -a claude` — Cmux.app + Homebrew 2개 확인.

### 라이프사이클·모델 lookup dry-run

- Cmux Opus 4.7 호환성: `claude --model claude-opus-4-7 -p "ping"` → `pong`, exit 0.
- `get_model()` 함수 추출 호출: `sed -n '17,79p' ~/.claude/oracle/bin/oracle-spawn.sh > /tmp/sp202-fns.sh; bash -c 'source /tmp/sp202-fns.sh; ...'` (R2 P2 해소 — `detect_project_dir()`의 닫는 brace 라인 78 포함을 위해 17,79까지 추출) → 12 에이전트 모델 매핑이 `.claude-team.json` SSOT와 일치(conductor/gatekeeper/librarian/palette → `claude-opus-4-7`, 나머지 8개 → `claude-sonnet-4-6`). jq lookup이 실제 SSOT를 읽음을 입증.

### 문서 게이트

- `node scripts/check-adr-links.mjs` exit 0.
- `node scripts/check-doc-refs.mjs` 0 broken.
- `node scripts/check-adr-index-count.mjs --strict` → sprint 140 일치.
- `node scripts/check-adr-en-coverage.mjs --lint` → 149/149.

### Critic 머지 게이트

- `codex review --base main` (Codex) — **5 라운드** R1~R5 — R1 P2 1건(jq 실패 시 `set -e` abort 가드, 세션 `019e68ea-f7d5-7640-988a-2c0dffd91b00`) → R2 P2 2건(command 페르소나 .md 4-7 동기 + RUNBOOK §6 sed 범위 17,79, 세션 `019e68f2-e148-78e0-8510-809804c85beb`) → R3 Critical/High 0건 + 추가 P2 0건(머지 게이트 통과 신호, algosu-oracle.md 동반 갱신은 일관성 보강) → R4 P3 1건(ADR sed 범위 17,77 stale, RUNBOOK과 정합) → **R5 Critical/High 0건 + P2 0건 + P3 0건 — CLEAN** (세션 `019e68f8-2869-7be2-9558-b0a3716b9d35`, "no discrete introduced issue that would break existing functionality or CI").

### CI

- `gh pr create` → CI green (Quality·Build Blog SSG·doc-refs·check-adr-links 등) → squash merge.

## 교훈 / 패턴

- ① **"JSON으로 설정한다"와 "JSON이 실제 SSOT다"는 다르다 — 데드 코드 점검은 정기점검의 1번 항목** — `.claude-team.json`의 `model` 필드는 문서·자기소개·인덱싱에는 등장하지만 실제 모델 ID 결정에는 한 번도 참여하지 않았다. "있어 보이는 SSOT"가 데드 코드인 경우는 신규 모델 출시 같은 외부 변화에 의해 처음 드러난다 — 정기점검의 표준 항목으로 "선언된 SSOT가 진짜 SSOT인가" 점검 필요.
- ② **PATH 우선순위는 의도와 일치하도록 명시** — Sprint 141은 tmux pane이 PATH를 상속하지 못하는 경우만 가정하고 Homebrew를 1순위로 export했지만, 정작 사용자 환경(Cmux.app 설치)에서는 부모 셸 PATH가 정상 상속될 때 Cmux.app이 우선되는 모순. PATH는 가능한 모든 환경 조합을 가정해 의도한 백엔드가 1순위가 되도록 명시한다.
- ③ **dormant 정리는 Sprint 191 deprecation 패턴 그대로** — "trigger path 검증 → live caller 0건 확인 → 삭제 → RUNBOOK §이력 추가". 본 스프린트는 이 절차에 BOT_TOKEN 평문 보존이라는 위험 변수를 추가했고, 이때는 즉시 삭제 대신 dormant 재분류 + Phase 4 이연으로 보수적으로 처리. 시크릿 노출 위험이 있는 파일은 별도 운영 결정과 함께 처분.
- ④ **정기점검 산출물 = 정비 + ADR** — "보고만" 옵션은 결함을 발견해놓고 정비 시점을 지연시키므로, 같은 스프린트에서 정비까지 묶으면 다음 스프린트 컨텍스트 오염을 막을 수 있다. 사용자에게 범위 옵션을 분명히 제시하고 선택받는 것이 핵심.

## 신규 패턴

- **하네스 정기점검 체크리스트** — ① CLI 백엔드 가용성(claude/codex/tmux + `which -a`로 경로 충돌 확인) ② 선언된 SSOT 매핑이 코드 SSOT와 일치하는지(`.claude-team.json`-like 설정 파일들의 실제 소비 라인 추적) ③ 모델 ID가 환경 최신 모델과 일치하는지(환경 컨텍스트 vs 설정) ④ dispatch 라이프사이클 fire 흔적(`~/.claude/oracle/logs/` 최신 mtime) ⑤ autoCritic 동기화(`CODE_CHANGING_AGENTS` ↔ JSON 배열) ⑥ dormant 잔재 live caller 검증(grep `-r` repo + 외부 bin 디렉토리) — 다음 정기점검에서 본 항목들을 그대로 재사용.
- **모델 SSOT 통합 패턴** — JSON SSOT + 스크립트 함수 jq lookup + fallback case(JSON 누락/jq 미설치 대비). 향후 모델 ID 갱신은 JSON 1군데로 완결.
- **PATH 1순위 명시 패턴** — 데스크탑 앱이 번들한 CLI를 사용하는 환경에서는 runner export PATH의 첫 토큰을 그 앱 경로로 명시. 부재 머신에서는 토큰이 무시되어 부작용 0.
- **시크릿 보존 파일 dormant 처분** — BOT_TOKEN/API_KEY 평문이 포함된 dormant 파일은 단순 삭제 대신 dormant 재분류 + 운영 결정 후 처분(별도 Phase로 이연).

## 이월 항목

- **운영측 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영): `problem_db`에 `npm run migration:run` (jsonb 전환 + GIN, 런북 `SET statement_timeout=0`).
- **Phase 4 — `discord-send.sh` 처분 결정** (Discord 운영 방향 + BOT_TOKEN 회수 확정 후): 재활성화/삭제/Secret 관리 이전 중 선택.
- (선택) **CI `PYTHON_VERSION` 3.12 → 3.13** 상향 (별도 스프린트).
- (선택) **Build Blog (SSG) 잡을 branch-protection required check로 승격** — Sprint 201 이월 재기재.
- (선택) **github-worker/ai-analysis 부트스트랩 스모크** — Sprint 200·199 NestJS 패턴을 다른 서비스로 확장.
- (선택) **`commitlint` `scope-enum`에 `oracle` 추가** — 본 스프린트에서 `chore(oracle):` 시도가 scope 위반으로 차단됨. 향후 oracle 도메인 작업이 늘면 검토.
- (시드) **하네스 정기점검 자동화** — 본 ADR의 "하네스 정기점검 체크리스트"를 스크립트화해 매 N 스프린트 자동 실행 검토.
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
