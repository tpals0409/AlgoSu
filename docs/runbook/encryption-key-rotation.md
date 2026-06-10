<!--
@file docs/runbook/encryption-key-rotation.md
@domain security
@layer runbook
@related services/gateway/src/auth/oauth/token-crypto.util.ts, services/github-worker/src/worker.ts, services/identity/src/user/token-encryption.service.ts, services/identity/src/user/user.service.ts, infra/sealed-secrets/sealed-secrets-template.yaml, docs/runbook/key-rotation.md, docs/adr/ADR-030-security-improvement-backlog.md
-->

# GITHUB_TOKEN_ENCRYPTION_KEY 로테이션 런북

> 대상: `gateway-secrets` + `github-worker-secrets` + `identity-service-secrets` — `GITHUB_TOKEN_ENCRYPTION_KEY` (32바이트 hex, AES-256-GCM)
> 권장 주기: **연 1회 이상**, 유출 의심 시 즉시 수행

---

## §0 배경 및 영향도

### 키 역할

`GITHUB_TOKEN_ENCRYPTION_KEY`는 GitHub OAuth 토큰을 AES-256-GCM으로 암복호화하는 대칭 키다.

- **암호화 위치**: `services/gateway/src/auth/oauth/token-crypto.util.ts` — 사용자가 GitHub 연동 시 OAuth 토큰을 암호화하여 DB에 저장
- **복호화 위치**: `services/github-worker/src/token-manager.ts` — 제출 처리 시 복호화하여 사용자 토큰으로 push
- 암호문 형식: `iv(hex):ciphertext(hex):tag(hex)`
- 키 형식: 32바이트 hex (64자), 예: `a1b2c3d4...` (64자 hex 문자열)

### SealedSecret 3곳 동시 관리

이 키는 **세 서비스 Secret에 동일한 값**으로 존재한다:

| SealedSecret 이름 | 키 이름 | 역할 |
|-------------------|---------|------|
| `gateway-secrets` | `GITHUB_TOKEN_ENCRYPTION_KEY` | 암호화 (`infra/sealed-secrets/sealed-secrets-template.yaml:58`) |
| `github-worker-secrets` | `GITHUB_TOKEN_ENCRYPTION_KEY` | 복호화 (`infra/sealed-secrets/sealed-secrets-template.yaml:167`) |
| `identity-service-secrets` | `GITHUB_TOKEN_ENCRYPTION_KEY` | 암호화 — `token-encryption.service.ts:28-34` 부팅 시 키 필수 검증, `user.service.ts:136` GitHub 토큰 암호화 |

> ⚠️ 세 Secret의 키 값이 불일치하면 암·복호화 실패가 발생한다. 반드시 **단일 aether-gitops 커밋**으로 동시 교체해야 한다.

### ⚠️ 듀얼 키 미지원 — 로테이션 영향

현재 구현은 단일 키 복호화만 지원한다(구/신 키 순차 시도 없음). 따라서 **키를 교체하면 기존 키로 암호화된 사용자 토큰은 전부 복호화 실패**한다.

**서비스 무중단 보장 경로** (`worker.ts:384-398`):

```
복호화 실패
  → GitHub App Installation Token fallback 자동 전환
    (태그: GITHUB_APP_FALLBACK)
  → Push 정상 동작 (서비스 무중단)
```

다만 **사용자 토큰 경로는 재연동까지 비활성** 상태가 된다. 사용자가 다음 GitHub 재연동 시 신 키로 재암호화된다. 재암호화 일괄 마이그레이션은 현재 설계상 불필요하다.

> Future enhancement: 구/신 키 순차 시도 로직 추가로 재연동 없이 점진 전환 가능 — ADR-030 참조.

### 로테이션 트리거 구분

| 트리거 | 대응 |
|--------|------|
| 정기 로테이션 (연 1회) | 아래 §1~§6 순서대로 진행 |
| 키 유출 의심 (로그/코드 노출 등) | §1~§6 즉시 수행 + §5 긴급 모드 |

---

## §1 사전 준비

