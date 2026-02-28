# AlgoSu CI/CD 규칙

> Oracle 종합 문서 | 2026-02-28
> 참여 Agent: Architect, Gatekeeper, Conductor, Librarian
> 현행 CI: `.github/workflows/ci.yml`
> 관련 문서: `docs/monitoring-log-rules.md`, `docs/migration-rules.md`

---

## 1. 브랜치 전략

| 브랜치 | 용도 | CI 동작 | 배포 대상 |
|--------|------|---------|-----------|
| `main` | 프로덕션 릴리스 | lint + test + build + push + deploy | prod overlay |
| `dev` | 통합 개발 | lint + test + build + push + deploy | dev overlay |
| `feature/*` | 기능 개발 | lint + test (빌드/배포 없음) | 없음 |
| `hotfix/*` | 긴급 수정 | lint + test + build + push + deploy | prod (main 머지 후) |

**규칙:**
- `main` 직접 push 금지 (Branch Protection)
- `feature/*` → `dev` PR: 리뷰 1명 + CI 통과 필수
- `dev` → `main` PR: 리뷰 1명 + CI 통과 필수
- Force push 금지
- Squash and merge 기본

---

## 2. 커밋 컨벤션 (Conventional Commits)

### 형식

```
<type>(<scope>): <subject>
```

### type 목록

| type | 설명 | CHANGELOG |
|------|------|-----------|
| `feat` | 새 기능 | O |
| `fix` | 버그 수정 | O |
| `perf` | 성능 개선 | O |
| `refactor` | 구조 변경 | X |
| `docs` | 문서 변경 | X |
| `test` | 테스트 | X |
| `chore` | 빌드/의존성 | X |
| `ci` | CI/CD 변경 | X |
| `infra` | K8s/Docker 설정 | X |

### scope 허용 목록

```
gateway, identity, submission, problem, github-worker, ai-analysis, frontend
infra, ci, docs, deps
```

### 예시

```
feat(submission): Saga 타임아웃 처리 추가
fix(gateway): OAuth 콜백 에러 핸들링 수정
chore(deps): prom-client 15.1.3 → 15.2.0
ci(ci): Quality Gate job 추가
feat(gateway)!: OAuth 응답 구조 변경 (BREAKING CHANGE)
```

### CI 강제화

```yaml
commit-lint:
  name: Lint Commit Messages
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: wagoid/commitlint-github-action@v6
      with:
        configFile: commitlint.config.js
```

---

## 3. PR 규칙

### PR 템플릿 (`.github/pull_request_template.md`)

필수 체크리스트:
- [ ] 단위 테스트 통과
- [ ] 타입 체크 통과 (`tsc --noEmit`)
- [ ] lint 통과
- [ ] 커밋 메시지 Conventional Commits 준수
- [ ] 민감 정보 커밋 없음 (.env, 토큰, 키)
- [ ] (보안) JWT/인가/입력값 규칙 준수
- [ ] (DB) 마이그레이션 `down()` 구현, Expand-Contract 패턴
- [ ] (인프라) Kustomize overlay 렌더링 확인

### 리뷰 요구사항

| PR 유형 | 최소 승인 | 비고 |
|---------|----------|------|
| 일반 기능/버그 | 1명 | CODEOWNERS 자동 지정 |
| 보안 (auth, jwt, secret) | 2명 | Gatekeeper 필수 |
| 인프라/CI 변경 | 1명 | Architect 필수 |
| DB 스키마 변경 | 2명 | Architect + Conductor |
| Breaking Change | 2명 | Oracle 최종 승인 |

### 브랜치 네이밍

```
<type>/<scope>-<short-description>
예: feat/submission-saga-timeout, fix/gateway-oauth-callback
```

---

## 4. 파이프라인 구조

### 5단계 파이프라인

```
detect-changes → lint/quality → test → build+push → deploy
```

### Quality Gate job (신규 추가)

