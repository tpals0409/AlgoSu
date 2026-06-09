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

### 로컬 개발 환경 (6)

- [git-hooks](./git-hooks.md) — Git Hooks (commitlint pre-commit + pre-push 무결성 검증) 자동화
- [git-staging-checklist](./git-staging-checklist.md) — `git mv` + sed/Edit 결합 plan 의 staging 체크리스트
- [pre-push-check](./pre-push-check.md) — Pre-push hook: untracked .md broken ref + unstaged 수정 검증
- [claude-commands](./claude-commands.md) — `.claude/commands/` tracked 정책
- [claude-tools](./claude-tools.md) — `.claude-tools/` 운영 정책 (deprecated/live 파일 분류 + 정리 로드맵)
- [oracle-tmux-path](./oracle-tmux-path.md) — Oracle tmux dispatch claude 바이너리 PATH 문제 해결

### 도메인 파이프라인 (1)

- [programmers-pipeline](./programmers-pipeline.md) — 프로그래머스 파이프라인 운영 절차

### 관측성 / 모니터링 (2)

- [oncall-alerts](./oncall-alerts.md) — 온콜 알림 대응 런북 (alert별 의미·진단 쿼리·1차 대응)
- [alert-channel-separation](./alert-channel-separation.md) — 알림 critical/일반 채널 분리 적용 절차 (Discord webhook seal + aether-gitops)

### 품질 자동화 (3)

- [regex-robustness](./regex-robustness.md) — 정규식 강건성 검증 체크리스트
- [doc-ref-lint](./doc-ref-lint.md) — 마크다운 cross-ref 무결성 lint
- [ci-full-validation](./ci-full-validation.md) — Weekly Full CI Validation (paths filter 우회 부채 정기 점검)

## 신규 런북 추가 시

1. `docs/runbook/{topic}.md` 생성 (kebab-case)
2. 본 README의 영역별 표에 추가 (영역 신규 시 영역 자체도 추가)
3. `docs/README.md`의 카테고리 표 갯수 갱신
4. cross-ref 갱신 의무 — 다른 ADR/런북에서 본 런북을 참조할 때는 `docs/runbook/{topic}.md` 형식으로 작성

## 관련 외부 SSOT

- [docs/README.md](../README.md) — 전체 문서 인덱스
- [docs/adr/README.md](../adr/README.md) — ADR (런북 도입/변경 결정 기록)
