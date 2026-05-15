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
> `.claude-tools/` 7개 스크립트는 대부분 deprecated/dormant 상태입니다.

## 1. 디렉토리 상태

- **위치**: 프로젝트 루트 `.claude-tools/`
- **Git 정책**: `.gitignore` 에 포함 (untracked) -- 민감 정보(BOT_TOKEN) 보호
- **현재 SSOT**: `~/.claude/oracle/bin/oracle-*.sh` (17개 스크립트)

## 2. 파일별 상태 분류

| 파일 | 상태 | 용도 | 비고 |
|------|------|------|------|
| `claude-team.sh` | **deprecated** | 범용 tmux Agent Teams CLI | Sprint 82 ADR 산출물, `oracle-spawn.sh`로 대체 |
| `oracle-respond.sh` | **dormant** | Discord PM 수신 시 Oracle 자동 응답 | trigger path 불명, 2026-02-28 이후 inactive |
| `discord-receiver.sh` | **deprecated** | Discord polling (Bash) | `.py` 버전과 기능 중복 |
| `discord-receiver.py` | **dormant** | Discord polling (Python) | polling trigger 미확인 |
| `discord-send.sh` | **live** | Oracle -> Discord 전송 (4채널) | `_base.md` 금지 정책 있으나 호출 가능, 제거 금지 |
| `oracle-system-prompt.md` | **reference** | Oracle 역할 정의 | `.claude/commands/algosu-oracle.md`가 SSOT |
| `discord-inbox.md` | **log** | Discord PM 메시지 로그 | append-only, 자동 갱신 |
| `discord-last-id` | **state** | Discord polling 마지막 메시지 ID | `discord-receiver` 상태 파일 |

### 상태 정의

- **deprecated**: 대체 수단이 존재하며 신규 사용 금지. 향후 삭제 후보.
- **dormant**: 설계되었으나 trigger/호출 경로가 비활성화됨. 향후 검증 후 삭제 또는 재활성화 결정.
- **live**: 현재 런타임에서 호출 가능. 제거 시 장애 위험.
- **reference**: 정보 참조용. SSOT가 아님.
- **log**: 자동 생성/갱신되는 데이터 파일.
- **state**: 스크립트 내부 상태 추적 파일.

## 3. 운영 정책

### 신규 dispatch 작업

| 용도 | 사용할 도구 | 금지 도구 |
|------|-----------|----------|
| Task 생성 | `~/.claude/oracle/bin/oracle-create-task.sh` | `.claude-tools/claude-team.sh` |
| Agent spawn | `~/.claude/oracle/bin/oracle-spawn.sh` | `.claude-tools/claude-team.sh` |
| 상태 확인 | `~/.claude/oracle/bin/oracle-status.sh` | 없음 |
| 결과 수거 | `~/.claude/oracle/bin/oracle-reap.sh` | 없음 |

### 보안 주의

- `discord-receiver.sh`와 `discord-send.sh`에 Discord BOT_TOKEN 평문 포함
- `.gitignore`로 repo 미노출 상태 유지 중
- 이 파일들을 tracked으로 전환하거나 내용을 다른 문서에 복사하는 것은 **금지**

### Discord 관련 정책

- `_base.md` 독립 실행 모드에서 `discord-send.sh` 직접 호출 **금지**
- Discord 메시지 전송이 필요하면 Oracle 경유 (보고 체계 위반 방지)

## 4. 정리 로드맵

| 단계 | 범위 | 선행 조건 |
|------|------|----------|
| Phase 1 (Sprint 156) | 운영 정책 RUNBOOK 명문화 | 없음 (본 문서) |
| Phase 2 (미정) | deprecated 파일 삭제 (`claude-team.sh`, `discord-receiver.sh`) | trigger path 검증 완료 |
| Phase 3 (미정) | dormant 파일 결정 (재활성화 또는 삭제) | Discord 운영 방향 결정 |
| Phase 4 (미정) | `discord-send.sh` 정책 재검토 | Agent 간 통신 아키텍처 확정 |

## 5. 이력

| 시점 | 내용 |
|------|------|
| Sprint 82 | `claude-team.sh` 최초 작성 (Agent Teams 자동화 CLI) |
| Sprint 125~126 | Discord 수신/송신 스크립트 추가, Oracle 자동 응답 파이프라인 구축 |
| Sprint 150 | `~/.claude/oracle/bin/` SSOT 전환 결정 (시드 #16) |
| Sprint 156 | 본 RUNBOOK 작성 — 운영 정책 명문화 |
