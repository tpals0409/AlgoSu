# 인프라 매니페스트 GitOps 이관 런북

> 대상: AlgoSu 소스 레포(infra/k3s/) → aether-gitops 레포 매니페스트 이관
> 작성일: 2026-04-10 (Sprint 79, Sprint 73 G4 교훈 반영)
> 관련 런북: `runbook-pat-rotation.md` (PAT 로테이션)

---

## 배경

Sprint 70에서 cloudflared 매니페스트를 aether-gitops로 이관했으나, 소스 레포(AlgoSu) `infra/k3s/kustomization.yaml`의 참조를 제거하지 않아 **4주간 고아 매니페스트가 존재**했다(Sprint 70→73). 동일 리소스가 소스 레포와 GitOps 레포 양쪽에서 관리되는 상태로, ArgoCD sync 시 의도치 않은 충돌 가능성이 있었다.

**근본 원인**: 이관은 "추가"와 "제거"가 원자적으로 수행되어야 하는 2단계 작업인데, 추가만 수행하고 제거를 별도 작업으로 미뤄 누락된 것이다. 본 런북은 이 교훈을 절차화한다.

---

## 1. 사전 체크리스트

이관 실행 전 아래 항목을 모두 확인한다.

### (a) 이관 대상 리소스 목록화

```bash
# 소스 레포에서 이관할 매니페스트 파일 목록
ls -la /root/AlgoSu/infra/k3s/<이관대상>/

# kustomization.yaml에서 해당 리소스 참조 확인
grep -n '<이관대상>' /root/AlgoSu/infra/k3s/kustomization.yaml
```

이관 대상 파일명과 kustomization.yaml 참조 라인번호를 기록한다.

### (b) aether-gitops 브랜치 상태 확인

```bash
cd /root/aether-gitops
git fetch origin
git status
git log @{upstream}..HEAD --oneline
```

- 미푸시 커밋이 없어야 한다
- 작업 브랜치가 main/master와 동기화되어 있어야 한다

### (c) ArgoCD Application 매핑 확인

```bash
# 현재 ArgoCD Application이 어느 레포/경로를 참조하는지 확인
kubectl get app algosu -n argocd -o jsonpath='{.spec.source.repoURL} {.spec.source.path}{"\n"}'
```

이관 후 ArgoCD가 aether-gitops의 올바른 경로에서 매니페스트를 읽는지 확인해야 한다.

### (d) kubectl 기준선 — 현재 리소스 상태 스냅샷

```bash
# 이관 대상 리소스가 현재 정상 동작 중인지 확인
kubectl get <resource-type> <resource-name> -n algosu -o yaml > /tmp/baseline-<resource>.yaml
```

이관 전후 비교를 위한 기준선이다.

---

## 2. 실행 순서

> 원칙: **aether-gitops 추가 → 검증 → 소스 레포 제거**. 추가와 제거 사이에 리소스 부재 구간이 없어야 한다.

### 2.1 aether-gitops에 매니페스트 추가

```bash
cd /root/aether-gitops

# 소스 레포에서 매니페스트 복사
cp /root/AlgoSu/infra/k3s/<이관대상>/*.yaml ./<대상경로>/

# kustomization.yaml에 리소스 등록 (해당 시)
# vi kustomization.yaml → resources 섹션에 추가

git add .
git commit -m "feat: <이관대상> 매니페스트 이관 (AlgoSu → aether-gitops)"
git push origin main
```

### 2.2 ArgoCD sync 확인

```bash
# ArgoCD가 새 경로에서 매니페스트를 인식하는지 확인
kubectl annotate app algosu -n argocd argocd.argoproj.io/refresh=hard --overwrite
sleep 10
kubectl get app algosu -n argocd -o jsonpath='{.status.sync.status} / {.status.health.status}{"\n"}'
# 기대: "Synced / Healthy"
```

**Synced가 아니면 STOP** — 2.3으로 진행하지 않는다.

### 2.3 소스 레포에서 참조 제거 (동일 커밋 단위)

