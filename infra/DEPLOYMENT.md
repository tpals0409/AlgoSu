# AlgoSu 배포 가이드 (GitOps 단일화)

## 확정 배포 방식: ArgoCD GitOps

AlgoSu는 **ArgoCD 기반 GitOps**를 유일한 운영 배포 방식으로 사용한다.
SSH 직접 배포는 폐지되었으며, `scripts/deploy.sh`는 긴급 복구 전용이다.

> **ADR-029 (SSOT 일원화)**: k8s 매니페스트의 단일 진실원천(SSOT)은
> **aether-gitops**(`algosu/base/` + `algosu/overlays/prod/`)다. AlgoSu 레포 내
> 평행 매니페스트 정의(구 `infra/k3s/` + `infra/overlays/`)는 폐기되었다.
> AlgoSu CI는 aether-gitops의 **이미지 태그만** bump하며 매니페스트를 전파하지 않는다.

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

## 디렉토리 구조 (SSOT: aether-gitops)

매니페스트 SSOT는 별도 레포 **aether-gitops**에 있다 (ADR-029).

```
aether-gitops/
└── algosu/
    ├── base/                       # Kustomize base 매니페스트
    │   ├── kustomization.yaml       # 전체 리소스 목록 + revisionHistoryLimit patch
    │   ├── namespace.yaml
    │   ├── postgres.yaml            # Layer 0: 인프라
    │   ├── redis.yaml / rabbitmq.yaml / minio.yaml
    │   ├── identity-service.yaml    # Layer 1: 인증
    │   ├── problem-service.yaml     # Layer 2: 비즈니스
    │   ├── submission-service.yaml
    │   ├── github-worker.yaml       # Layer 3: 비동기
    │   ├── ai-analysis-service.yaml
    │   ├── gateway.yaml             # Layer 4: 라우팅
    │   ├── frontend.yaml / ingress.yaml  # Layer 5
    │   ├── monitoring/              # Prometheus, Grafana, Loki, Promtail, Alertmanager
    │   └── sealed-secrets/          # SealedSecret
    └── overlays/prod/              # replicas, 리소스 강화, image 태그

AlgoSu 레포:
infra/
└── sealed-secrets/             # SealedSecret 템플릿/문서 (참고용)
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

적용 방법 (aether-gitops overlay):
```bash
kubectl apply -k <aether-gitops>/algosu/overlays/prod/
```

## scripts/deploy.sh 역할

`deploy.sh`는 **긴급 복구** 전용 스크립트이다 (ADR-029: SSOT = aether-gitops).

- aether-gitops를 clone(또는 로컬 경로 재사용)하여 `kubectl apply -k overlays/prod` 일괄 적용
- 일괄 적용 후 Layer 순서대로 rollout 상태 확인 (schema mismatch 방지 안전망)
- 서비스 Layer 실패 시 자동 `rollout undo` (인프라 Layer는 수동 개입)
- 운영 환경에서는 ArgoCD가 이 역할을 대체

사용법 (긴급 상황만):
```bash
# private repo clone (PAT 필요)
GITOPS_TOKEN=<pat> ./scripts/deploy.sh
# 또는 로컬 aether-gitops 클론 재사용
GITOPS_LOCAL=/path/to/aether-gitops ./scripts/deploy.sh
```

## OCI Free Tier 제약

- CPU: 4 OCPU (ARM Ampere A1)
- Memory: 24GB
- `revisionHistoryLimit: 3` (디스크 절약)
- k3s 서버에서 Docker 빌드 금지 (GHA에서만)

## 롤백 절차

1. **ArgoCD UI/CLI**: History에서 이전 리비전으로 Sync
2. **긴급 수동**: `kubectl -n algosu rollout undo deployment/{서비스명}`
3. deploy.sh: aether-gitops 이전 리비전 checkout 후 재실행 (긴급)

## CI 품질 게이트

배포 전 반드시 통과해야 하는 항목:
- gitleaks 시크릿 스캔
- .env 파일 커밋 차단
- ESLint (`no-console: error`)
- TypeScript (`tsc --noEmit`)
- Jest 테스트 + 커버리지 60%
- Python Ruff (`T20` print 금지)
- Trivy 이미지 스캔 (CRITICAL, HIGH)
