# AlgoSu CI/CD 규칙 요약

> 원본: `/root/AlgoSu/docs/ci-cd-rules.md`

## 브랜치 전략
- `main`: 프로덕션 (직접 push 금지)
- `dev`: 통합 개발
- `feature/*`: 기능 개발 (lint+test만)
- `hotfix/*`: 긴급 수정
- Squash and merge 기본, Force push 금지

## 커밋 컨벤션 (Conventional Commits)
```
<type>(<scope>): <subject>
```
- type: feat, fix, perf, refactor, docs, test, chore, ci, infra
- scope: gateway, identity, submission, problem, github-worker, ai-analysis, frontend, minio, infra, ci, docs, deps

## 파이프라인
```
secret-scan → detect-changes → lint/quality → test → build+push → aether-gitops 태그 → ArgoCD sync
```
- 23개 job, Quality Gate (ESLint + tsc --noEmit)
- 커버리지: 60% → 70%(UI-6) → 80%(안정화)

## Dependabot 정책 (2026-03-04)
- 전 에코시스템(10개) `semver-major` 자동 PR 차단 (`dependabot.yml`)
- 메이저 업그레이드는 계획된 Sprint에서 수행
- commitlint: Dependabot 커밋 정책적 예외 (`commitlint.config.mjs` `ignores`)

## Docker 이미지
- 태그: `dev-{sha}` / `prod-{sha}` / `v{semver}` (`latest` 절대 금지)
- 플랫폼: `linux/arm64`
- 베이스: `node:20-alpine`, `python:3.12-slim`
- multi-stage build 필수
- **builder**: `--platform=$BUILDPLATFORM` (QEMU SIGILL 방지)
- **prod_node_modules**: `/tmp`에 격리 (TypeScript가 node_modules 내 .ts 스캔 방지)

## 배포 (ArgoCD GitOps)
```
CI → aether-gitops/algoso/ 태그 업데이트 → ArgoCD 감지(3분) → k3s 자동 sync
```
- SSH 직접 배포 폐지
- Rolling Update (OCI 단일 노드)
- 3계층 롤백: ArgoCD 자동 → Git Revert → 수동 이미지 지정

## 보안
- `permissions: {}` 최상위 (job별 명시)
- gitleaks 시크릿 스캔, .env 커밋 방지, Trivy 이미지 스캔
- GHCR (repo public 전환, 2026-03-04), PR에서 push 금지

## PR 리뷰
- 일반: 1명, 보안: 2명(Gatekeeper 필수), 인프라: Architect 필수, DB 스키마: Architect+Conductor, Breaking: Oracle 최종
