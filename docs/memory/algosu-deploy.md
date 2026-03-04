# AlgoSu 배포 상세 기록

> 최종 업데이트: 2026-03-04 Week 3 기능확장+UX+모니터링 Sprint

## P0 — Critical Blockers (5/5 완료)

| # | 작업 | 상태 |
|---|------|------|
| P0-1 | Identity Dockerfile 생성 | ✅ |
| P0-2 | Frontend Dockerfile 생성 + next.config.ts `output: 'standalone'` | ✅ |
| P0-3 | NestJS Dockerfile CMD 수정 (`dist/main` → `dist/src/main.js`) — gateway, problem, submission | ✅ |
| P0-4 | k8s 매니페스트 이미지 네이밍 수정 (6개 파일 9개 참조) — CI 패턴 `ghcr.io/OWNER/algoso-{svc}:main-PLACEHOLDER` 일치 | ✅ |
| P0-5 | Sealed Secrets kubeseal 적용 | ✅ k3d에서 10개 생성 완료 |

### P0 핵심 발견
- NestJS 빌드 경로: `dist/src/main.js` (tsconfig `baseUrl: "./"` 때문)
- github-worker CMD: `dist/main.js` (.js 확장자 포함, NestJS 아님)
- Identity 서비스 포트: 매니페스트 3001→3004 수정

## P1 — Infrastructure & Logging (6/6 완료)

| # | 작업 | 파일 |
|---|------|------|
| P1-6 | Ingress (Traefik) | `infra/k3s/ingress.yaml` |
| P1-7 | Frontend k8s manifest | `infra/k3s/frontend.yaml` |
| P1-8 | CI/CD deploy job | `.github/workflows/ci.yml` (deploy job) |
| P1-9 | RequestIdMiddleware | `gateway/src/common/middleware/request-id.middleware.ts` |
| P1-10 | StructuredLoggerService | `gateway/src/common/logger/structured-logger.service.ts` |
| P1-11 | Sanitize 유틸리티 | `gateway/src/common/logger/sanitize.ts` |

### P1 핵심 구현
- RequestIdMiddleware: X-Request-Id + X-Trace-Id 생성/전파, UUID 검증, HTTP 구조화 로그
- StructuredLoggerService: NestJS LoggerService 인터페이스 구현, JSON stdout 출력
- Sanitize: IP 마스킹, 이메일 마스킹, 헤더 [REDACTED], Axios 에러 직렬화
- CD: SSH + sed OWNER/PLACEHOLDER 치환 → kubectl apply
- Ingress 경로: /api, /auth, /sse, /health → gateway:3000 | / → frontend:3001

## P2 — Monitoring & Metrics (10/10 완료)

| # | 작업 | 파일 |
|---|------|------|
| P2-12 | 모니터링 YAML 중복 제거 | `prometheus.yaml`, `loki.yaml` 삭제 |
| P2-13 | Prometheus scrape 수정 | `prometheus-config.yaml` (submission 3003, identity 추가, github-worker 제거) |
| P2-14 | Grafana 포트 + provisioning | `grafana.yaml` (3000), `grafana-datasources.yaml` |
| P2-15 | Promtail DaemonSet | `promtail.yaml` (DaemonSet + RBAC + JSON pipeline) |
| P2-16 | prom-client NestJS 4서비스 | `common/metrics/` (service, controller, module) |
| P2-17 | prometheus_client ai-analysis | `ai-analysis/src/metrics.py` |
| P2-18 | ai-analysis 구조화 로거 통합 | `main.py` basicConfig → setup_logging() |
| P2-19 | github-worker 구조화 로거 통합 | `main.ts` console.log → logger |
| P2-20 | TypeORM maxQueryExecutionTime | 4서비스 1초 초과 경고 |
| P2-21 | Grafana Ingress | `/grafana` → grafana:3000 (sub-path) |

### P2 핵심 구현
- MetricsModule: NestJS Global Module + APP_INTERCEPTOR 패턴
  - Histogram: `algosu_{svc}_http_request_duration_seconds`
  - Counter: `algosu_{svc}_http_requests_total`, `_http_errors_total`
  - Gauge: `algosu_{svc}_http_active_requests`
  - path 정규화: UUID/숫자 → `:id` (고카디널리티 방지)
  - /health, /metrics 제외
