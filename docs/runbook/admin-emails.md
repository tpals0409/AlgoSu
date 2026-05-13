# ADMIN_EMAILS 갱신 런북

> 대상: `services/gateway` — `ADMIN_EMAILS` 환경변수 (관리자 이메일 목록)
> 트리거: 관리자 추가/제거 시, `/admin/*` 접근 권한 변경 필요 시

---

## 사전 준비

- [ ] `kubeseal` CLI 설치 (`brew install kubeseal`)
- [ ] k3s 클러스터 접근 가능 (`kubectl get pods -n algosu`)
- [ ] aether-gitops 레포 clone (`algosu/base/sealed-secrets/`)
- [ ] 갱신할 이메일 주소 목록 확정

---

## 1. 현재 값 확인

```bash
# aether-gitops 레포에서 현재 sealed manifest 확인
cat algosu/base/sealed-secrets/sealed-gateway-secrets.yaml | grep ADMIN_EMAILS
```

> 복호화된 값은 클러스터에서만 확인 가능:
> `kubectl get secret gateway-secrets -n algosu -o jsonpath='{.data.ADMIN_EMAILS}' | base64 -d`

## 2. 원본 Secret 생성 (로컬 임시)

```bash
kubectl create secret generic gateway-secrets \
  --from-literal=ADMIN_EMAILS='user1@example.com,user2@example.com' \
  --namespace algosu \
  --dry-run=client -o yaml > /tmp/gateway-secrets-plain.yaml
```

> 쉼표 구분자로 복수 이메일 나열. 공백 없이.

## 3. kubeseal 암호화

```bash
kubeseal --format yaml \
  --controller-namespace kube-system \
  < /tmp/gateway-secrets-plain.yaml \
  > sealed-gateway-secrets.yaml

rm /tmp/gateway-secrets-plain.yaml  # 원본 즉시 삭제
```

## 4. aether-gitops 레포 반영

```bash
cp sealed-gateway-secrets.yaml algosu/base/sealed-secrets/sealed-gateway-secrets.yaml
cd aether-gitops
git add algosu/base/sealed-secrets/sealed-gateway-secrets.yaml
git commit -m "chore(algosu): update ADMIN_EMAILS sealed secret"
git push
```

## 5. ArgoCD 동기화 + 검증

```bash
# ArgoCD 자동 sync 대기 또는 수동 트리거
argocd app sync algosu

# Gateway pod rolling restart (sealed secret 변경 반영)
kubectl rollout restart deployment/gateway -n algosu
kubectl rollout status deployment/gateway -n algosu

# 검증: 새 관리자로 /admin 접근 확인
curl -s -H "Authorization: Bearer <ADMIN_JWT>" https://<domain>/admin/feedbacks | head -1
```

---

## 주의사항

- 이 작업은 **aether-gitops 레포에서 수행**합니다. AlgoSu 본 레포의 `infra/sealed-secrets/`는 참조용 템플릿만 유지합니다.
- kubeseal은 클러스터의 sealed-secrets 컨트롤러 인증서로 암호화하므로, **대상 클러스터에 접근 가능한 환경에서 실행**해야 합니다.
- 로컬 k3d 환경에서는 production 클러스터 인증서 부재로 작업 불가 → production 클러스터 접근 가능 환경 필요.