- [ ] `kubeseal` CLI 설치 (`brew install kubeseal` / `apt install kubeseal`)
- [ ] k3s 클러스터 접근 가능 (`kubectl get pods -n algosu`)
- [ ] aether-gitops 레포 clone 및 최신 상태 (`git pull`)
- [ ] 현재 3개 Secret의 전체 키-값 파악 (누락 방지 — `sealed-secrets-template.yaml` 전체 키 목록 참조)

```bash
# 현재 3개 Secret 존재 확인
kubectl get secret gateway-secrets -n algosu
kubectl get secret github-worker-secrets -n algosu
kubectl get secret identity-service-secrets -n algosu
```

---

## §2 새 키 생성

```bash
# 32바이트 hex 키 생성 (64자)
NEW_KEY=$(openssl rand -hex 32)

# 형식 검증 (64자 hex 확인)
echo ${#NEW_KEY}        # → 64
echo "$NEW_KEY" | grep -Eq '^[0-9a-f]{64}$' && echo "OK" || echo "FAIL"
```

> ⚠️ 생성된 키(`$NEW_KEY`)는 평문 — 이 시점부터 로그 출력·파일 저장·화면 공유 금지. 이 터미널 세션 내에서만 사용하고 §6에서 제거한다.

---

## §3 3-Secret 동시 교체 (단일 aether-gitops 커밋)

> 기존 secret을 **교체**하는 작업이므로, Sprint 236의 신규 secret 2-commit ordering(추가→검증→전환)과는 다른 케이스다. 교체는 세 Secret을 단일 커밋으로 동시 반영하여 **불일치 윈도우를 없애는 것**이 원칙이다.

### 3-1. gateway-secrets SealedSecret 재생성

> ⚠️ 전체 키를 모두 포함해야 한다. **누락 시 기존 키가 사라진다** (`key-rotation.md §3` 동일 경고).

```bash
kubectl create secret generic gateway-secrets \
  --namespace=algosu \
  --from-literal=JWT_SECRET=<현재 값> \
  --from-literal=JWT_EXPIRES_IN=<현재 값> \
  --from-literal=REDIS_URL=<현재 값> \
  --from-literal=INTERNAL_API_KEY=<현재 값> \
  --from-literal=INTERNAL_KEY_IDENTITY=<현재 값> \
  --from-literal=INTERNAL_KEY_PROBLEM=<현재 값> \
  --from-literal=INTERNAL_KEY_SUBMISSION=<현재 값> \
  --from-literal=INTERNAL_KEY_AI_ANALYSIS=<현재 값> \
  --from-literal=IDENTITY_SERVICE_URL=<현재 값> \
  --from-literal=PROBLEM_SERVICE_URL=<현재 값> \
  --from-literal=SUBMISSION_SERVICE_URL=<현재 값> \
  --from-literal=AI_ANALYSIS_SERVICE_URL=<현재 값> \
  --from-literal=FRONTEND_URL=<현재 값> \
  --from-literal=ALLOWED_ORIGINS=<현재 값> \
  --from-literal=GOOGLE_CLIENT_ID=<현재 값> \
  --from-literal=GOOGLE_CLIENT_SECRET=<현재 값> \
  --from-literal=GITHUB_CLIENT_ID=<현재 값> \
  --from-literal=GITHUB_CLIENT_SECRET=<현재 값> \
  --from-literal=KAKAO_CLIENT_ID=<현재 값> \
  --from-literal=KAKAO_CLIENT_SECRET=<현재 값> \
  --from-literal=NAVER_CLIENT_ID=<현재 값> \
  --from-literal=NAVER_CLIENT_SECRET=<현재 값> \
  --from-literal=OAUTH_CALLBACK_URL=<현재 값> \
  --from-literal=GITHUB_TOKEN_ENCRYPTION_KEY="$NEW_KEY" \
  --from-literal=ADMIN_EMAILS=<현재 값> \
  --from-literal=MINIO_ENDPOINT=<현재 값> \
  --from-literal=MINIO_PORT=<현재 값> \
  --from-literal=MINIO_ACCESS_KEY=<현재 값> \
  --from-literal=MINIO_SECRET_KEY=<현재 값> \
  --from-literal=MINIO_USE_SSL=<현재 값> \
  --from-literal=MINIO_PUBLIC_URL=<현재 값> \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace kube-system -o yaml \
  > sealed-gateway-secrets-new.yaml
```

