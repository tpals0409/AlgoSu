# AlgoSu 배포 상세 기록

> 최종 업데이트: 2026-02-28 k3d 배포 완료

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

## 남은 작업
- 실 서버 k3s 배포 (OCI VM 접속 정보 확보 후 k3s-bootstrap.sh 실행)
- Sprint 3-2 코드 CI 파이프라인 통과 확인 (push 후)
- Phase 3 Sprint 3-3: Submission DB 분리
- Phase 3 Sprint 3-4: Identity DB 분리
- expand 24h 안정화 → switch-read → 구 DB problem 테이블 제거
