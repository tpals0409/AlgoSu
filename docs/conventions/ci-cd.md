---
type: convention
domain: ci-cd
---
# CI / CD 규칙

AlgoSu 모든 PR / merge / 배포가 따라야 할 컨벤션. `commitlint.config.mjs` + `.husky/` + `.github/workflows/ci.yml` + agent 페르소나의 SSOT.

## 1. Conventional Commits

### 형식

```
<type>(<scope>): <subject>

[body]

[footer]
```

### type (commitlint enum)

`feat` / `fix` / `chore` / `docs` / `refactor` / `test` / `perf` / `style` / `ci` / `build` / `revert`

### scope (commitlint scope-enum)

동적 scope-enum (Sprint 105 [C] 도입 — `feedback-commitlint-scope`):

`adr` · `ai-analysis` · `blog` · `ci` · `deps` · `docs` · `e2e` · `frontend` · `gateway` · `github-worker` · `identity` · `infra` · `problem` · `runbook` · `security` · `submission`

신규 디렉토리(blog 등) 추가 시 scope-enum도 함께 등록 의무 (Sprint 105 구조적 해결).

### subject

- 50자 이내, 명령형 (한글/영문 모두 허용)
- 마침표 금지

## 2. 브랜치 규율

### 명명

`<type>/<scope>-<description>` (kebab-case).

예: `feat/sprint-153-docs-broken-ref-cleanup` / `fix/identity-jwt-expiry`

### 직접 push 금지

`main` 직접 push **절대 금지**. branch protection rule + GitHub App + `agents:gatekeeper` 페르소나 가드.

### 에이전트 브랜치 규율 (Sprint 126 D 강화)

- ✅ 모든 에이전트(Oracle 위임 작업 포함)는 **단일 작업 브랜치**에서만 작업
- ✅ 작업 시작 전 `git checkout -b <type>/sprint-NNN-<description>`로 신규 브랜치 생성
- ✅ commit/push는 작업 브랜치에서만 — main 체크아웃 후 직접 commit 금지
- ✅ 머지는 항상 PR + Squash merge (CI green + Critic 통과 필수)
- ❌ `git checkout main && git commit` 또는 `git push origin main` 절대 금지
- ❌ 작업 완료 후 브랜치 전환 없이 main에 직접 commit 금지

위반 사례: Sprint 125 Wave D에서 Oracle 인프라 조사 중 main 직접 commit 발생 → 본 규칙으로 재발 차단.

## 3. PR

### Squash merge

모든 PR은 Squash merge. merge commit 금지.

### 필수 체크리스트

- 테스트 (jest / pytest / vitest) PASS
- TypeScript `tsc --noEmit` PASS
- Lint (ESLint / Ruff) PASS
- Coverage gate PASS (`scripts/check-coverage.mjs` lines/branches 70%+)
- 보안 스캔 (Trivy / Gitleaks / Secret Scan) PASS
- DB 마이그레이션 정상 (해당 시)

### CODEOWNERS

`.github/CODEOWNERS`에 따라 자동 reviewer 할당.

### Auto-Critic

Critic agent (Codex gpt-5 기반)이 code-changing commit에 자동 큐잉 (Sprint 117+). P0/P1 발견 시 머지 차단, P2 권고는 후속 사이클 처리.

## 4. CI 워크플로우

### 워크플로우 파일

- `.github/workflows/ci.yml` — main CI (Audit / Build / Quality / Test / E2E / Trivy / Build Blog / Coverage Gate)
- `.github/workflows/dependabot-automerge.yml` — Dependabot patch/minor 자동 머지

### Detect Changed Services

`paths-filter`로 변경된 서비스만 빌드/테스트 실행. 미변경 서비스는 SKIPPED.

> **⚠️ 주의**: paths filter 우회로 coverage threshold 미달이 PR-단계에서 SKIPPED 되어 가려질 수 있음. main push 후 노출되면 즉시 hotfix가 표준 (Sprint 150 교훈 #1).

### Trivy

main push 단계에서 8개 서비스 이미지 스캔. HIGH 이상 CVE 발견 시 lockfile-only hotfix가 표준 (Sprint 151 PR #230 패턴).

## 5. 보안 (CI 강제)

- `permissions: {}` 워크플로우 기본값 (필요 시 명시 추가)
- Gitleaks 스캔 (Secret 누출 차단)
- `.env` 커밋 방지 (`.gitignore` + Gitleaks rule)
- JWT `none` 알고리즘 금지
- SQL: ORM/parameterized binding (raw query 금지)

## 6. 의존성 관리

### Dependabot

- patch / minor: 자동 머지 (`dependabot-automerge.yml`)
- major: 수동 검토 + [`runbook/dependency-major-upgrade`](../runbook/dependency-major-upgrade.md) 절차

### Lockfile 정책

- `package-lock.json` 커밋 의무 (deterministic build)
- Trivy CVE 발견 시 lockfile-only hotfix 표준 (caret/tilde 그대로, `npm install`로 patch-level 자동 적용)

## 7. 배포 (Deploy)

### §7-1 배포 트리거

- main 머지 → GitHub Actions `ci.yml` → Build → Trivy 통과 → ghcr.io push
- ArgoCD가 GitOps repo 변경 감지 → k3s 클러스터 재배포

### §7-2 Layer 순차 배포

`scripts/deploy.sh` — **긴급 복구 전용** 스크립트 (ADR-029: 배포 SSOT = aether-gitops). aether-gitops를 clone하여 `kubectl apply -k overlays/prod`로 일괄 적용한 뒤, 의존성 순서(infra → backend → frontend)대로 rollout 상태를 확인해 일시적 schema mismatch / API contract drift를 회피한다. 운영 정상 배포는 ArgoCD가 담당.

```
GITOPS_TOKEN=<pat> ./scripts/deploy.sh          # private repo clone
GITOPS_LOCAL=/path/to/aether-gitops ./scripts/deploy.sh   # 로컬 클론 재사용
```

상세: [`scripts/deploy.sh`](../../scripts/deploy.sh) 본문 + [`runbook/gitops-migration`](../runbook/gitops-migration.md) 매핑.

### §7-3 롤백

ArgoCD UI에서 직전 GitOps revision으로 되돌리기. DB 마이그레이션이 포함된 경우 [`runbook/db-migration`](../runbook/db-migration.md) 절차 병행.

## 8. 관련 문서

- [`commitlint.config.mjs`](../../commitlint.config.mjs) — type/scope enum SSOT
- [../runbook/git-hooks](../runbook/git-hooks.md) — Git hooks (commitlint pre-commit)
- [../runbook/ci-rebuild-all](../runbook/ci-rebuild-all.md) — CI rebuild_all 트리거 절차
- [../runbook/dependency-major-upgrade](../runbook/dependency-major-upgrade.md) — Major 의존성 업그레이드
- [../runbook/regex-robustness](../runbook/regex-robustness.md) — 정규식 강건성 lint 정책
- [`CLAUDE.md`](../../CLAUDE.md) — `## 코드 컨벤션` `## 보안 규칙` 원본
