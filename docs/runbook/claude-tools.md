---
type: runbook
domain: local-dev
related:
  - docs/runbook/claude-commands.md
  - docs/runbook/oracle-tmux-path.md
---
# `.claude-tools/` 운영 정책

`.claude-tools/` 디렉토리의 현재 상태, 파일별 분류, 운영 정책을 명문화합니다.

> Sprint 150 이후 Oracle dispatch 인프라가 `~/.claude/oracle/bin/` 스택으로 전환되어,
> `.claude-tools/` 스크립트는 단계적으로 정리되어 왔습니다.
> Sprint 191에서 deprecated 2파일(`claude-team.sh`, `discord-receiver.sh`)을 삭제(Phase 2 완료),
> Sprint 202에서 dormant 3파일(`oracle-respond.sh`, `discord-receiver.py`, `discord-last-id`)을 삭제(Phase 3 완료),
> Sprint 204에서 dormant 3파일(`discord-send.sh`, `oracle-system-prompt.md`, `discord-inbox.md`)을 삭제(Phase 4 완료)했습니다.

## 1. 디렉토리 상태

- **위치**: 프로젝트 루트 `.claude-tools/`
- **Git 정책**: `.gitignore` 에 포함 (untracked) — 로컬 dispatch 산출물 격리용 (Sprint 204 Phase 4에서 dormant 자산 repo 제거 완료, 외부 BOT_TOKEN revoke는 사용자 직접 트랙으로 분리 — Sprint 205 시작 시점 재확인)
- **현재 SSOT**: `~/.claude/oracle/bin/oracle-*.sh` (17개 스크립트)

## 2. 파일별 상태 분류

**현재 상태**: 추적 대상 산출물 없음 (Sprint 204 Phase 4 완료로 dormant 파일 3종[`discord-send.sh`, `oracle-system-prompt.md`, `discord-inbox.md`] 모두 삭제). 디렉토리는 향후 신규 dispatch 산출물 대비로 `.gitignore` 등록 상태로 보존.

### 상태 정의 (신규 산출물 분류 기준)

- **deprecated**: 대체 수단이 존재하며 신규 사용 금지. 향후 삭제 후보.
- **dormant**: 설계되었으나 trigger/호출 경로가 비활성화됨. 향후 검증 후 삭제 또는 재활성화 결정.
- **live**: 현재 런타임에서 호출 가능. 제거 시 장애 위험.
- **reference**: 정보 참조용. SSOT가 아님.
- **log**: 자동 생성/갱신되는 데이터 파일.
- **state**: 스크립트 내부 상태 추적 파일.

## 3. 운영 정책

### 신규 dispatch 작업

| 용도 | 사용할 도구 | 비고 |
|------|-----------|------|
| Task 생성 | `~/.claude/oracle/bin/oracle-create-task.sh` | 구 `claude-team.sh` Sprint 191 삭제 |
| Agent spawn | `~/.claude/oracle/bin/oracle-spawn.sh` | 구 `claude-team.sh` Sprint 191 삭제 |
| 상태 확인 | `~/.claude/oracle/bin/oracle-status.sh` | — |
| 결과 수거 | `~/.claude/oracle/bin/oracle-reap.sh` | — |

### 보안 주의

- `.gitignore`로 repo 미노출 상태 유지 (로컬 dispatch 산출물 격리)
- 신규 산출물에 평문 시크릿/토큰 보유 **금지** — Secret-store(macOS Keychain, SealedSecret 등) 경유 필수
- 이 디렉토리 파일을 tracked으로 전환하거나 내용을 다른 문서에 복사하는 것은 **금지**

### Discord 관련 정책

Sprint 204 Phase 4에서 Discord 통합 자산(`discord-send.sh` 등)을 repo에서 제거했습니다. 외부 BOT_TOKEN revoke는 사용자 직접 트랙(머지 후 Discord Developer Portal → Sprint 205 시작 시점 재확인). 향후 Agent↔Discord 또는 유사 외부 채널 통합 재개 시 처음부터 Secret-store 기반으로 재설계하세요(평문 토큰 파일 보유 패턴 금지).

