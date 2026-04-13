---
sprint: 82
title: "Oracle tmux 자동 디스패치 파이프라인"
date: "2026-04-13"
status: completed
agents: [Oracle]
related_adrs: []
---

# Sprint 82: Oracle tmux 자동 디스패치 파이프라인

## 목표
Oracle이 tmux에서 에이전트를 독립 프로세스(`claude -p`)로 spawn하고, 파일 기반 IPC로 작업을 할당/수거하는 자동화 파이프라인 구축.

## 배경
기존: 단일 Claude 세션에서 11개 에이전트 순차 실행 → 병렬 불가, 컨텍스트 윈도우 과부하
변경: tmux 기반 독립 프로세스 spawn → 병렬 실행, 파일 기반 IPC

## 아키텍처
```
Oracle (tmux control pane)
  → oracle-dispatch.sh
    → oracle-spawn.sh {agent} (tmux tier{N} pane) — claude -p
  → oracle-reap.sh (결과 수거)
  → oracle-watchdog.sh (타임아웃 감시)
```

### tmux 세션 구조
- session: "oracle"
  - window 0 "control": Oracle 프로세스
  - window 1 "tier1": conductor, gatekeeper, librarian (동적 pane)
  - window 2 "tier2": architect, scribe, postman, curator
  - window 3 "tier3": herald, palette, scout, sensei

### 파일 기반 IPC
- `~/.claude/oracle/tasks/{task_id}.json` — 작업 큐
- `~/.claude/oracle/inbox/{agent}-{task_id}.md` — 에이전트 결과
- `~/.claude/oracle/prompts/{agent}.txt` — 빌드된 시스템 프롬프트
- `~/.claude/oracle/logs/{agent}-{task_id}.out` — stdout 로그
- `~/.claude/oracle/state/panes.json` — 활성 pane 매핑
- `~/.claude/oracle/state/locks/{agent}.lock` — 동시 실행 방지

## 구현 내역

### Phase 1: 디렉토리 + 프롬프트 빌드
- `~/.claude/oracle/` 디렉토리 구조 생성
- `_result-protocol.md`: 에이전트 결과 출력 규약
- `oracle-build-prompts.sh`: _base.md + {agent}.md + _result-protocol.md → prompts/{agent}.txt

### Phase 2: 핵심 스크립트
- `oracle-init.sh`: tmux 세션 초기화 (4 윈도우)
- `oracle-spawn.sh`: 에이전트 spawn (tier별 pane, 모델 매핑)
- `oracle-reap.sh`: 결과 수거 (inbox 파일 + task JSON 상태 업데이트)
- `oracle-dispatch.sh`: 의존성 DAG 해석 → 병렬 spawn
- `oracle-watchdog.sh`: 30초 간격 타임아웃 감시
- `oracle-status.sh`: 시스템 상태 조회
- `oracle-cleanup.sh`: graceful shutdown

### Phase 3: 에이전트 프롬프트 리팩토링
- `_base.md`: "독립 실행 모드" 섹션 추가
- 11개 에이전트 `.md`: `사용자의 요청: $ARGUMENTS` → 듀얼 모드 작업 수신 섹션

### Phase 4: 기존 시스템 통합
- `claude-team.sh`: dispatch 모드 감지 → oracle-init.sh / oracle-cleanup.sh 통합
- `oracle-respond.sh`: 코드 작업 시 task JSON 생성 후 dispatch 위임
- `oracle-system-prompt.md`: 디스패치 시스템 인식 + task JSON 형식
- `.claude-team.json`: 11개 에이전트 + 프리셋 + dispatch 설정

### Phase 5: Oracle 스킬 수정
- `algosu-oracle.md`: 디스패치 파이프라인 사용법 + 판단 기준 추가

## 에이전트 모델 매핑
| Tier | 에이전트 | 모델 |
|------|---------|------|
| 1 | conductor, gatekeeper, librarian | claude-opus-4-6 |
| 2 | architect, scribe, postman, curator | claude-sonnet-4-6 |
| 3 | herald, scout, sensei | claude-sonnet-4-6 |
| 3 | palette (예외) | claude-opus-4-6 |

## 검증
- `oracle-build-prompts.sh`: 11/11 에이전트 빌드 성공
- `oracle-status.sh`: 정상 출력 확인 (세션 없는 상태)

## 파일 목록
| 파일 | 작업 |
|------|------|
| `~/.claude/oracle/bin/oracle-init.sh` | 신규 |
| `~/.claude/oracle/bin/oracle-spawn.sh` | 신규 |
| `~/.claude/oracle/bin/oracle-reap.sh` | 신규 |
| `~/.claude/oracle/bin/oracle-dispatch.sh` | 신규 |
| `~/.claude/oracle/bin/oracle-watchdog.sh` | 신규 |
| `~/.claude/oracle/bin/oracle-status.sh` | 신규 |
| `~/.claude/oracle/bin/oracle-cleanup.sh` | 신규 |
| `~/.claude/oracle/bin/oracle-build-prompts.sh` | 신규 |
| `~/.claude/oracle/_result-protocol.md` | 신규 |
| `.claude/commands/agents/_base.md` | 수정 |
| `.claude/commands/agents/*.md` (11개) | 수정 |
| `~/.claude/oracle-respond.sh` | 수정 |
| `~/.claude/oracle-system-prompt.md` | 수정 |
| `~/.claude/claude-team.sh` | 수정 |
| `.claude-team.json` | 신규 |
| `.claude/commands/algosu-oracle.md` | 수정 |
