---
sprint: 116
title: "오라클 디스패치 및 에이전트 워크플로우 개선"
period: "2026-04-22"
status: complete
start_commit: 8871e12
end_commit: TBD
---

# Sprint 116 — 오라클 디스패치 및 에이전트 워크플로우 개선

## 배경

Sprint 114~115에서 Critic(비평가) 에이전트를 신설하고 Codex CLI 직접 호출 경로를 입증했으나, **디스패치 파이프라인과 관련 인프라가 Critic을 정식으로 인식하지 못하는 불일치** 가 잔존했다:

1. `.claude-team.json` agents 배열에 Critic 미등록 — team 설정과 실제 에이전트 불일치
2. `merge-gate` 프리셋 없음 — 머지 직전 Critic 단독 호출 경로 부재
3. Critic 페르소나(`critic.md`)가 `/codex:*` 슬래시 커맨드 방식으로 작성 — `claude -p` 비대화 모드에서 파싱 불가
4. `oracle-watchdog.sh`의 `get_tier()` 함수가 Critic을 명시 등록하지 않아 tier 2 fall-back에 의존
5. task ID 충돌 가능성(동시 dispatch 시 microsecond 단위 충돌) 및 오래된 아카이브 관리 도구 부재

본 스프린트는 이 5가지 불일치를 해소하여 Critic이 디스패치 파이프라인에서 완전히 동작하도록 한다.

## 목표

| Phase | 내용 | 상태 |
|-------|------|------|
| A | `.claude-team.json` 정합성 패치 (critic 등록 + merge-gate 프리셋) | ✅ 완료 |
| B-0 | Spike — `/codex:*` 슬래시 vs CLI 직접 호출 동작 검증 | ✅ 완료 |
| B-2 | Critic 페르소나 교정 (`/codex:*` → Bash 직접 호출 방식) | ✅ 완료 |
| C | 운영 안정화 (watchdog critic 명시, task ID PID suffix, cleanup --archive-old) | ✅ 완료 |
| D | 문서 동기화 & ADR 작성 (본 문서) | ✅ 완료 |

---

## 결정 사항

### D1. Critic dispatch 파이프라인 통합 — tmux dispatch + Bash 직접 codex CLI 호출

**배경**: Sprint 114 D3에서 "인터랙티브 모드 전용, dispatch 후속"으로 결정했으나, Phase E(Sprint 115)에서 `codex review --base` CLI 직접 호출이 완전히 동작함을 입증했다. 따라서 독립 프로세스(`claude -p`) 내에서 Bash 도구로 codex CLI를 직접 호출하는 경로로 dispatch를 통합한다.

**선택지**:
- (A) 인터랙티브 모드 전용 유지 — Oracle 메인 세션에서만 Critic 호출
- (B) **tmux dispatch + Bash `codex review` CLI 직접 호출** ← 선택 — 독립 프로세스에서도 완전 동작

**선택**: (B) — Sprint 115 Phase E에서 `codex review --commit <SHA>` / `--base <SHA>` 가 `claude -p` 환경에서도 완전히 동작함이 검증되었다. dispatch 통합으로 Oracle이 Critic을 다른 에이전트와 동일한 tmux 파이프라인으로 호출 가능해진다.

**결과**: `critic.md` "작업 수신" 섹션 "독립 실행 모드 미지원" → 지원으로 변경. Bash 도구를 통해 `codex review --commit HEAD` 또는 `--base <SHA>` 호출 명시.

---

### D2. `.claude-team.json` agents/presets에 critic 등록 + merge-gate 프리셋 신설

**배경**: `.claude-team.json`이 에이전트 팀 구성의 SSOT(Single Source of Truth)이나, Sprint 114에서 Critic 신설 후 이 파일에 반영이 누락되었다.

**선택지**:
- (A) 방치 — 파일과 실제 에이전트 불일치 허용
- (B) **즉시 동기화** ← 선택 — agents 배열 + presets 동시 업데이트

