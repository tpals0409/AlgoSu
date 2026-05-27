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
> `.claude-tools/` 스크립트는 대부분 deprecated/dormant 상태입니다.
> Sprint 191에서 deprecated 2파일(`claude-team.sh`, `discord-receiver.sh`)을 삭제(Phase 2 완료)했고,
> Sprint 202에서 dormant 3파일(`oracle-respond.sh`, `discord-receiver.py`, `discord-last-id`)을 삭제(Phase 3 완료)했습니다.

## 1. 디렉토리 상태

- **위치**: 프로젝트 루트 `.claude-tools/`
- **Git 정책**: `.gitignore` 에 포함 (untracked) -- 민감 정보(BOT_TOKEN) 보호
- **현재 SSOT**: `~/.claude/oracle/bin/oracle-*.sh` (17개 스크립트)

## 2. 파일별 상태 분류

| 파일 | 상태 | 용도 | 비고 |
|------|------|------|------|
| `discord-send.sh` | **dormant** | Oracle -> Discord 전송 (4채널) | Sprint 202에서 oracle-respond.sh 삭제로 caller 0건 확인 → live → dormant 재분류. BOT_TOKEN 평문 보존 중이라 단순 삭제 보류, Discord 운영 방향 결정 후 처분 |
| `oracle-system-prompt.md` | **reference** | Oracle 역할 정의 | `.claude/commands/algosu-oracle.md`가 SSOT |
| `discord-inbox.md` | **log** | Discord PM 메시지 로그 | append-only, 자동 갱신 (수신 trigger 부재라 사실상 freeze 상태) |

### 상태 정의

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

- `discord-send.sh`(및 dormant `discord-receiver.py`)에 Discord BOT_TOKEN 평문 포함
- `.gitignore`로 repo 미노출 상태 유지 중
- 이 파일들을 tracked으로 전환하거나 내용을 다른 문서에 복사하는 것은 **금지**

### Discord 관련 정책

- `_base.md` 독립 실행 모드에서 `discord-send.sh` 직접 호출 **금지**
- Discord 메시지 전송이 필요하면 Oracle 경유 (보고 체계 위반 방지)

## 4. 정리 로드맵

| 단계 | 범위 | 선행 조건 |
|------|------|----------|
| Phase 1 (Sprint 156) | 운영 정책 RUNBOOK 명문화 | 없음 (본 문서) |
| Phase 2 (Sprint 191 ✅) | deprecated 파일 삭제 (`claude-team.sh`, `discord-receiver.sh`) | trigger path 검증 완료 — live caller 0건 확인 후 삭제 |
| Phase 3 (Sprint 202 ✅) | dormant 파일 삭제 (`oracle-respond.sh`, `discord-receiver.py`, `discord-last-id`) | live caller 0건 확인(`grep -r` repo + `~/.claude/oracle/bin/`) 후 로컬 삭제. 본 RUNBOOK §2 표 정리 + `discord-send.sh`를 live → dormant 재분류 |
| Phase 4 (미정) | `discord-send.sh` 처분 결정 (재활성화 / 삭제 / BOT_TOKEN 회수) | Agent 간 통신 아키텍처 확정 — BOT_TOKEN 평문 노출 위험 잔존 |

## 5. 이력

| 시점 | 내용 |
|------|------|
| Sprint 82 | `claude-team.sh` 최초 작성 (Agent Teams 자동화 CLI) |
| Sprint 125~126 | Discord 수신/송신 스크립트 추가, Oracle 자동 응답 파이프라인 구축 |
| Sprint 150 | `~/.claude/oracle/bin/` SSOT 전환 결정 (시드 #16) |
| Sprint 156 | 본 RUNBOOK 작성 — 운영 정책 명문화 |
| Sprint 191 | Phase 2 실행 — deprecated `claude-team.sh`·`discord-receiver.sh` 삭제 (trigger path 검증: oracle bin·내부 live caller 0건) |
| Sprint 202 | Phase 3 실행 — dormant `oracle-respond.sh`·`discord-receiver.py`·`discord-last-id` 로컬 삭제 (gitignored, git diff 0). `discord-send.sh` live → dormant 재분류 (oracle-respond.sh가 유일 caller였음). 다른 머신 동기화는 `rm .claude-tools/{oracle-respond.sh,discord-receiver.py,discord-last-id}` 수동 실행. 하네스 정기점검(Sprint 202 ADR 참조) 일환. |