- ai-analysis metrics.py: FastAPI BaseHTTPMiddleware + CB Gauge + Gemini Counter
- Promtail: JSON pipeline stages (level, service, tag 라벨 승격, traceId structured metadata)
- Grafana: Prometheus + Loki datasource 자동 provisioning

### 발견된 이슈 (P2 중)
- prometheus.yaml ↔ prometheus-config.yaml 중복 (버전/설정 불일치) → 정본 통합
- loki.yaml ↔ loki-config.yaml 중복 → 정본 통합
- Prometheus scrape submission:3001 (실제 3003), github-worker:3003 (HTTP 없음) → 수정
- Grafana 포트 3001 frontend와 혼동 → 3000 변경
- ai-analysis CircuitBreaker 싱글턴 2개 존재 (circuit_breaker.py + gemini_client.py) → 추후 리팩토링 필요

## 서비스 포트 매핑 (확정)

| 서비스 | 포트 | 타입 |
|--------|------|------|
| Gateway | 3000 | NestJS |
| Frontend | 3001 | Next.js |
| Problem | 3002 | NestJS |
| Submission | 3003 | NestJS |
| Identity | 3004 | NestJS |
| AI Analysis | 8000 | FastAPI |
| GitHub Worker | - | MQ Worker (HTTP 없음) |
| Grafana | 3000 | 모니터링 (/grafana sub-path) |
| Prometheus | 9090 | 모니터링 |
| Loki | 3100 | 모니터링 |

## k8s 매니페스트 이미지 패턴
- CI 빌드: `ghcr.io/{owner}/algoso-{service}:main-{sha}`
- 매니페스트: `ghcr.io/OWNER/algoso-{service}:main-PLACEHOLDER`
- CD에서 sed로 OWNER/PLACEHOLDER 치환

## P3 — Monitoring Optimization + Infra (4/4 완료)

| # | 작업 | 파일 |
|---|------|------|
| P3-1 | Grafana SLO 대시보드 | `monitoring/grafana-dashboard-provider.yaml`, `grafana-slo-dashboard.yaml` |
| P3-2 | Prometheus Alert Rules (8그룹) | `monitoring/prometheus-rules.yaml` |
| P3-3 | Kustomize base/overlays | `k3s/kustomization.yaml`, `overlays/{dev,staging,prod}/` |
| P3-4 | DB 분리 스프린트 계획 | `plan/phase3-db-separation-sprint.md` |

### P3 핵심 구현
- SLO 대시보드: 14패널 7열 (Overview/Service Health/Error Rate/Latency/Throughput/AI/Resources)
- Alert 8그룹: availability, error_rate, latency, security, circuit_breaker, resources, messaging, rabbitmq
- Kustomize: base(k3s/) + overlays(dev: 1 replica, staging: 1 replica moderate, prod: 2 replica enhanced)
- DB 분리: Sprint 3-1 Problem(1주) → 3-2 Submission(2주) → 3-3 Identity(2주), Dual Write 3-stage 패턴

## k3d 배포 완료 (2026-02-28)

### 인프라 구성
- k3d 클러스터: `algoso` (단일 노드)
- Sealed Secrets: bitnami controller + 10개 SealedSecret 생성
- Kustomize dev overlay: `kubectl apply -k infra/overlays/dev/`
- 이미지: 7개 Docker 이미지 빌드 → k3d import (algoso-*:dev)

### 최종 Pod 현황 (14/14 Running)
| 구분 | Pod |
|------|-----|
| 인프라 | postgres, redis, rabbitmq |
| 백엔드 | gateway, identity-service, problem-service, submission-service, ai-analysis-service, github-worker |
| 프론트 | frontend |
| 모니터링 | prometheus, grafana, loki, promtail |

### Prometheus: 5/5 UP
- gateway:3000, identity-service:3004, problem-service:3002, submission-service:3003, ai-analysis-service:8000

### Grafana
- 데이터소스: Prometheus + Loki
- 대시보드: AlgoSu SLO Dashboard (uid: algosu-slo) + AlgoSu 기본

### Loki + Promtail
- static_configs + CRI pipeline stage로 전체 Pod 로그 수집
- 라벨: namespace, pod, container, service, level, tag, stream