**선택**: (B) — SSOT 원칙. 불일치 상태가 길어질수록 혼선이 증가한다.

**변경 내용**:
- `agents` 배열: Curator↔Herald 사이에 `critic` 항목 추가 (`tier: 2`, `model: claude-sonnet-4-6`, `description: "Codex(gpt-5) 기반 교차 코드리뷰, merge-gate 심사관"`)
- `presets.review`: `["scout", "sensei"]` → `["scout", "sensei", "critic"]`
- `presets.merge-gate`: `["critic"]` 신규 추가 — 머지 직전 Critic 단독 호출 전용 프리셋

**결과**: commit `d5d9585`. 팀 구성도 12개 에이전트 완전 일치.

---

### D3. Critic 페르소나 교정 — `/codex:*` 슬래시 제거 → Bash + codex CLI 직접 호출 명시

**배경**: Sprint 116 Phase B-0 Spike 결론으로, `claude -p` 비대화 모드에서 `/codex:review` 같은 슬래시 커맨드는 파싱되지 않는다(검증 완료). Sprint 114 작성 당시 `/codex:*` 방식을 기술한 `critic.md` 페르소나가 실제 동작 경로와 불일치한다.

**선택지**:
- (A) 슬래시 방식 병기 (인터랙티브 모드 + 독립 모드 분기)
- (B) **Bash 도구 직접 호출 방식만 기술** ← 선택 — 단일 경로, 혼란 제거

**선택**: (B) — 두 경로를 병기하면 미래 에이전트가 환경에 따라 올바른 경로를 판단해야 하는 추가 복잡성이 생긴다. Bash 직접 호출이 양쪽 환경(인터랙티브/독립 프로세스) 모두에서 동작하므로 단일 경로로 통일.

**결과**: `critic.md` 리뷰 섹션에서 `/codex:review --base` → `Bash: codex review --commit HEAD` / `codex review --base <SHA>` 로 교정. Sprint 116 [B-2] 세션(`019db372-89db-7ce3-8ee2-1852e239ddda`)에서 교정 후 1회 호출 성공 확인(개선 전 2회 → 1회 감소).

---

### D4. `oracle-watchdog.sh` get_tier()에 critic 명시 등록 — tier 2 fall-back 제거

**배경**: watchdog의 `get_tier()` 함수가 tier 1 에이전트만 명시 등록하고 나머지는 default fall-back(tier 2)으로 처리했다. Critic이 우연히 tier 2를 받고 있었으나, 명시 등록이 아니므로 향후 로직 변경 시 silent 오류 가능.

**선택지**:
- (A) fall-back 유지 — tier 2가 맞으니 결과는 동일
- (B) **critic을 tier 2로 명시 등록** ← 선택 — 의도를 코드에 표현

**선택**: (B) — "우연히 맞는" 구조보다 "의도적으로 명시된" 구조. Fall-back 의존은 향후 tier 구조 변경 시 버그를 유발할 수 있다.

**결과**: `oracle-watchdog.sh` `get_tier()` case 문에 `critic)` 브랜치 추가 (return 2).

---

### D5. 운영 안정화 — task ID PID suffix + cleanup.sh `--archive-old [DAYS]`

**배경**: 두 가지 독립적인 운영 취약점을 하나의 Phase C에서 처리.

#### D5-a. task ID PID suffix 추가 (collision 방지)

**배경**: 기존 task ID 형식은 `task-{DATE}-{HHMMSS}-{scope}`. 동일 초에 복수 dispatch 시 timestamp가 동일하여 파일명 충돌 발생 가능.

**선택지**:
- (A) microsecond까지 확장 (`%N`)
- (B) **PID suffix 추가** ← 선택 — `task-{DATE}-{HHMMSS}-{PID}-{scope}` 형식

**선택**: (B) — 프로세스 ID는 동일 초 내 유일성을 보장하며, 사람이 읽을 때 어느 프로세스에서 발생했는지 추적 가능.