### 3-2. github-worker-secrets SealedSecret 재생성

```bash
kubectl create secret generic github-worker-secrets \
  --namespace=algosu \
  --from-literal=RABBITMQ_URL=<현재 값> \
  --from-literal=REDIS_URL=<현재 값> \
  --from-literal=GITHUB_APP_ID=<현재 값> \
  --from-literal=GITHUB_APP_PRIVATE_KEY_BASE64=<현재 값> \
  --from-literal=GITHUB_APP_INSTALLATION_ID=<현재 값> \
  --from-literal=INTERNAL_KEY_GATEWAY=<현재 값> \
  --from-literal=GATEWAY_INTERNAL_URL=<현재 값> \
  --from-literal=SUBMISSION_SERVICE_URL=<현재 값> \
  --from-literal=SUBMISSION_SERVICE_KEY=<현재 값> \
  --from-literal=GITHUB_TOKEN_ENCRYPTION_KEY="$NEW_KEY" \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace kube-system -o yaml \
  > sealed-github-worker-secrets-new.yaml
```

### 3-3. identity-service-secrets SealedSecret 재생성

> ⚠️ 전체 키를 모두 포함해야 한다. **누락 시 기존 키가 사라진다** (`key-rotation.md §3` 동일 경고).
>
> **코드 근거**: `services/identity/src/user/token-encryption.service.ts:28-34` — `GITHUB_TOKEN_ENCRYPTION_KEY` 미설정 시 부팅 throw. identity 서비스가 GitHub OAuth 토큰 암호화를 직접 담당한다(`user.service.ts:136`).

```bash
kubectl create secret generic identity-service-secrets \
  --namespace=algosu \
  --from-literal=DATABASE_HOST=<현재 값> \
  --from-literal=DATABASE_PORT=<현재 값> \
  --from-literal=DATABASE_NAME=<현재 값> \
  --from-literal=DATABASE_USER=<현재 값> \
  --from-literal=DATABASE_PASSWORD=<현재 값> \
  --from-literal=INTERNAL_API_KEY=<현재 값> \
  --from-literal=JWT_SECRET=<현재 값> \
  --from-literal=JWT_EXPIRES_IN=<현재 값> \
  --from-literal=GITHUB_TOKEN_ENCRYPTION_KEY="$NEW_KEY" \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace kube-system -o yaml \
  > sealed-identity-service-secrets-new.yaml
```

### 3-4. 단일 aether-gitops 커밋으로 동시 배포

```bash
cd aether-gitops
cp sealed-gateway-secrets-new.yaml algosu/base/sealed-gateway-secrets.yaml
cp sealed-github-worker-secrets-new.yaml algosu/base/sealed-github-worker-secrets.yaml
cp sealed-identity-service-secrets-new.yaml algosu/base/sealed-identity-service-secrets.yaml
git add algosu/base/sealed-gateway-secrets.yaml \
        algosu/base/sealed-github-worker-secrets.yaml \
        algosu/base/sealed-identity-service-secrets.yaml
git commit -m "chore(security): rotate GITHUB_TOKEN_ENCRYPTION_KEY $(date +%Y-%m-%d)"
git push origin main
```

> 세 파일을 **같은 커밋**에 포함시켜 불일치 윈도우를 없앤다.

### 3-5. ArgoCD sync 및 pod 재시작

> ⚠️ **SealedSecret 갱신은 pod 자동 재시작을 보장하지 않는다.** ArgoCD sync 완료 후 반드시 명시적 rollout restart를 수행해야 신 키가 적용된 pod로 교체된다.

