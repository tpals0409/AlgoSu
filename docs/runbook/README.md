---
type: index
domain: docs/runbook
---
# 운영 런북 (Runbooks)

시스템 운영·롤백·로테이션·진단 절차의 SSOT. 사고/롤백 시 즉시 참조.

## 영역별 분류

### CI / 배포 (4)

- [ci-rebuild-all](./ci-rebuild-all.md) — CI rebuild_all 트리거 / 인프라 PR 표준 절차
- [e2e-pr-label](./e2e-pr-label.md) — E2E Full Integration 라벨 트리거 가이드
- [gitops-migration](./gitops-migration.md) — 인프라 매니페스트 GitOps 이관 절차
- [dependency-major-upgrade](./dependency-major-upgrade.md) — 의존성 Major 버전 업그레이드 절차

### DB / 마이그레이션 (1)

- [db-migration](./db-migration.md) — TypeORM 마이그레이션 작성/롤백 절차

### GitHub / 인증 (4)

- [github-token-relink](./github-token-relink.md) — GitHub Token 재연동 절차
- [pat-rotation](./pat-rotation.md) — GitHub PAT 로테이션 절차
- [key-rotation](./key-rotation.md) — GitHub App Private Key 로테이션 절차
- [admin-emails](./admin-emails.md) — ADMIN_EMAILS 갱신 절차

### 로컬 개발 환경 (3)

- [git-hooks](./git-hooks.md) — Git Hooks (commitlint pre-commit) 자동화
- [claude-commands](./claude-commands.md) — `.claude/commands/` tracked 정책
- [oracle-tmux-path](./oracle-tmux-path.md) — Oracle tmux dispatch claude 바이너리 PATH 문제 해결

### 도메인 파이프라인 (1)

- [programmers-pipeline](./programmers-pipeline.md) — 프로그래머스 파이프라인 운영 절차

### 품질 자동화 (1)

- [regex-robustness](./regex-robustness.md) — 정규식 강건성 검증 체크리스트

## 신규 런북 추가 시

1. `docs/runbook/{topic}.md` 생성 (kebab-case)
2. 본 README의 영역별 표에 추가 (영역 신규 시 영역 자체도 추가)
3. `docs/README.md`의 카테고리 표 갯수 갱신
4. cross-ref 갱신 의무 — 다른 ADR/런북에서 본 런북을 참조할 때는 `docs/runbook/{topic}.md` 형식으로 작성

## 관련 외부 SSOT

- [docs/README.md](../README.md) — 전체 문서 인덱스
- [docs/adr/README.md](../adr/README.md) — ADR (런북 도입/변경 결정 기록)
