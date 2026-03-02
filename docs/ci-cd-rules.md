# AlgoSu CI/CD 규칙

> Oracle 종합 문서 | 2026-03-02 (v2.0: UI v2 전면 교체 + 현행 동기화)
> 참여 Agent: Architect, Gatekeeper, Conductor, Librarian
> 현행 CI: `.github/workflows/ci.yml` (752행, 23개 job)
> CD: ArgoCD (aether-gitops 레포 감시 → 자동 배포)
> GitOps 레포: `tpals0409/aether-gitops` (AlgoSu 매니페스트: `algoso/`)
> 관련 문서: `docs/monitoring-log-rules.md`, `docs/AlgoSu_UIv2_실행계획서.md`

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
gateway, identity, submission, problem, github-worker, ai-analysis, frontend, minio
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

### 파이프라인 (CI: GitHub Actions + CD: ArgoCD GitOps)

```
detect-changes → lint/quality → test → build+push → aether-gitops 태그 업데이트 → ArgoCD 자동 sync
```

### Quality Gate job

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

점진 상향: 현재 60% → Sprint UI-6 후 70% → 안정화 후 80%

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

gitleaks 바이너리 직접 설치 방식 (Action 대비 버전 고정 + 속도 이점):

```yaml
secret-scan:
  name: Secret & Env Scan
  runs-on: ubuntu-latest
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - name: Install gitleaks
      run: |
        GITLEAKS_VERSION="8.21.2"
        curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
          | tar xz -C /usr/local/bin gitleaks
    - name: Run gitleaks secret scan
      run: |
        if [ "${{ github.event_name }}" = "pull_request" ]; then
          gitleaks detect --source . --config .gitleaks.toml \
            --log-opts "${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.head.sha }}" \
            --verbose
        else
          gitleaks detect --source . --config .gitleaks.toml --verbose
        fi
```

`.env` 파일 커밋 방지 검증 (동일 job 내 스텝):

```yaml
    - name: Reject committed .env files
      run: |
        VIOLATIONS=$(git ls-files | grep -E '(^|/)\.env($|\..*)' | grep -v '\.env\.example' || true)
        if [ "${{ github.event_name }}" = "pull_request" ]; then
          PR_ENV=$(git diff --name-only "${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.head.sha }}" \
            | grep -E '(^|/)\.env($|\..*)' | grep -v '\.env\.example' || true)
          [ -n "$PR_ENV" ] && VIOLATIONS="$VIOLATIONS $PR_ENV"
        fi
        if [ -n "$(echo "$VIOLATIONS" | tr -d ' ')" ]; then
          echo "::error::SECURITY VIOLATION: .env files detected in Git"
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
  - GITOPS_TOKEN (aether-gitops 레포 push용 GitHub PAT, scope: repo)
  - DISCORD_WEBHOOK_DEPLOY, DISCORD_WEBHOOK_EMERGENCY

Environment: dev
  - (동일 키, dev 서버 값)

[삭제됨 — SSH 직접 배포 폐지]
  - K3S_HOST, K3S_USER, K3S_SSH_KEY → ArgoCD GitOps 전환으로 불필요
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

### Python 버전 (통일 완료)

```yaml
env:
  PYTHON_VERSION: '3.12'   # ci.yml + Dockerfile 모두 3.12
```

---

## 7. 배포 전략

### 7-1. 배포 방식 (ArgoCD GitOps)

```
배포는 ArgoCD가 자동으로 수행한다.
CI의 마지막 단계에서 aether-gitops 레포의 이미지 태그를 업데이트하면,
ArgoCD가 변경을 감지(polling 3분)하여 k3s 클러스터에 자동 sync한다.

  AlgoSu CI ──(git push)──► aether-gitops/algoso/ ──(ArgoCD 감시)──► k3s 클러스터