⚠️ **이 단계가 핵심**: 매니페스트 파일 삭제와 kustomization.yaml 참조 제거를 **반드시 동일 커밋**으로 처리한다.

```bash
cd /root/AlgoSu

# kustomization.yaml에서 참조 제거
# vi infra/k3s/kustomization.yaml → 해당 라인 삭제

# 매니페스트 파일 삭제
rm infra/k3s/<이관대상>/*.yaml

# 동일 커밋으로 처리
git add infra/k3s/kustomization.yaml infra/k3s/<이관대상>/
git commit -m "chore(infra): <이관대상> 매니페스트 aether-gitops 이관 완료 — 소스 참조 제거"
git push origin main
```

### 2.4 리소스 존재 확인

```bash
kubectl get <resource-type> <resource-name> -n algosu
# 기대: 리소스 정상 존재 (aether-gitops 경유 관리)
```

---

## 3. 검증 (3-point)

### 3.1 ArgoCD healthy

```bash
kubectl get app algosu -n argocd -o jsonpath='{.status.sync.status} / {.status.health.status}{"\n"}'
# 기대: "Synced / Healthy"

# repo-server 에러 없는지 확인
kubectl logs -n argocd deployment/argocd-repo-server --tail=50 \
  | grep -iE 'error|fail' || echo "  (clean)"
```

### 3.2 kubectl 리소스 존재

```bash
# 이관 대상 리소스가 여전히 존재하고 정상인지 확인
kubectl get <resource-type> <resource-name> -n algosu -o yaml | diff /tmp/baseline-<resource>.yaml - || echo "diff found (spec 변경 없으면 정상)"
```

### 3.3 고아 참조 없음

```bash
# 소스 레포 kustomization.yaml에 이관 대상 참조가 남아있지 않은지 확인
grep -n '<이관대상>' /root/AlgoSu/infra/k3s/kustomization.yaml
# 기대: 빈 결과

# aether-gitops에 매니페스트가 정상 존재하는지 확인
ls -la /root/aether-gitops/<대상경로>/
```

3개 모두 통과하면 이관 완료.

---

## 4. 롤백

| 실패 지점 | 증상 | 조치 |
|---|---|---|
| 2.2 ArgoCD sync 실패 | aether-gitops 매니페스트 인식 불가 | aether-gitops 커밋 revert → push. 소스 레포는 미변경 상태이므로 영향 없음 |
| 2.3 소스 참조 제거 후 리소스 소멸 | kubectl get → NotFound | 소스 레포 `git revert HEAD` → push. 소스 레포 매니페스트가 복원되어 ArgoCD가 재생성. aether-gitops 매니페스트는 유지 (이중 참조 허용) → 안정화 후 재시도 |
| 3.1 ArgoCD unhealthy | OutOfSync / Degraded | `kubectl annotate app algosu -n argocd argocd.argoproj.io/refresh=hard --overwrite` 재시도. 지속 시 repo-server 로그 확인 |

**원칙**: 롤백은 소스 레포 참조 복원이 최우선. 이중 참조(소스 + aether-gitops)는 일시적으로 허용하며, 안정화 후 재이관을 시도한다.

---

## 5. 사후 조치

- [ ] Sprint ADR에 이관 결과 기록 (대상 리소스, 변경 커밋, 검증 결과)
- [ ] `/stop` 체크리스트에서 aether-gitops 미푸시 커밋 검사 통과 확인
- [ ] 소스 레포 `infra/k3s/` 잔여 파일 정리 — 이관 완료된 디렉토리가 빈 상태인지 확인
- [ ] `grep -rn '<이관대상>' /root/AlgoSu/` 전수 검색으로 다른 참조(문서, 스크립트 등) 갱신

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `/root/AlgoSu/infra/k3s/kustomization.yaml` | 소스 레포 매니페스트 참조 (이관 시 제거 대상) |
| `/root/aether-gitops/` | GitOps 레포 (이관 목적지) |
| `kubectl get app algosu -n argocd` | ArgoCD Application 상태 |
| `docs/adr/sprints/sprint-73.md` | G4 (cloudflared 고아 매니페스트 교훈) |