**결과**: `oracle-create-task.sh`에서 task ID 생성 시 PID(`$$`) 삽입.

#### D5-b. `cleanup.sh --archive-old [DAYS]` 신규 옵션

**배경**: `~/.claude/oracle/inbox/`에 완료된 결과 파일이 누적되어 디렉토리가 커지는 문제. 수동 삭제는 번거롭고 실수로 중요 파일 삭제 위험.

**선택지**:
- (A) 수동 정리 계속
- (B) **`--archive-old [DAYS]` 옵션** ← 선택 — 지정일수 초과 파일을 `~/.claude/oracle/archive/YYYY-MM/`으로 이동

**선택**: (B) — 삭제 대신 아카이브 이동이므로 복구 가능. 월별 디렉토리 구조로 이전 파일 탐색 용이.

**결과**: `cleanup.sh`에 `--archive-old [DAYS]` 옵션 추가. 기본값 30일. `archive/YYYY-MM/` 자동 생성.

---

## Spike 결론 — Phase B-0

> 세션 ID: B-0 `019db364-ca7b-7a01-892e-668ffeef5eff`

| 검증 항목 | 결과 |
|-----------|------|
| `/codex:*` 슬래시 커맨드 — `claude -p` 비대화 모드 동작 여부 | ❌ 파싱 불가 — 텍스트로 그대로 출력됨 |
| `codex review --commit HEAD` CLI 직접 호출 | ✅ 완전 동작 |
| `codex review --base <SHA>` CLI 직접 호출 | ✅ 완전 동작 |
| `--commit`/`--base`와 `[PROMPT]` positional 동시 사용 | ❌ 상호 배타 (CLI 오류) |
| 커스텀 지시 전달 방법 | `echo "지시" \| codex review --commit HEAD` stdin 방식 |
| Codex 버전 | codex-cli 0.122.0 |
| 모델 | gpt-5.4 |

**핵심 결론**: `/codex:*` 슬래시는 Claude Code 인터랙티브 모드 전용이며, `claude -p` 독립 프로세스에서는 동작하지 않는다. Bash 도구로 `codex` 바이너리를 직접 호출하는 경로가 인터랙티브/독립 모드 모두를 커버하는 유일한 공통 경로이다.

---

## 검증 결과

| Phase | 검증 내용 | 결과 |
|-------|-----------|------|
| A | `.claude-team.json` agents.length = 12, presets.merge-gate = ["critic"] | ✅ |
| A | `oracle-create-task.sh` VALID_AGENTS에 critic 등록 확인 | ✅ |
| B-0 | Codex CLI 직접 호출 성공 — 리뷰 대상 d5d9585 머지 가능 판정 | ✅ |
| B-2 | 교정된 페르소나로 1회 호출 성공 (개선 전 2회 시도 → 1회로 감소) | ✅ |
| B-2 | 리뷰 대상 35ccc2b 머지 가능 판정 (세션 `019db372-89db-7ce3-8ee2-1852e239ddda`) | ✅ |
| C | task ID에 PID suffix 추가 — 동시 dispatch 충돌 재현 후 해소 확인 | ✅ |
| C | `cleanup.sh --archive-old 30` 실행 — `archive/2026-04/` 생성 확인 | ✅ |
| C | `oracle-watchdog.sh` `get_tier(critic)` = 2 명시 동작 확인 | ✅ |

---

## 주요 산출물

**수정 1** (커밋 `d5d9585`):
- `.claude-team.json` — agents 배열 critic 추가, presets.review 확장, presets.merge-gate 신설

**스크립트 수정** (`~/.claude/oracle/bin/` — 버전 관리 외부):
- `oracle-watchdog.sh` — `get_tier()` critic 명시 등록 (tier 2)
- `oracle-create-task.sh` — task ID에 PID suffix 추가
- `cleanup.sh` — `--archive-old [DAYS]` 옵션 신규