```bash
# ArgoCD 자동 sync (또는 수동)
argocd app sync algosu --force   # 수동 sync 필요 시

# 3서비스 명시적 재시작 (신 키 환경변수 적용)
kubectl rollout restart deployment/gateway -n algosu
kubectl rollout restart deployment/github-worker -n algosu
kubectl rollout restart deployment/identity-service -n algosu

# 3서비스 재시작 완료 대기
kubectl rollout status deployment/gateway -n algosu
kubectl rollout status deployment/github-worker -n algosu
kubectl rollout status deployment/identity-service -n algosu
```

---

## §4 검증 게이트 (4종)

### 게이트 1: 3-Secret sha256 일치 확인 (평문 노출 없이)

```bash
# 세 Secret에서 GITHUB_TOKEN_ENCRYPTION_KEY를 추출하여 sha256 비교
GW_HASH=$(kubectl get secret gateway-secrets -n algosu \
  -o jsonpath='{.data.GITHUB_TOKEN_ENCRYPTION_KEY}' | base64 -d | sha256sum | awk '{print $1}')
WK_HASH=$(kubectl get secret github-worker-secrets -n algosu \
  -o jsonpath='{.data.GITHUB_TOKEN_ENCRYPTION_KEY}' | base64 -d | sha256sum | awk '{print $1}')
ID_HASH=$(kubectl get secret identity-service-secrets -n algosu \
  -o jsonpath='{.data.GITHUB_TOKEN_ENCRYPTION_KEY}' | base64 -d | sha256sum | awk '{print $1}')

echo "gateway-secrets hash:           $GW_HASH"
echo "github-worker-secrets hash:     $WK_HASH"
echo "identity-service-secrets hash:  $ID_HASH"

[ "$GW_HASH" = "$WK_HASH" ] && [ "$GW_HASH" = "$ID_HASH" ] \
  && echo "✅ 3-Secret 일치" || echo "❌ 불일치 — 즉시 §5 롤백"
```

### 게이트 2: 신규 GitHub 연동 positive 검증

```bash
# 프론트엔드에서 GitHub OAuth 재연동 수행
# → 새 토큰이 신 키로 암호화되어 저장됨

# 코드 제출 후 해당 제출의 submissionId(=로그 traceId)를 확보하고 실행.
# 전체 로그가 아닌 테스트 제출의 traceId 스코프로만 판정한다 —
# 같은 시간대 기존 사용자 제출의 GITHUB_APP_FALLBACK(게이트 3의 예상 동작)이 거짓 실패를 내지 않도록.
SUBMISSION_ID="<테스트 제출 submissionId>"

kubectl logs -n algosu -l app=github-worker --since=10m > /tmp/ghw-gate2.log
# 선행 게이트 1: 로그 수집 자체가 실패/비어있으면 판정 불가 — 성공으로 오인 금지
[ -s /tmp/ghw-gate2.log ] || echo "❌ 로그 수집 실패 또는 빈 로그 — kubectl 대상/권한/네임스페이스 확인 후 재시도"

grep "$SUBMISSION_ID" /tmp/ghw-gate2.log > /tmp/ghw-gate2-trace.log
# 선행 게이트 2: 테스트 제출의 처리 증적이 있어야만 판정 — 증적 없음 = 미처리(성공 아님)
[ -s /tmp/ghw-gate2-trace.log ] || echo "❌ 테스트 제출 처리 로그 없음 — 처리 대기 후 재시도 또는 MQ 라우팅 확인"

# 본 판정: 해당 traceId 스코프에 fallback 태그가 없어야 신 키 복호화 성공
if grep -q "GITHUB_APP_FALLBACK" /tmp/ghw-gate2-trace.log; then
  echo "❌ 테스트 제출이 fallback 경로로 처리됨 — 신 키 미적용 의심, §5 롤백 검토"
else
  echo "✅ 신 키 복호화 성공 (처리 증적 있음 + fallback 없음)"
fi
rm -f /tmp/ghw-gate2.log /tmp/ghw-gate2-trace.log
```