### 배포 중 수정한 소스 파일
- `services/{problem,submission,identity}/src/health.controller.ts` (신규)
- `services/{problem,submission,identity}/src/app.module.ts` (HealthController 등록)
- `services/gateway/src/app.module.ts` (MetricsModule 순서 변경)
- `services/gateway/src/proxy/proxy.module.ts` (/metrics exclude)
- `infra/k3s/monitoring/loki-config.yaml` (WAL 경로)
- `infra/k3s/monitoring/prometheus-config.yaml` (서비스명 수정)
- `infra/k3s/monitoring/promtail.yaml` (static_configs + CRI)

### Sealed Secrets 생성 목록 (10개)
- `infra/sealed-secrets/generated/sealed-*.yaml`
- gateway-secrets, identity-service-secrets, problem-service-secrets, submission-service-secrets
- ai-analysis-secrets, github-worker-secrets, postgres-secret, redis-secret, rabbitmq-secret, monitoring-secrets

## OCI k3s 배포 완료 (2026-03-03)

### 환경
- k3s v1.34.4 (OCI ARM aarch64, 단일 노드)
- Traefik Helm v3.6.8 (kube-system)
- ArgoCD (argocd 네임스페이스, 7 Pod, manual sync)
- kubeseal v0.36.0

### 최종 Pod 현황 (16/16 Running)
| 구분 | Pod |
|------|-----|
| 백엔드 | gateway, identity-service, problem-service, submission-service, ai-analysis-service, github-worker |
| 프론트 | frontend |
| 인프라 | postgres, postgres-problem, redis, rabbitmq, minio |
| 모니터링 | prometheus, grafana, loki, promtail |

### Sealed Secrets 12개 (Redis hex 전환)
- k3d 10개 + minio-secret + ghcr-pull-secret
- Redis/RabbitMQ URL: base64 패스워드 `+` 문자 → hex 전환 (URL 파싱 안전)

### 배포 중 해결 이슈 (5건)
1. **이미지 네이밍**: Docker `algoso-*` → Kustomize `algosu-*` 불일치 → 리태깅
2. **Redis URL 특수문자**: base64 `+` → Python urllib 파싱 실패 → hex 비밀번호 재생성
3. **Traefik 미설치**: k3s 기본에 traefik 없음 (k3d와 다름) → Helm 수동 설치
4. **KUBECONFIG 미설정**: `/etc/rancher/k3s/k3s.yaml` 환경변수 지정
5. **ArgoCD CRD 크기**: `kubectl apply` 실패 → `--server-side --force-conflicts`

### 전체 프로젝트 검증 결과
- 빌드: 7/7 PASS (NestJS 5 + Python 1 + Next.js 1)
- 타입체크: 6/6 PASS
- 단위 테스트: 115/115 ALL PASS (테스트 수정 8파일, 프로덕션 변경 0)
- API 라이브: Health 6/6, Protected 3/3→401, Prometheus 6/6 UP, 인프라 5/5
- UI 목업 대조: 88% 일치, HIGH 0건

### 테스트 수정 내역
| 서비스 | 파일 | 수정 내용 |
|--------|------|-----------|
| gateway | oauth.service.spec.ts | Redis mock `.on()`, userRepository findOne mock |
| gateway | study.service.spec.ts | Redis mock `.on()`, `count` mock, `github_repo` 필드, 5분 만료 |
| problem | problem.service.spec.ts | `level: null`, `tags: null` 기대값 |
| github-worker | token-manager.spec.ts | config 모듈 mock |
| ai-analysis | test_gemini_client.py | GeminiClient→ClaudeClient 전면 재작성 |
| ai-analysis | test_worker.py | ClaudeClient 참조, POST→PATCH |

## Cloudflare Tunnel + 도메인 연결 (2026-03-03)
- 도메인: `algo-su.com` (Cloudflare 구매)
- 터널: `algosu-prod` (Docker, --network host, --restart unless-stopped)
- Public Hostname: `algo-su.com` → `http://localhost:80`
- HTTPS 자동 (Cloudflare SSL)
- Gateway Secret 업데이트: OAUTH_CALLBACK_URL, FRONTEND_URL, ALLOWED_ORIGINS → `https://algo-su.com`
- Google OAuth: Client ID/Secret 설정 완료
- GitHub OAuth: Client ID/Secret 설정 완료, callback: `https://algo-su.com/auth/github/link/callback`

## PM 라이브 테스트 핫픽스 (2026-03-03, HEAD: 8780b44)