```yaml
quality-nestjs:
  name: Quality Gate (NestJS)
  needs: detect-changes
  runs-on: ubuntu-latest
  strategy:
    matrix:
      service: [gateway, identity, submission, problem, github-worker]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
      working-directory: services/${{ matrix.service }}
    - run: npx eslint "{src,test}/**/*.ts"
      working-directory: services/${{ matrix.service }}
    - run: npx tsc --noEmit
      working-directory: services/${{ matrix.service }}

quality-python:
  name: Quality Gate (ai-analysis)
  steps:
    - run: ruff check src/
    - run: ruff format --check src/

quality-frontend:
  name: Quality Gate (frontend)
  steps:
    - run: npx next lint
    - run: npx tsc --noEmit
```

### 테스트 커버리지 기준

| 대상 | 최소 커버리지 | 도구 |
|------|------------|------|
| NestJS 서비스 (5개) | Lines 60% | Jest |
| ai-analysis | Lines 60% | pytest-cov |
| frontend | 측정만 (게이트 미적용) | - |

점진 상향: 현재 60% → Phase 3 후 70% → Phase 4 후 80%

---

## 5. 보안 규칙

### 5-1. 워크플로우 권한 (CRITICAL)

```yaml
# ci.yml 최상위에 추가
permissions: {}   # 기본 권한 제로 — job별 명시 필수

jobs:
  detect-changes:
    permissions:
      contents: read
  build-gateway:
    permissions:
      contents: read
      packages: write    # GHCR push
  deploy:
    permissions:
      contents: read
```

### 5-2. 시크릿 누출 방지 (CRITICAL)

```yaml
secret-scan:
  name: Secret Leak Scan
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`.env` 파일 커밋 방지 검증:

```yaml
- name: Reject .env files
  run: |
    ENV_FILES=$(git diff --name-only HEAD~1 | grep -E '\.env($|\.)' | grep -v '\.env\.example' || true)
    if [ -n "$ENV_FILES" ]; then
      echo "::error::SECURITY VIOLATION: .env files detected"
      exit 1
    fi
```

### 5-3. 이미지 취약점 스캔 (CRITICAL)

```yaml
- name: Trivy vulnerability scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_PREFIX }}-${{ matrix.service }}:main-${{ github.sha }}
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
    ignore-unfixed: true
```

### 5-4. 3rd Party Action 버전 고정 (CRITICAL)

- major 태그 사용 허용 (`@v4`), `@main` 금지
- Dependabot `github-actions` 에코시스템으로 자동 추적
- 신규 Action 도입 시 ADR 기록 + 보안 검토

### 5-5. GitHub Secrets 분류

```
Environment: production
  - K3S_HOST, K3S_USER, K3S_SSH_KEY
  - DISCORD_WEBHOOK_DEPLOY, DISCORD_WEBHOOK_EMERGENCY

Environment: dev
  - (동일 키, dev 서버 값)
```

### 5-6. GHCR 접근 제어

- 패키지 visibility: **private**
- PR 빌드에서 GHCR push 금지 (main만 push)
- 오래된 이미지 자동 정리 (90일, 최소 10개 유지)

---

## 6. Docker 이미지 전략

### 태그 규칙

| 환경 | 태그 형식 | 예시 |
|------|-----------|------|
| dev | `dev-{short-sha}` | `dev-a1b2c3d` |
| prod | `prod-{short-sha}` | `prod-a1b2c3d` |
| 릴리스 | `v{semver}` | `v1.2.0` |

**절대 금지:**
- `latest` 태그 사용
- mutable 태그로 배포

### 베이스 이미지

- `node:20-alpine`, `python:3.12-slim` 사용 (현행 유지)
- Dependabot docker 에코시스템으로 자동 업데이트 추적
- multi-stage build 필수 (dev 의존성 미포함)

### Python 버전 통일 (즉시 수정)

```yaml
# ci.yml 현행: PYTHON_VERSION: '3.11' → Dockerfile: 3.12 불일치
# 수정: 3.12로 통일
env:
  PYTHON_VERSION: '3.12'