## 4. 정리 로드맵

| 단계 | 범위 | 선행 조건 |
|------|------|----------|
| Phase 1 (Sprint 156) | 운영 정책 RUNBOOK 명문화 | 없음 (본 문서) |
| Phase 2 (Sprint 191 ✅) | deprecated 파일 삭제 (`claude-team.sh`, `discord-receiver.sh`) | trigger path 검증 완료 — live caller 0건 확인 후 삭제 |
| Phase 3 (Sprint 202 ✅) | dormant 파일 삭제 (`oracle-respond.sh`, `discord-receiver.py`, `discord-last-id`) | live caller 0건 확인(`grep -r` repo + `~/.claude/oracle/bin/`) 후 로컬 삭제. 본 RUNBOOK §2 표 정리 + `discord-send.sh`를 live → dormant 재분류 |
| Phase 4 (Sprint 204 ✅) | dormant 3파일(`discord-send.sh`, `oracle-system-prompt.md`, `discord-inbox.md`) 로컬 삭제 + BOT_TOKEN 회수 안내 | live caller 0건 사전 검증 + 3개월 무활성(2026-02-28 마지막 입력) → Agent↔Discord 폐기 결정. repo·로컬 파일 측 평문 토큰 보유 경로 종결 (외부 BOT_TOKEN revoke는 Phase 3 사용자 트랙 — Sprint 205 재확인 후 시크릿 노출 위험 완전 종결) |

## 5. 이력

| 시점 | 내용 |
|------|------|
| Sprint 82 | `claude-team.sh` 최초 작성 (Agent Teams 자동화 CLI) |
| Sprint 125~126 | Discord 수신/송신 스크립트 추가, Oracle 자동 응답 파이프라인 구축 |
| Sprint 150 | `~/.claude/oracle/bin/` SSOT 전환 결정 (시드 #16) |
| Sprint 156 | 본 RUNBOOK 작성 — 운영 정책 명문화 |
| Sprint 191 | Phase 2 실행 — deprecated `claude-team.sh`·`discord-receiver.sh` 삭제 (trigger path 검증: oracle bin·내부 live caller 0건) |
| Sprint 202 | Phase 3 실행 — dormant `oracle-respond.sh`·`discord-receiver.py`·`discord-last-id` 로컬 삭제 (gitignored, git diff 0). `discord-send.sh` live → dormant 재분류 (oracle-respond.sh가 유일 caller였음). 다른 머신 동기화는 `rm .claude-tools/{oracle-respond.sh,discord-receiver.py,discord-last-id}` 수동 실행. 하네스 정기점검(Sprint 202 ADR 참조) 일환. |
| Sprint 204 | Phase 4 실행 — dormant `discord-send.sh`·`oracle-system-prompt.md`·`discord-inbox.md` 로컬 삭제 (gitignored, git diff 0). **다른 머신/체크아웃 동기화는 `rm .claude-tools/{discord-send.sh,oracle-system-prompt.md,discord-inbox.md}` 수동 실행** (Sprint 202 패턴 그대로 — `.gitignore`라 deletion이 git으로 전파되지 않음). BOT_TOKEN은 사용자에게 Discord Developer Portal에서 revoke하도록 안내 (외부 시스템 트랙, repo 작업과 분리, Sprint 205 시작 시점 재확인). 3개월 무활성(2026-02-28 마지막 입력) + live caller 0건(`~/.claude/oracle/bin/` 17 스크립트·repo grep) → Agent↔Discord 통합 폐기 결정 (repo 측 정리 완료, 다른 머신 정리 + 외부 revoke는 Phase 3 사용자 트랙). Sprint 156 명문화→Sprint 191→202→204의 4-스프린트 정리 파이프라인 종결. |