### 수정 내역
| # | 문제 | 원인 | 수정 |
|---|------|------|------|
| 1 | 스터디 미가입 시 대시보드 접근 가능 | Route guard에 스터디 존재 확인 없음 | `useRequireStudy` 훅 신설, 10 페이지 적용 |
| 2 | StudySidebar 불필요 | 대시보드와 기능 중복 | AppLayout에서 제거 |
| 3 | 스터디 생성 GitHub 레포 필드 | 개인 레포 방식이라 불필요 | 폼에서 제거 |
| 4 | 알림 클릭 시 404 | `/studies/{id}/members` 라우트 미존재 | `/studies/{id}`로 변경 |
| 5 | 멤버십 확인 500 에러 | Gateway `INTERNAL_API_KEY` 환경변수 누락 | k8s Secret 직접 추가 |
| 6 | 에러 메시지 불일치 | Problem vs Submission guard 문구 다름 | Submission 문구를 Problem에 맞춤 |
| 7 | Gitleaks false positive | 메모리/스크립트 파일에 더미 JWT | `.gitleaks.toml` 허용 패턴 추가 |

### 배포 방법 (CI/CD 미연결, 수동)
```bash
# 1. 빌드 (OCI ARM)
docker build -t ghcr.io/tpals0409/algosu-{service}:main-{sha} \
  -f {Dockerfile} {context} --platform linux/arm64

# 2. k3s 로드
docker save {image} | sudo k3s ctr images import -

# 3. 배포
kubectl set image deployment/{name} {container}={image} -n algosu

# 4. initContainer 패치 (필요 시)
kubectl patch deployment {name} -n algosu --type='json' \
  -p='[{"op":"replace","path":"/spec/template/spec/initContainers/0/image","value":"{image}"}]'
```

### k8s deployment 이름 매핑
| 서비스 | deployment 이름 | container 이름 |
|--------|-----------------|----------------|
| gateway | gateway | gateway |
| frontend | frontend | frontend |
| problem | problem-service | problem-service |
| submission | submission-service | submission-service |
| identity | identity-service | identity-service |
| ai-analysis | ai-analysis-service | ai-analysis-service |
| github-worker | github-worker | github-worker |

## CI/CD 정비 (2026-03-04)

### Dockerfile 변경
- 전 Node.js 서비스(6개) builder: `FROM --platform=$BUILDPLATFORM node:20-alpine AS builder`
- `prod_node_modules`: `/app` → `/tmp` 이동 (tsc 스캔 방지)
- ai-analysis: 변경 없음 (pydantic-core ARM64 필요)
- Gateway: runner에서 `npm ci --omit=dev` 제거 → builder에서 `prod_node_modules` 패턴으로 통일

### aether-gitops 복구
- `79de742` 커밋에서 `kustomization.yaml` 잘림 (2줄만 남음)
- `971088d`에서 복구: 전 서비스 `main-302bb6f` SHA 통일 + patches 복원

### Repo Public 전환
- Private → Public (2026-03-04): GitHub Actions 무료 무제한
- GHCR pull secret: public repo에서도 유지 (GHCR 인증 별도)

## Week 1 안정화 Sprint (2026-03-04)

### GHCR Pull Secret 갱신
- PM이 Classic PAT (`algosu-k8s-ghcr-pull`, `read:packages` 스코프) 생성
- `kubectl delete secret ghcr-pull-secret` → 재생성 → 5개 서비스 이미지 풀 정상화
- Fine-grained token은 `read:packages` 미지원 → Classic PAT 필수

### Gateway sharp ARM64 크래시 수정 (커밋 5e9ba55)
- 원인: `--platform=$BUILDPLATFORM`(x86) builder에서 설치된 sharp 네이티브 모듈이 ARM64 runner에서 크래시
- 수정: production 스테이지에서 `npm rebuild sharp` 추가 후 npm 삭제
- 전 서비스 점검: Gateway만 sharp 사용, 나머지 6개 서비스는 순수 JS → 안전

### 모니터링 스택 정비 (aether-gitops dd10556)
- Loki: `allow_structured_metadata: true` 추가 (`kubectl replace -f` 사용)
- Promtail: structured_metadata stage 정상 복원
- Prometheus: alertname 중복 제거 (서비스별 고유명), ai-analysis 에러율 룰 추가, Recreate 전략
- Grafana: Loki 로그 패널 추가, 시간 범위 1h→6h
- prod overlay: ai-analysis 리소스 정상화 (4Gi→1Gi limit, 1Gi→256Mi request)