```

---

## 7. 배포 전략

### 7-1. 배포 순서 (서비스 의존성 기반)

```
Layer 0: PostgreSQL → Redis → RabbitMQ     (인프라)
Layer 1: Identity Service                   (인증 — 타 서비스 의존)
Layer 2: Problem + Submission               (비즈니스)
Layer 3: GitHub Worker + AI Analysis        (비동기)
Layer 4: Gateway                            (라우팅)
Layer 5: Frontend + Ingress                 (프론트)
```

### 7-2. 순차 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy.sh — k3s 서버에서 실행
set -euo pipefail
NS="algosu"

echo "[Layer 0] 인프라"
kubectl apply -f infra/k3s/namespace.yaml
kubectl apply -f infra/k3s/postgres.yaml -f infra/k3s/redis.yaml -f infra/k3s/rabbitmq.yaml
kubectl -n $NS rollout status deployment/postgres --timeout=120s
kubectl -n $NS rollout status deployment/redis --timeout=60s
kubectl -n $NS rollout status deployment/rabbitmq --timeout=120s

echo "[Layer 1] Identity"
kubectl apply -f infra/k3s/identity-service.yaml
kubectl -n $NS rollout status deployment/identity-service --timeout=90s

echo "[Layer 2] Problem + Submission"
kubectl apply -f infra/k3s/problem-service.yaml -f infra/k3s/submission-service.yaml
kubectl -n $NS rollout status deployment/problem-service --timeout=90s
kubectl -n $NS rollout status deployment/submission-service --timeout=90s

echo "[Layer 3] GitHub Worker + AI Analysis"
kubectl apply -f infra/k3s/github-worker.yaml -f infra/k3s/ai-analysis-service.yaml
kubectl -n $NS rollout status deployment/github-worker --timeout=60s
kubectl -n $NS rollout status deployment/ai-analysis-service --timeout=60s

echo "[Layer 4] Gateway"
kubectl apply -f infra/k3s/gateway.yaml
kubectl -n $NS rollout status deployment/gateway --timeout=60s

echo "[Layer 5] Frontend"
kubectl apply -f infra/k3s/frontend.yaml -f infra/k3s/ingress.yaml
kubectl -n $NS rollout status deployment/frontend --timeout=60s

echo "[완료] 모니터링"
kubectl apply -f infra/k3s/monitoring/
```

### 7-3. Rolling Update 전략 (OCI 단일 노드)

블루-그린/카나리는 OCI Free Tier CPU 제약으로 불가. Rolling Update 사용.

| 서비스 | maxUnavailable | maxSurge | 이유 |
|--------|---------------|----------|------|
| Gateway (prod 2r) | 0 | 1 | 무중단 필수 |
| Identity (prod 2r) | 1 | 0 | 1개 유지로 충분 |
| Submission (prod 2r) | 0 | 1 | 제출 유실 방지 |
| MQ 소비자 (1r) | 1 | 0 | 메시지 큐 보존 |
| Prometheus | Recreate | - | TSDB lock 충돌 방지 |

### 7-4. 배포 승인 게이트

| 환경 | 승인 | 설정 |
|------|------|------|
| dev | 자동 | GitHub Environment 보호 규칙 없음 |
| prod | 수동 1명 | GitHub Environment Protection Rules |

---

## 8. 롤백 전략

### 3계층 롤백

**계층 1 — 자동 롤백 (배포 실패 시)**

```bash
# deploy.sh 내부
if ! kubectl -n $NS rollout status deployment/$SVC --timeout=90s; then
  echo "ROLLBACK: $SVC"
  kubectl -n $NS rollout undo deployment/$SVC
  exit 1
fi
```

**계층 2 — 수동 롤백 (workflow_dispatch)**

```yaml
# .github/workflows/rollback.yml
on:
  workflow_dispatch:
    inputs:
      service:
        description: '롤백 대상 (all/gateway/identity/...)'
        required: true
        default: 'all'
```

**계층 3 — 이미지 태그 기반 재배포**

```bash
kubectl -n algosu set image deployment/gateway \
  gateway=ghcr.io/<owner>/algosu-gateway:prod-<previous-sha>
```

