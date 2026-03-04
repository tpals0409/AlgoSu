# AlgoSu CI/CD 작업 도우미

## 역할
AlgoSu CI/CD 규칙에 따라 GitHub Actions 워크플로우, Docker 설정, ArgoCD 배포 작업을 수행합니다.

## 필수 참조
- CI/CD 규칙: `.claude/commands/algosu-cicd.md`

## 커밋 컨벤션
```
<type>(<scope>): <subject>
```
type: feat, fix, perf, refactor, docs, test, chore, ci, infra
scope: gateway, identity, submission, problem, github-worker, ai-analysis, frontend, minio, infra, ci, docs, deps, security

## 파이프라인 구조
```
secret-scan → detect-changes → lint/quality → test → build+push → aether-gitops 태그 → ArgoCD sync
```

## Dependabot 정책
- 전 에코시스템 `semver-major` 자동 PR 차단 (`dependabot.yml`)
- 메이저 업그레이드는 계획된 Sprint에서 수행
- commitlint: Dependabot 커밋 정책적 예외

## Docker 이미지 태그
- `dev-{sha}` / `prod-{sha}` / `v{semver}`
- `latest` 절대 금지
- 플랫폼: `linux/arm64`
- multi-stage build 필수
- **builder**: `FROM --platform=$BUILDPLATFORM` (QEMU ARM64 SIGILL 방지)
- **prod_node_modules**: `/tmp`에 격리 (TypeScript가 .ts 파일 스캔 방지)

## 보안 필수
- `permissions: {}` 최상위 (job별 명시)
- gitleaks 시크릿 스캔
- Trivy 이미지 스캔 (CRITICAL, HIGH)
- Action `@main` 금지 (major 태그만)

## 배포 (ArgoCD GitOps)
```
CI → aether-gitops/algoso/ 태그 push → ArgoCD 감지 → k3s sync
```
SSH 직접 배포 폐지됨

## OCI Free Tier 최적화
CPU 4 OCPU, Memory 24GB
- GHA에서 빌드 (k3s 서버 빌드 금지)
- revisionHistoryLimit: 3
- Docker multi-stage: runner에서 npm/npx/corepack 제거

$ARGUMENTS
