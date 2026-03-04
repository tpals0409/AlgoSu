# Scout 배포 파일 전수 조사 (2026-03-03)

## 핵심 발견사항

### Dockerfile (7종) — ✓ 완성도 높음
- 모든 서비스: 멀티스테이지 + Alpine/slim 베이스
- non-root 사용자 설정 (UID:GID 1001 표준화)
- dev 종속성 분리 + npm 바이너리 제거
- **ARM64 호환성**: node:20-alpine, python:3.12-slim 공식 지원 ✓

### k8s 매니페스트 (24 YAML) — ✓ 준비됨
**애플리케이션 (7)**: gateway, identity, submission, problem, ai-analysis, github-worker, frontend
**인프라 (5+2)**: postgres, postgres-problem, redis, rabbitmq, minio, minio-init-job
**라우팅/모니터링**: ingress, namespace, 8개 모니터링 ConfigMap

**이미지 참조**: `ghcr.io/OWNER/algosu-{service}:main-PLACEHOLDER` (Kustomize overlay로 치환)

### Kustomize 구조 — ✓ 3환경 준비
- **base**: infra/k3s/ (단일 base)
- **overlays**: dev (1R, 익명 Grafana), staging (1R, 14d 보존), prod (2~4R, 보안강화, 30d 보존)
- 환경별 리소스/PVC/보안 정책 차등 구성

### Sealed Secrets — ✓ 12개 파일, 104키
생성됨: gateway(27), submission(12), problem(15), identity(8), github-worker(9), ai-analysis(6), postgres/redis/rabbitmq/minio/monitoring 각 1~2

**주의**: ai-analysis GEMINI_API_KEY → Claude API 전환되었으나 템플릿 미갱신 가능

### 모니터링 스택 — ✓ 8개 컴포넌트
Prometheus (30s interval, 8 job), Grafana (SLO: 99.5% 가용성), Loki/Promtail (JSON logging)

### CI/CD (ci.yml) — ✓ 23개 job 완성
```
secret-scan → detect-changes → quality → test → build(ARM64) → trivy →
deploy(aether-gitops 태그 업데이트) → notify(Discord)
```

## 해결 상태 (2026-03-03 갱신)

1. ~~**OWNER placeholder**~~: ✅ CI/CD 환경변수로 치환 완료 (ghcr.io/tpals0409/)
2. **minio:latest → 버전 고정**: ⚠ 미완 (ARM64 동작 확인됨, 태그 고정 권장)
3. ~~**ai-analysis-secrets.yaml**~~: ✅ Claude API 키로 Sealed Secret 재생성 완료 (ANTHROPIC_API_KEY)
4. ~~**aether-gitops 레포**~~: ✅ 초기화 + CI/CD 연동 완료
5. ~~**Sealed Secrets sealing key**~~: ✅ k3s 부트스트랩 후 생성 + 12개 Secret 적용 완료
6. ~~**GITOPS_TOKEN**~~: ✅ GitHub Secret 등록 완료

## 배포 준비도
**95% 완료**: OCI k3s 배포 + 16 Pod Running + 115/115 테스트 PASS

## 파일 경로 (참조)
- Dockerfile: `/root/AlgoSu/services/{gateway,identity,submission,problem,github-worker}/`, `/root/AlgoSu/services/ai-analysis/`, `/root/AlgoSu/frontend/`
- k8s manifests: `/root/AlgoSu/infra/k3s/` (24 YAML)
- Kustomize: `/root/AlgoSu/infra/overlays/{dev,staging,prod}/`
- Sealed Secrets: `/root/AlgoSu/infra/sealed-secrets/generated/` (12 files)
- CI/CD: `/root/AlgoSu/.github/workflows/ci.yml` (827줄)