### DB 마이그레이션 롤백 원칙

- **Forward-Only**: 마이그레이션 자체는 롤백하지 않음
- 코드만 rollback, 스키마는 유지 (전방 호환 필수)
- 파괴적 변경은 2-Phase (Expand-Contract 패턴)

| 허용 | 금지 |
|------|------|
| 컬럼 추가 (nullable/default) | 컬럼 삭제/이름 변경 |
| 인덱스 추가 | NOT NULL (default 없이) |
| 타입 확장 | 타입 축소 |

---

## 9. 모니터링 연동

### 배포 이벤트 → Grafana Annotation

```bash
# deploy.sh 성공 후
kubectl -n $NS exec deploy/grafana -- \
  wget -qO- --post-data='{"time":'$(date +%s000)',"tags":["deploy","'$SHA'"],"text":"Deploy '$SHA'"}' \
  --header='Content-Type: application/json' \
  http://localhost:3000/api/annotations
```

### 배포 결과 → Discord 알림

| 이벤트 | 채널 | Webhook Secret |
|--------|------|----------------|
| 배포 성공 | #work-report | `DISCORD_WEBHOOK_DEPLOY` |
| 배포 실패 + 롤백 | #emergency-alert | `DISCORD_WEBHOOK_EMERGENCY` |

```yaml
notify:
  name: Discord Notification
  needs: deploy
  if: always()
  runs-on: ubuntu-latest
  steps:
    - name: Send notification
      run: |
        if [ "${{ needs.deploy.result }}" = "success" ]; then
          COLOR=3066993; STATUS="배포 성공"
          WEBHOOK="${{ secrets.DISCORD_WEBHOOK_DEPLOY }}"
        else
          COLOR=15158332; STATUS="배포 실패"
          WEBHOOK="${{ secrets.DISCORD_WEBHOOK_EMERGENCY }}"
        fi
        curl -s -X POST "$WEBHOOK" \
          -H "Content-Type: application/json" \
          -d '{"embeds":[{"title":"['"$STATUS"'] AlgoSu","color":'"$COLOR"',"fields":[{"name":"커밋","value":"'"${GITHUB_SHA:0:8}"'","inline":true},{"name":"실행자","value":"'"$GITHUB_ACTOR"'","inline":true}]}]}'
```

### 감사 로그

배포 시 기록 항목: Actor, Timestamp, Commit SHA, Environment, 변경 서비스 목록

```yaml
- name: Deployment audit log
  run: |
    DEPLOY_TAG="deploy-$(date -u +%Y%m%d-%H%M%S)-${GITHUB_SHA::8}"
    git tag "$DEPLOY_TAG" && git push origin "$DEPLOY_TAG"
```

---

## 10. 의존성 관리

### npm

- CI에서 반드시 `npm ci` 사용 (`npm install` 금지)
- `package-lock.json` 반드시 커밋
- 변경 시 PR에서 별도 리뷰

### Python

- `requirements.txt` 버전 핀 필수 (`fastapi==0.115.0`)
- `pip-compile`로 lock file 관리 권장

### Dependabot (`.github/dependabot.yml`)

- NestJS 5개 + ai-analysis + frontend + GitHub Actions = 8개 에코시스템
- 주 1회 (월요일 KST 09:00) PR 생성
- major 업데이트: 자동 머지 금지, 수동 리뷰 필수
- 보안 패치: 즉시 PR, CI 통과 후 머지

### 보안 취약 의존성 대응 SLA

| 심각도 | 대응 시한 |
|--------|---------|
| Critical (CVSS 9.0+) | 24시간 |
| High (7.0~8.9) | 72시간 |
| Medium (4.0~6.9) | 1주 |
| Low (0~3.9) | 2주 |

---

## 11. 버전 관리

### 통합 버전 (Semantic Versioning)

서비스 간 의존성이 강하므로 통합 버전 사용: `v{MAJOR}.{MINOR}.{PATCH}`