> 두 선행 게이트(`❌`) 중 하나라도 출력되면 본 판정은 무효다. 거짓 성공 방지를 위해 반드시 ✅ 한 줄(처리 증적 + fallback 없음)을 확인한 경우에만 게이트 2 통과로 간주한다.

### 게이트 3: 기존 토큰 fallback 동작 확인

키 교체 직후 기존 연동 사용자의 제출이 `GITHUB_APP_FALLBACK` 로그를 남기며 정상 처리되는지 확인한다. 이는 **오류가 아닌 예상 동작**이다.

```bash
kubectl logs -n algosu -l app=github-worker --tail=100 \
  | grep "GITHUB_APP_FALLBACK"
# 출력 예: {"tag":"GITHUB_APP_FALLBACK","traceId":"...","code":"GHW_BIZ_005"}
# → 정상 신호: fallback 경로 동작, push 완료
```

> App 토큰 fallback도 실패하는 경우(`GITHUB_SKIP` + `code: GHW_BIZ_005`) — GitHub App 자체 권한 문제이며 키 로테이션과 무관. `key-rotation.md §5` 확인.

### 게이트 4: 닫힘 증명 (에러율·DLQ 무변동)

```bash
# 에러율 — gateway/github-worker 에러 없는지
kubectl logs -n algosu -l app=gateway --tail=100 | grep -i '"level":"error"'
kubectl logs -n algosu -l app=github-worker --tail=100 | grep -i '"level":"error"'

# DLQ 깊이 — 큐에 메시지 쌓이지 않는지
kubectl exec -n algosu deploy/rabbitmq -- rabbitmqctl list_queues name messages \
  | grep -E "(github_push|ai_analysis)\.dlq"
# 목표: messages = 0
```

---

## §5 롤백

검증 실패 시 즉시 구 키로 복원한다.

```bash
# 구 키를 가진 SealedSecret 파일로 되돌리기 (git revert)
cd aether-gitops
git revert HEAD    # 단일 커밋이므로 revert 1회
git push origin main

# ArgoCD sync
argocd app sync algosu --force

# 3서비스 동시 복원 재시작
kubectl rollout restart deployment/gateway -n algosu
kubectl rollout restart deployment/github-worker -n algosu
kubectl rollout restart deployment/identity-service -n algosu
kubectl rollout status deployment/gateway -n algosu
kubectl rollout status deployment/github-worker -n algosu
kubectl rollout status deployment/identity-service -n algosu
```

> 롤백 후 상태: 신 키로 암호화된 토큰(키 교체 후 재연동한 소수의 사용자)은 다시 복호화 실패 → fallback 전환. gateway/github-worker/identity-service 세 서비스가 모두 구 키로 복원됐음을 sha256 비교(§4 게이트 1)로 재확인한다. 롤백 사유와 함께 §6 로테이션 기록에 남긴다.

---

## §6 사후 조치

```bash
# 평문 키 파일 삭제 (로컬)
rm -f sealed-gateway-secrets-new.yaml sealed-github-worker-secrets-new.yaml sealed-identity-service-secrets-new.yaml

# 터미널 히스토리 확인 및 정리 (NEW_KEY 변수 잔류 방지)
unset NEW_KEY
history -c   # bash. zsh는 세션 종료 시 자동 처리
```

**로테이션 기록** (아래 테이블에 추가):

| 날짜 | 트리거 | 담당 | aether-gitops 커밋 | 검증 | 비고 |
|------|--------|------|-------------------|------|------|
| YYYY-MM-DD | 정기/유출 | - | - | ✅ / ❌ | - |

---

## §7 관련 문서

- GitHub App Private Key 로테이션: `docs/runbook/key-rotation.md`
- GitHub 토큰 재연동 가이드: `docs/runbook/github-token-relink.md` (사용자 안내용)
- SealedSecret 키 목록: `infra/sealed-secrets/sealed-secrets-template.yaml`
- 보안 개선 백로그: `docs/adr/ADR-030-security-improvement-backlog.md` (S-6)
- DLQ 발생 시: `docs/runbook/dlq-redrive.md`
