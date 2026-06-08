<!--
@file docs/runbook/prod-readonly-kubeconfig.md
@domain infra
@layer runbook
@related docs/adr/ADR-028-dev-cluster-separation.md, docs/runbook/monitoring-system-audit.md
-->

# 운영 read-only kubeconfig 구축 런북 (ADR-028 첫 구현, Sprint 233)

> **목적**: cluster-admin kubeconfig 복사를 금지하고(사용자 결정), **read-only ServiceAccount(`prod-diag-readonly`)** 의 제한 토큰으로 만든 kubeconfig로만 운영 진단(로그/Pod 상태/exec)을 허용한다. ADR-028 "운영 kubeconfig는 read-only로 제한(get/describe/logs/exec 허용, patch/apply/edit/delete 차단)"의 첫 구현.
>
> **실행 위치**: 모든 클러스터 작업은 **서버측**(OCI 노드 SSH 또는 aether-gitops). 이 repo는 매니페스트·절차만 제공한다. 운영 변경은 **aether-gitops PR**로만(ADR-027/028, 직접 kubectl 변경 금지).

---

## §1 권한 경계 (의도)

ADR-028 read-only 프로파일 정렬:
- ✅ **허용**: pods/services/endpoints/events/nodes/namespaces/deployments 등 `get`·`list`·`watch` + `pods/log`(get) + `pods/exec`(create — Loki 내부 API `wget localhost:3100` 진단용, ADR-028 "exec 허용")
- ❌ **차단**: `secrets` 일체(평문 노출 방지) · 모든 워크로드 `create`/`update`/`patch`/`delete` · `pods/portforward`(exec+wget로 대체 가능, 스코프 최소화)

## §2 매니페스트 (aether-gitops에 적용)

> aether-gitops의 base(예: `algosu/base/rbac/prod-diag-readonly.yaml`)에 추가하고 kustomization에 등록 → PR → ArgoCD sync.
>
> **권한 스코프 분리 (최소 권한, Critic R1 P1)**: 네임스페이스 한정 권한(pods/로그/**exec**/configmaps 등)은 **`algosu` Role + RoleBinding**으로 묶어 다른 네임스페이스(예: kube-system)에서 exec/logs가 불가하게 한다. 진짜 클러스터 스코프 읽기(nodes/namespaces/persistentvolumes)만 **ClusterRole + ClusterRoleBinding**(읽기 전용)으로 부여한다.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prod-diag-readonly
  namespace: algosu
  labels:
    app.kubernetes.io/part-of: algosu
    component: diagnostics
---
# (1) 네임스페이스 한정 권한 — algosu 안에서만 (Role + RoleBinding)
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: prod-diag-readonly
  namespace: algosu
  labels:
    app.kubernetes.io/part-of: algosu
    component: diagnostics