| 변경 유형 | 버전 증가 |
|----------|----------|
| 하위 호환 불가 API 변경 | MAJOR |
| 새 기능 (하위 호환) | MINOR |
| 버그/성능 수정 | PATCH |

### ESLint 핵심 규칙

- `no-console: 'error'` — JSON structured logging 강제 (`monitoring-log-rules.md` 연계)
- `@typescript-eslint/no-floating-promises: 'error'`
- Ruff `T20` — Python print 금지

---

## 12. 리소스 최적화 (OCI Free Tier)

| 리소스 | 한도 | 현재 사용 | 여유 |
|--------|------|----------|------|
| CPU | 4 OCPU | ~1.85 OCPU | ~2.15 OCPU |
| Memory | 24 GB | ~5.2 GB | ~18.8 GB |

### 최적화 규칙

- GitHub Actions에서 빌드 (k3s 서버 빌드 금지)
- `revisionHistoryLimit: 3` (기본 10 → 축소)
- 미사용 이미지 주간 정리: `k3s crictl rmi --prune`
- GHA 캐시 scope 서비스별 분리

---

## 13. ADR (Architecture Decision Record)

### CI/CD 관련 ADR 소급 기록 (4건)

| ADR | 제목 | 근거 |
|-----|------|------|
| 0001 | ARM64 전용 Docker 빌드 | OCI Free Tier A1 (ARM) |
| 0002 | `main-{sha}` 이미지 태그 | latest 재현 불가, 롤백 명확성 |
| 0003 | path filter 선택적 빌드 | 모노레포 비용 절감 |
| 0004 | GHA cache 전략 | Docker 빌드 시간 단축 |

### ADR 필요 기준

새 워크플로우 추가, 빌드 플랫폼/배포 전략/태그 전략 변경, 신규 Action 도입 시 ADR 필수

---

## 우선순위별 실행 계획

### P0 — 즉시 적용 (1일)

| # | 항목 | 담당 Agent | 난이도 |
|---|------|-----------|--------|
| 1 | Python 버전 3.11 → 3.12 통일 | Architect | 1줄 |
| 2 | `permissions: {}` 최상위 선언 | Gatekeeper | 1줄 |
| 3 | gitleaks 시크릿 스캔 job 추가 | Gatekeeper | 낮음 |
| 4 | .env 커밋 방지 검증 스텝 | Gatekeeper | 낮음 |

### P1 — 이번 주 (HIGH)

| # | 항목 | 담당 Agent | 난이도 |
|---|------|-----------|--------|
| 5 | Quality Gate job 추가 (lint/typecheck) | Librarian | 낮음 |
| 6 | commitlint job 추가 | Librarian | 낮음 |
| 7 | PR 템플릿 추가 | Librarian | 낮음 |
| 8 | deploy → 순차 배포 스크립트 전환 | Conductor | 중간 |
| 9 | 자동 롤백 메커니즘 추가 | Conductor | 중간 |
| 10 | Trivy 이미지 스캔 추가 | Gatekeeper | 낮음 |

### P2 — 다음 스프린트

| # | 항목 | 담당 Agent | 난이도 |
|---|------|-----------|--------|
| 11 | Discord 배포 알림 | Conductor | 낮음 |
| 12 | Grafana Annotation 연동 | Conductor | 낮음 |
| 13 | Dependabot 설정 | Librarian | 낮음 |
| 14 | CODEOWNERS 파일 | Librarian | 낮음 |
| 15 | rollback.yml workflow_dispatch | Architect | 낮음 |
| 16 | dev 브랜치 트리거 + 환경별 배포 | Architect | 중간 |

### P3 — 향후

| # | 항목 | 담당 Agent | 난이도 |
|---|------|-----------|--------|
| 17 | Reusable Workflow 리팩토링 | Architect | 높음 |
| 18 | CHANGELOG 자동화 (release-please) | Librarian | 중간 |
| 19 | ADR 소급 기록 | Librarian | 낮음 |
| 20 | Self-hosted ARM runner | Architect | 높음 |
