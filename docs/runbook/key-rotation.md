# GitHub App Private Key 로테이션 런북

> 대상: `services/github-worker` — `GITHUB_APP_PRIVATE_KEY_BASE64` 환경변수
> 권장 주기: **분기 1회** (1/1, 4/1, 7/1, 10/1)

---

## 사전 준비

- [ ] GitHub App 관리자 권한 (Settings → Developer settings → GitHub Apps)
- [ ] `kubeseal` CLI 설치 (`brew install kubeseal` / `apt install kubeseal`)
- [ ] k3s 클러스터 접근 가능 (`kubectl get pods -n algosu`)
- [ ] aether-gitops 레포 clone

---

## 1. 새 키 생성

1. GitHub → Settings → Developer settings → GitHub Apps → **AlgoSu** → General
2. **Private keys** 섹션 → **Generate a private key** 클릭
3. `*.pem` 파일 다운로드 (예: `algosu-app-2026-04-01.pem`)

> 기존 키는 아직 삭제하지 않는다. 새 키 적용 후 검증 완료 시 제거.

## 2. Base64 인코딩

```bash
cat algosu-app-2026-04-01.pem | base64 -w0 > key-base64.txt
```

결과값을 복사해 둔다.

## 3. SealedSecret 재생성

```bash
# 원본 Secret 생성 (dry-run)
kubectl create secret generic github-worker-secrets \
  --namespace=algosu \
  --from-literal=GITHUB_APP_ID=<현재 App ID> \
  --from-literal=GITHUB_APP_PRIVATE_KEY_BASE64="$(cat key-base64.txt)" \
  --from-literal=GITHUB_APP_INSTALLATION_ID=<현재 Installation ID> \
  --from-literal=GITHUB_TOKEN_ENCRYPTION_KEY=<현재 암호화 키> \
  --from-literal=RABBITMQ_URL=<현재 값> \
  --from-literal=REDIS_URL=<현재 값> \
  --from-literal=INTERNAL_KEY_GATEWAY=<현재 값> \
  --from-literal=GATEWAY_INTERNAL_URL=<현재 값> \
  --from-literal=SUBMISSION_SERVICE_URL=<현재 값> \
  --from-literal=SUBMISSION_SERVICE_KEY=<현재 값> \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace kube-system -o json \
  > sealed-github-worker-secrets.yaml
```

> 전체 Secret 키를 모두 포함해야 한다. 누락 시 기존 키가 사라진다.

## 4. GitOps 배포

```bash
cd aether-gitops
cp sealed-github-worker-secrets.yaml algosu/sealed-github-worker-secrets.yaml
git add -A && git commit -m "chore: rotate GitHub App private key $(date +%Y-%m-%d)"
git push origin main
```

ArgoCD가 자동 동기화하여 새 Secret을 반영한다. github-worker Pod가 재시작된다.

## 5. 검증

```bash
# Pod 재시작 확인
kubectl get pods -n algosu -l app=github-worker -w

# 로그에서 토큰 발급 성공 확인
kubectl logs -n algosu -l app=github-worker --tail=50 | grep "TOKEN_REFRESH"

# 테스트 제출로 Push 동작 확인
# → 프론트엔드에서 코드 제출 → GitHub 레포에 커밋 생성 확인
```

## 6. 기존 키 제거

검증 완료 후:

1. GitHub App Settings → Private keys → 이전 키 **Revoke**
2. 로컬의 `*.pem`, `key-base64.txt` 파일 삭제

```bash
rm algosu-app-2026-04-01.pem key-base64.txt
```

---

## 긴급 로테이션 (키 유출 시)

1. GitHub App Settings → 기존 키 **즉시 Revoke**
2. 위 1~5단계 즉시 수행
3. ArgoCD 수동 동기화로 대기 시간 최소화:
   ```bash
   argocd app sync algosu --force
   ```
4. github-worker 로그에서 `TOKEN_REFRESH` 성공 확인
5. Redis 캐시 플러시 (오염된 토큰 제거):
   ```bash
   kubectl exec -n algosu deploy/redis -- redis-cli KEYS "github:app:token:*" | \
     xargs -I{} kubectl exec -n algosu deploy/redis -- redis-cli DEL {}
   ```

---

## 로테이션 일정 (분기별)

| 분기 | 예정일 | 담당 | 상태 |
|------|--------|------|------|
| Q2 2026 | 2026-04-01 | - | 예정 |
| Q3 2026 | 2026-07-01 | - | - |
| Q4 2026 | 2026-10-01 | - | - |