### 서비스별 이미지 태그 현황 (2026-03-04 Week 3 이후)
| 서비스 | 이미지 태그 | 비고 |
|--------|-------------|------|
| gateway | main-9e4bebf | Naver/Kakao OAuth + glob/minimatch CVE |
| problem | main-9e4bebf | glob/minimatch CVE |
| submission | main-9e4bebf | glob/minimatch CVE |
| identity | main-9e4bebf | |
| github-worker | main-9e4bebf | glob/minimatch CVE |
| ai-analysis | main-9e4bebf | gemini_client.py 삭제 |
| frontend | main-9e4bebf | Suspense + Dynamic Import + Motion Reducer |

### Architect 더블체크 결과
- PASS 4 / FAIL 4 → 전건 수정 완료

## Week 2 Sprint 변경사항 (2026-03-04)

### 신규 배포 리소스
- `sealed-secrets/sealed-postgres-init-passwords.yaml` — PG init 스크립트 비밀번호
- `monitoring/kube-state-metrics.yaml` — ServiceAccount + ClusterRole + Deployment + Service
- Loki 3.3.2 (schema v13 tsdb 추가)
- Prometheus kube-state-metrics scrape job

### 보안 강화
- PG init SQL → Shell 스크립트 + psql `-v` 변수 바인딩 (SQL injection 방어)
- Review API publicId 전환 (IDOR 방어)
- Entity toJSON() 내부 PK 스트리핑
- Gateway proxy HttpException 정확한 상태코드 전파
- kube-state-metrics RBAC에서 secrets 리소스 제거

### 검증사이클 2 결과
- Gatekeeper: PASS 12 / OPEN 3 → 전건 수정
- Architect: PASS 12 / FAIL 4 → 전건 수정
- E2E: 30/30 ALL PASS
- 단위: 115/115 ALL PASS

## 남은 작업
- ✅ ~~실 서버 k3s 배포~~ (2026-03-03)
- ✅ ~~도메인 + Cloudflare Tunnel~~ (2026-03-03)
- ✅ ~~Google/GitHub OAuth 크레덴셜~~ (2026-03-03)
- ✅ ~~FRONTEND_URL/ALLOWED_ORIGINS 도메인 설정~~ (2026-03-03)
- ✅ ~~Gateway INTERNAL_API_KEY 설정~~ (2026-03-03)
- ✅ ~~aether-gitops kustomization.yaml 복구~~ (2026-03-04)
- ✅ ~~CI/CD Dockerfile QEMU 수정~~ (2026-03-04)
- ✅ ~~GHCR pull secret 갱신~~ (2026-03-04)
- ✅ ~~Gateway sharp ARM64 수정~~ (2026-03-04)
- ✅ ~~모니터링 스택 정비~~ (2026-03-04)
- ✅ ~~AI API (Claude) 크레덴셜 설정~~ (2026-03-04, SealedSecret)
- ✅ ~~GitHub App 크레덴셜 설정~~ (2026-03-04, SealedSecret)
- ✅ ~~PG init SQL 비밀번호 시크릿화~~ (2026-03-04, psql `-v` 바인딩)
- ✅ ~~E2E 테스트 재작성~~ (2026-03-04, 30/30 ALL PASS)
- ✅ ~~Review publicId 전환~~ (2026-03-04, 7파일 3서비스)
- ✅ ~~Loki v13 + kube-state-metrics~~ (2026-03-04)
- ✅ ~~Naver/Kakao OAuth 크레덴셜 설정~~ (2026-03-04, SealedSecret)
- ✅ ~~Loki v11 schema 제거~~ (2026-03-04, tsdb v13 단일)
- ✅ ~~Grafana Service Debug 대시보드~~ (2026-03-04, 19패널 projected volume)
- ✅ ~~Trivy CVE 수정~~ (2026-03-04, glob/minimatch npm overrides)
- CSP unsafe-eval 장기 해결 (Monaco 대체 검토)

## Week 3 Sprint 변경사항 (2026-03-04)

### Sealed Secrets 갱신 — Naver/Kakao OAuth
- Naver Client ID/Secret → `sealed-gateway-secrets.yaml` 갱신
- Kakao REST API Key/Client Secret → `sealed-gateway-secrets.yaml` 갱신
- kubeseal 재암호화 → kubectl apply → Gateway Pod 재시작
- 클러스터 라이브 확인 완료 (환경변수 주입 검증)