rules:
  # 코어 네임스페이스 리소스 조회 (secrets 제외)
  - apiGroups: [""]
    resources: ["pods", "services", "endpoints", "events", "configmaps", "persistentvolumeclaims"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
  # exec (ADR-028 'exec 허용' — Loki 내부 API 진단용. create 동사는 exec 서브리소스
  # 호출 방식이며 워크로드 변경 권한이 아님). algosu 네임스페이스로 한정됨.
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "daemonsets", "replicasets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["networkpolicies", "ingresses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: prod-diag-readonly
  namespace: algosu
  labels:
    app.kubernetes.io/part-of: algosu
    component: diagnostics
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: prod-diag-readonly
subjects:
  - kind: ServiceAccount
    name: prod-diag-readonly
    namespace: algosu
---
# (2) 클러스터 스코프 읽기 전용 — nodes/namespaces/PV (ClusterRole + ClusterRoleBinding)
#     네임스페이스 없는 리소스라 cluster 범위 불가피하나 read-only(get/list/watch)뿐.
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prod-diag-readonly-cluster
  labels:
    app.kubernetes.io/part-of: algosu
    component: diagnostics
rules:
  - apiGroups: [""]
    resources: ["nodes", "namespaces", "persistentvolumes"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["nodes"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prod-diag-readonly-cluster
  labels:
    app.kubernetes.io/part-of: algosu
    component: diagnostics
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prod-diag-readonly-cluster
subjects:
  - kind: ServiceAccount
    name: prod-diag-readonly
    namespace: algosu
```

## §3 토큰 발급 + kubeconfig 조립 (서버, k8s 1.24+)

> k3s v1.34는 1.24+라 `kubectl create token`(bound, 단기) 사용. **상비 Secret 토큰(무기한) 미사용** — 상비 크리덴셜 회피.

```bash
# 서버(SA 적용된 클러스터)에서:
SA=prod-diag-readonly NS=algosu
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
CA=$(kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
TOKEN=$(kubectl create token "$SA" -n "$NS" --duration=8h)   # 단기(8h), 필요 시 재발급

cat > prod-diag.kubeconfig <<EOF
apiVersion: v1
kind: Config
clusters:
- name: algosu-prod
  cluster:
    server: ${SERVER}
    certificate-authority-data: ${CA}
contexts:
- name: prod-diag
  context: { cluster: algosu-prod, user: prod-diag-readonly, namespace: ${NS} }
current-context: prod-diag
users:
- name: prod-diag-readonly
  user: { token: ${TOKEN} }
EOF
chmod 600 prod-diag.kubeconfig
KUBECONFIG=./prod-diag.kubeconfig kubectl auth can-i --list   # 권한 경계 확인
```

## §4 노트북에서 사용 (SSH 터널 권장)

공인 IP/6443 노출 회피 — k3s 기본 인증서 SAN에 `127.0.0.1`이 포함되므로 터널이 안전·간편:
```bash
# 1) 노트북: kubeconfig의 server를 https://127.0.0.1:6443 으로 두고 복사 (서버에서 scp)
# 2) 터널 열기 (유지)
ssh -L 6443:127.0.0.1:6443 <user>@<OCI_HOST>
# 3) 다른 터미널
export KUBECONFIG=~/.kube/prod-diag.kubeconfig
kubectl get pods -n algosu                # read-only 동작 확인
kubectl auth can-i delete pods -n algosu  # → no (차단 확인)
```

## §5 보안 · 로테이션

- **토큰 깃 커밋 절대 금지** — kubeconfig(토큰 포함)는 로컬 `~/.kube/`에만. `.gitignore` 확인.
- **단기 토큰** — `--duration=8h` 만료 시 §3 재발급. 무기한 Secret 토큰 사용 금지.
- 유출 의심 시: SA 토큰은 발급 무효화가 까다로우므로, 최악의 경우 `prod-diag-readonly` SA를 재생성(이름 변경)하거나 ClusterRoleBinding 제거로 차단.
- 권한 변경은 §2 매니페스트 수정 → aether-gitops PR로만.

## §6 (B+) loki prod 하드닝 갭 검증 — 서버 실행 프롬프트

> Sprint 232 발견(runbook `monitoring-system-audit.md` §4-D1): AlgoSu 미러 loki엔 probe/securityContext가 있으나 라이브 덤프엔 부재. 라이브 실재 확인 후 갭이면 aether-gitops에 추가.

서버에서:
```bash
KC="sudo kubectl"   # 또는 sudo k3s kubectl
# loki Deployment에 probe/securityContext 실재 여부
$KC -n algosu get deploy loki -o jsonpath='{.spec.template.spec.containers[0].livenessProbe}{"\n"}{.spec.template.spec.containers[0].readinessProbe}{"\n"}{.spec.template.spec.securityContext}{"\n"}{.spec.template.spec.containers[0].securityContext}{"\n"}'
$KC -n algosu get cm loki-config -o jsonpath='{.data}' | grep -o 'allow_structured_metadata: [a-z]*'
```
- probe/securityContext가 **비어 있으면** → prod 하드닝 갭 확정 → aether-gitops loki Deployment에 livenessProbe/readinessProbe(`/ready` 3100) + securityContext(runAsNonRoot:10001·drop ALL·readOnlyRootFilesystem) 추가 PR.
- 있으면 → Sprint 232 덤프 누락이었음(무시).
