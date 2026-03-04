# AlgoSu 배포 가이드 (GitOps 단일화)

## 확정 배포 방식: ArgoCD GitOps

AlgoSu는 **ArgoCD 기반 GitOps**를 유일한 운영 배포 방식으로 사용한다.
SSH 직접 배포는 폐지되었으며, `scripts/deploy.sh`는 로컬 개발/긴급 복구 전용이다.

## 배포 파이프라인 전체 흐름

```
개발자 Push (main)
    |
    v
GitHub Actions CI (.github/workflows/ci.yml)
    |
    +-- secret-scan (gitleaks + .env 검사)
    +-- detect-changes (path filter: 변경된 서비스만)
    +-- lint / typecheck / test (서비스별 병렬)
    +-- Docker Build & Push (GHCR, ARM64)
    |       태그: main-{git-sha} (latest 절대 금지)
    |
    v
aether-gitops 레포 태그 업데이트
    |
    v
ArgoCD 감지 → k3s 클러스터 자동 Sync
```

## 디렉토리 구조

```
infra/
├── k3s/                        # Kustomize base 매니페스트
│   ├── kustomization.yaml      # 전체 리소스 목록
│   ├── namespace.yaml
│   ├── postgres.yaml           # Layer 0: 인프라
│   ├── postgres-problem.yaml
│   ├── redis.yaml
│   ├── rabbitmq.yaml
│   ├── minio.yaml
│   ├── identity-service.yaml   # Layer 1: 인증
│   ├── problem-service.yaml    # Layer 2: 비즈니스
│   ├── submission-service.yaml
│   ├── github-worker.yaml      # Layer 3: 비동기
│   ├── ai-analysis-service.yaml
│   ├── gateway.yaml            # Layer 4: 라우팅
│   ├── frontend.yaml           # Layer 5: UI + Ingress
│   ├── ingress.yaml
│   ├── metrics-network-policy.yaml
│   └── monitoring/             # Prometheus, Grafana, Loki, Promtail
├── overlays/
│   ├── dev/kustomization.yaml
│   ├── staging/kustomization.yaml
│   └── prod/kustomization.yaml # replicas, 리소스 강화, PVC 확장
└── sealed-secrets/             # SealedSecret 템플릿 + generated/
```

## Layer 순서 (배포 의존성)

| Layer | 구성 요소 | 의존 대상 |
|-------|----------|-----------|
| 0 | PostgreSQL, Redis, RabbitMQ, MinIO | 없음 |
| 1 | identity-service | PostgreSQL |
| 2 | problem-service, submission-service | PostgreSQL, RabbitMQ |
| 3 | github-worker, ai-analysis-service | RabbitMQ, Redis |
| 4 | gateway | 전 서비스 |
| 5 | frontend, ingress | gateway |

ArgoCD Sync Wave 또는 deploy.sh의 순차 적용으로 순서를 보장한다.

## Docker 이미지 정책

- 레지스트리: `ghcr.io/{owner}/algosu/{service}`
- 태그 규칙: `main-{git-sha}` (latest 태그 절대 금지)
- 플랫폼: `linux/arm64` (OCI ARM 인스턴스)
- 빌드: multi-stage, GHA 러너에서 빌드 (k3s 서버 빌드 금지)
- builder 스테이지: `FROM --platform=$BUILDPLATFORM` (QEMU SIGILL 방지)

## 시크릿 관리

- **Sealed Secrets 전용** -- 평문 Secret 커밋 절대 금지
- 템플릿: `infra/sealed-secrets/sealed-secrets-template.yaml`
- 생성: `kubeseal --format yaml < secret.yaml > sealed-secret.yaml`
- 생성된 파일: `infra/sealed-secrets/generated/` 하위

## Kustomize Overlay 전략

- **dev**: base 그대로 (리소스 최소, 로컬 k3d용)
- **staging**: 중간 리소스, 통합 테스트용
- **prod**: replicas 2 (gateway, identity, submission), 리소스 강화, PVC 확장, Grafana 익명 접근 차단

적용 방법:
```bash
kubectl apply -k infra/overlays/prod/
```

## scripts/deploy.sh 역할

`deploy.sh`는 **로컬 개발 환경** 및 **긴급 복구** 전용 스크립트이다.

- Layer 순서대로 `kubectl apply` 수행
- 각 Layer마다 rollout 상태 확인
- 서비스 Layer 실패 시 자동 `rollout undo` (인프라 Layer는 수동 개입)
- 운영 환경에서는 ArgoCD가 이 역할을 대체

사용법 (긴급 상황만):
```bash
DEPLOY_SHA=$(git rev-parse HEAD) ./scripts/deploy.sh
```

## OCI Free Tier 제약

- CPU: 4 OCPU (ARM Ampere A1)
- Memory: 24GB
- `revisionHistoryLimit: 3` (디스크 절약)
- k3s 서버에서 Docker 빌드 금지 (GHA에서만)

## 롤백 절차

1. **ArgoCD UI/CLI**: History에서 이전 리비전으로 Sync
2. **긴급 수동**: `kubectl -n algosu rollout undo deployment/{서비스명}`
3. deploy.sh: 이전 SHA로 재실행

## CI 품질 게이트

배포 전 반드시 통과해야 하는 항목:
- gitleaks 시크릿 스캔
- .env 파일 커밋 차단
- ESLint (`no-console: error`)
- TypeScript (`tsc --noEmit`)
- Jest 테스트 + 커버리지 60%
- Python Ruff (`T20` print 금지)
- Trivy 이미지 스캔 (CRITICAL, HIGH)