### Grafana Projected Volume
- SLO 대시보드 (`grafana-slo-dashboard.yaml`) + Service Debug 대시보드 (`grafana-service-dashboard.yaml`)
- Grafana Deployment: projected volume으로 2개 ConfigMap 마운트
- Service Debug: 19패널 + 5 row sections, template variables (service + pod_prefix)

### Loki v11 Schema 제거
- boltdb-shipper (v11) 제거 → tsdb (v13) 단일 schema
- 소스 repo `loki-config.yaml` + aether-gitops 양쪽 동기화

### Trivy CVE 수정
- `glob@10.4.5` → `10.5.0` (CVE-2025-64756 Command Injection)
- `minimatch@9.0.3` → `9.0.7` (CVE-2026-26996/27903/27904 ReDoS)
- npm overrides 적용: gateway, problem, submission, github-worker (4서비스)
- CI Trivy 7/7 PASS

### 검증사이클 3 결과
- Gatekeeper: 22/22 PASS (OPEN 0건)
- Architect: 12/13 PASS, FAIL 1건 → 즉시 수정 (Grafana ai_analysis variable)
- E2E: 39/39 ALL PASS (OAuth 9건 추가)
- 단위: 115/115 ALL PASS

## OAuth 핫픽스 배포 (2026-03-04, aether-gitops HEAD: 536746b)

### 발단
- Naver/Kakao 로그인 실패: `OAUTH_CALLBACK_URL=http://localhost` → 콜백 URL 이중 경로
- Google 로그인 401: Client ID/Secret이 PLACEHOLDER

### 수정 내역 (5건)

| # | 문제 | 원인 | 수정 |
|---|------|------|------|
| 1 | Naver/Kakao OAuth 콜백 실패 | `OAUTH_CALLBACK_URL=http://localhost` | SealedSecret → `https://algo-su.com` |
| 2 | OAuth 에러 시 JSON 표시 | 콜백 핸들러 에러 → raw JSON 반환 | `res.redirect(#error=...)` 패턴 |
| 3 | 1계정 다중 OAuth 데이터 꼬임 | upsertUser()가 provider 미검증 | provider 불일치 시 BadRequestException |
| 4 | Google 로그인 401 | Client ID/Secret PLACEHOLDER | 실제 크레덴셜 SealedSecret 설정 |
| 5 | middleware PUBLIC_PATHS 오류 | `/auth/callback` (잘못됨) | `/callback`으로 수정 |

### 배포 과정
1. Gateway + Frontend 코드 수정 (oauth.controller.ts, oauth.service.ts, middleware.ts, callback/page.tsx)
2. Docker build → `docker save | k3s ctr images import` (gateway, frontend)
3. aether-gitops `kustomization.yaml` 이미지 태그 `oauth-fix2`로 업데이트
4. SealedSecret 3회 재생성 (환경변수 수정 → 코드 수정 → Google 크레덴셜 추가)
5. ArgoCD hard refresh로 동기화

### 서비스별 이미지 태그 (OAuth 핫픽스 이후)
| 서비스 | 이미지 태그 | 비고 |
|--------|-------------|------|
| gateway | oauth-fix2 | OAuth 콜백 에러핸들링 + 1계정1OAuth |
| frontend | oauth-fix2 | middleware + callback 페이지 |
| identity | main-d9c3dd7 | CI/CD 정비 Sprint 태그 |
| problem | main-9e4bebf | Week 3 태그 유지 |
| submission | main-9e4bebf | Week 3 태그 유지 |
| github-worker | main-9e4bebf | Week 3 태그 유지 |
| ai-analysis | main-302bb6f | 검증사이클 1 태그 |

### 배포 중 해결 이슈 (3건 추가)
6. **SealedSecret localhost 하드코딩**: ArgoCD가 SealedSecret 관리 → `kubectl patch` 수동 수정은 selfHeal로 원복 → kubeseal 재생성 + aether-gitops push 필수
7. **ArgoCD selfHeal 롤백**: `kubectl set image` 수동 변경도 원복됨 → kustomization.yaml 태그 변경 + ArgoCD hard refresh
8. **이미지명 slash vs hyphen**: `algosu/gateway`(빌드) ≠ `algosu-gateway`(k8s) → `docker tag`로 리네이밍