**페르소나 교정** (`.claude/commands/agents/critic.md`):
- `/codex:*` 슬래시 커맨드 방식 → Bash + `codex review --commit/--base` CLI 직접 호출 방식으로 교체

**문서**:
- `CLAUDE.md` — Agent 워크플로우 섹션에 `merge-gate` 프리셋 언급 추가
- `docs/adr/sprints/sprint-116.md` — 본 ADR (신규)

---

## 리스크 & 완화

- **R1 `~/.claude/oracle/bin/` 미버전 관리**: 스크립트가 홈 디렉토리에 위치하여 git 추적 불가. Oracle이 수정 전 수동 백업 수행, PreToolUse 훅 예외 등록 검토를 후속 과제로 추가.
- **R2 Codex 크레딧 소모**: dispatch 통합으로 Critic 호출 빈도가 증가할 수 있음. Oracle이 `merge-gate` 프리셋 호출을 머지 직전 단계로 제한하는 가이드라인 준수.
- **R3 task ID 형식 변경 호환성**: PID suffix 추가로 기존 task ID 파싱 로직에 영향 가능. `oracle-watchdog.sh`와 `cleanup.sh`의 파일명 패턴 매칭을 prefix 매칭(`task-*`)으로 유지하여 호환성 보장.

## 교훈

- **슬래시 커맨드는 인터랙티브 모드 전용**: Claude Code의 `/foo:bar` 슬래시 커맨드는 대화형 세션 UI가 처리하며, `claude -p` 독립 프로세스나 Bash 도구에서는 단순 문자열로 취급된다. 에이전트 페르소나에 슬래시 커맨드를 기술할 때는 반드시 Bash 직접 호출 경로도 병기하거나 대체해야 한다.
- **SSOT 파일의 지연 동기화는 조용한 버그를 낳는다**: `.claude-team.json`이 Critic 신설 후 2 스프린트 동안 불일치 상태로 유지되었다. 에이전트 신설·변경 시 관련 설정 파일을 즉시 동기화하는 것이 원칙이며, ADR "주요 산출물"에 설정 파일 수정을 명시하면 누락을 방지할 수 있다.
- **"우연히 맞는" 구조는 코드 부채**: `get_tier()`의 fall-back이 우연히 올바른 값을 반환하더라도, 의도를 명시하지 않으면 다음 수정자가 구조를 이해하지 못해 잘못된 변경을 할 위험이 있다. 의도는 항상 코드에 표현한다.
- **Spike 결론을 즉시 페르소나에 반영**: B-0 Spike로 발견한 슬래시 커맨드 파싱 불가 사실을 즉각 B-2에서 `critic.md` 교정에 적용했다. Spike → 페르소나 교정 사이클을 동일 스프린트 내에서 닫는 것이 다음 스프린트 부채 축적을 방지한다.

## 후속 과제 (다음 스프린트 시드)

- **commitlint scope-enum에 `oracle` 추가**: 현재 `.claude/` 관련 커밋을 `infra` 스코프로 우회 중. `oracle-*.sh`, `.claude-team.json`, `critic.md` 등은 독립 스코프로 분리해야 의미가 명확해진다.
- **`.claude/` gitignore 정책 재검토**: 에이전트 페르소나 파일(`.claude/commands/agents/`)의 버전 관리 전략 확립. 현재 일부 파일은 추적되고 일부는 제외됨 — 일관된 정책 필요.
- **`~/.claude/oracle/bin/` 수정 시 PreToolUse 훅 예외 등록 검토**: 스크립트 수정 작업이 Oracle에 의해서만 이루어지도록 Scribe·다른 에이전트 접근을 훅으로 제한.
- **sprint-window.md 잔여 항목 4건 처리**: Redis 통계 캐시, problem.tags JSON 컬럼 전환, dashboard/page.tsx SWR 전환, admin/feedbacks/page.tsx SWR 전환.

## 이월

없음 — 계획된 5개 Phase 모두 완결.