SSH 직접 배포, SCP 전송, deploy.sh 수동 실행은 폐지되었다.
```

### 7-2. 배포 순서 (서비스 의존성 기반, ArgoCD Sync Wave)

```
Layer 0: PostgreSQL → Redis → RabbitMQ     (인프라)
Layer 1: Identity Service                   (인증 — 타 서비스 의존)
Layer 2: Problem + Submission               (비즈니스)
Layer 3: GitHub Worker + AI Analysis        (비동기)
Layer 4: Gateway                            (라우팅)
Layer 5: Frontend + Ingress                 (프론트)
```

### 7-3. Rolling Update 전략 (OCI 단일 노드)

블루-그린/카나리는 OCI Free Tier CPU 제약으로 불가. Rolling Update 사용.

**주의**: 모든 Deployment에 `strategy.type: RollingUpdate` 명시 필수 (현재 일부 누락 → Sprint UI-6 레거시 정리 C5).

| 서비스 | maxUnavailable | maxSurge | 이유 |
|--------|---------------|----------|------|
| Gateway (prod 2r) | 0 | 1 | 무중단 필수 |
| Identity (prod 2r) | 1 | 0 | 1개 유지로 충분 |
| Submission (prod 2r) | 0 | 1 | 제출 유실 방지 |
| MQ 소비자 (1r) | 1 | 0 | 메시지 큐 보존 |
| MinIO (1r) | 0 | 1 | 스토리지 무중단 |
| Prometheus | Recreate | - | TSDB lock 충돌 방지 |

### 7-4. 배포 승인 게이트

| 환경 | 승인 | 설정 |
|------|------|------|
| dev | 자동 | ArgoCD 자동 sync |
| prod | 자동 (CI 통과 후) | CI 7단계 완료 → aether-gitops push → ArgoCD 자동 sync |

### 7-5. 실서버 배포 체크리스트

- [ ] aether-gitops 레포 접근 권한 확인 (GITOPS_TOKEN 설정)
- [ ] ArgoCD Application 등록 확인 (배포 서버 측 작업)
- [ ] aether-gitops/algoso/base/ 매니페스트 최신 상태 확인
- [ ] Sealed Secrets가 aether-gitops 레포에 등록되어 있는지 확인
- [ ] CI 파이프라인 전체 녹색 확인 (Quality → Test → Build → Trivy)

---

## 8. 롤백 전략

### 3계층 롤백 (ArgoCD 기반)

**계층 1 — ArgoCD 자동 롤백**

```
ArgoCD Health Check 실패 시 → 이전 Sync 리비전으로 자동 복구
Liveness/Readiness Probe 실패 → 자동 롤백 트리거
```

**계층 2 — Git Revert 롤백**

```
aether-gitops에서 이전 커밋으로 git revert
→ ArgoCD가 감지 → 이전 이미지 태그로 자동 재배포
```

**계층 3 — 수동 이미지 지정**

```
aether-gitops/algoso/overlays/prod/kustomization.yaml에서
특정 서비스의 newTag를 이전 SHA로 수동 변경
→ 커밋/푸시 → ArgoCD 자동 sync
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

ArgoCD post-sync hook 또는 CI notify job에서 기록:

```yaml
# ci.yml notify job 내
- name: Grafana deployment annotation
  if: needs.deploy.result == 'success'
  run: |
    # Grafana가 k3s 내부 실행 → CI에서 직접 접근 불가
    # ArgoCD sync 후 배포 서버에서 annotation 생성
    echo "Grafana annotation created by ArgoCD post-sync hook"
    echo "Deploy SHA: ${{ github.sha }}"
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

| 리소스 | 한도 | 현재 사용 | 여유 | 비고 |
|--------|------|----------|------|------|
| CPU | 4 OCPU | ~1.85 OCPU | ~2.15 OCPU | MinIO 추가 예정 |
| Memory | 24 GB | ~5.2 GB | ~18.8 GB | |

**현재 k3d Pod**: 15개 Running (백엔드 6 + 프론트 1 + 인프라 4 + 모니터링 4)
**UI v2 추가**: MinIO (Sprint UI-1)

### 최적화 규칙

- GitHub Actions에서 빌드 (k3s 서버 빌드 금지)
- `revisionHistoryLimit: 3` (기본 10 → 축소)
- 미사용 이미지 주간 정리: `k3s crictl rmi --prune`
- GHA 캐시 scope 서비스별 분리
- Docker multi-stage build: runner 스테이지에서 npm/npx 제거 (Trivy 취약점 해소)

---

## 13. ADR (Architecture Decision Record)

### CI/CD 관련 ADR 기록 (5건)

| ADR | 제목 | 근거 |
|-----|------|------|
| 0001 | ARM64 전용 Docker 빌드 | OCI Free Tier A1 (ARM) |
| 0002 | `main-{sha}` 이미지 태그 | latest 재현 불가, 롤백 명확성 |
| 0003 | path filter 선택적 빌드 | 모노레포 비용 절감 |
| 0004 | GHA cache 전략 | Docker 빌드 시간 단축 |
| 0005 | ArgoCD GitOps CD 전환 | SSH 직접 배포 폐지, 앱/매니페스트 분리, 자동 롤백 |

### ADR 필요 기준

새 워크플로우 추가, 빌드 플랫폼/배포 전략/태그 전략 변경, 신규 Action 도입 시 ADR 필수

---

## 실행 현황 및 향후 계획

### 완료 항목 (v1.0~v1.1 기간)

| # | 항목 | 상태 |
|---|------|------|
| 1 | Python 버전 3.12 통일 | ✅ 완료 |
| 2 | `permissions: {}` 최상위 선언 | ✅ 완료 |
| 3 | gitleaks 시크릿 스캔 (바이너리 직접 설치) | ✅ 완료 |
| 4 | .env 커밋 방지 검증 | ✅ 완료 |
| 5 | Quality Gate job (lint + typecheck) | ✅ 완료 |
| 6 | commitlint job | ✅ 완료 |
| 7 | PR 템플릿 | ✅ 완료 |
| 8 | Trivy 이미지 스캔 (ARM64) | ✅ 완료 |
| 9 | ArgoCD GitOps 전환 (SSH 폐지) | ✅ 완료 |
| 10 | Discord 배포 알림 | ✅ 완료 |
| 11 | Grafana Annotation (post-sync) | ✅ 완료 |
| 12 | Dependabot 설정 (8 에코시스템) | ✅ 완료 |
| 13 | CODEOWNERS | ✅ 완료 |
| 14 | 전 서비스 ESLint 표준화 | ✅ 완료 |
| 15 | RollingUpdate 전략 매니페스트 적용 | ✅ 완료 |
| 16 | Trivy npm 번들 취약점 해소 (npm/npx 제거) | ✅ 완료 |

### UI v2 Sprint 연계 CI/CD 작업

| # | 항목 | Sprint | 담당 | 비고 |
|---|------|--------|------|------|
| 1 | MinIO manifest + SealedSecret 추가 | UI-1 | Architect | detect-changes 필터 불필요 (인프라) |
| 2 | UUID 마이그레이션 CI 검증 | UI-1 | Librarian | 전 서비스 빌드 영향 |
| 3 | httpOnly Cookie E2E 테스트 | UI-1 | Gatekeeper | 인증 플로우 변경 |
| 4 | CSP 헤더 설정 CI 검증 | UI-1 | Gatekeeper | Next.js config |
| 5 | 커버리지 70% 게이트 상향 | UI-6 | Sensei | 현행 60% → 70% |
| 6 | E2E 테스트 job 추가 | UI-6 | Scout | 주요 시나리오 자동화 |

### 향후 (UI v2 이후)

| # | 항목 | 담당 Agent | 난이도 |
|---|------|-----------|--------|
| 1 | dev 브랜치 트리거 + 환경별 배포 | Architect | 중간 |
| 2 | Reusable Workflow 리팩토링 | Architect | 높음 |
| 3 | CHANGELOG 자동화 (release-please) | Librarian | 중간 |
| 4 | Self-hosted ARM runner (OCI) | Architect | 높음 |
