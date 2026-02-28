# Sealed Secrets 운영 가이드

## 구조 설명

이 폴더에는 kubeseal로 암호화된 SealedSecret manifest만 커밋합니다.
복호화된 원본 Secret manifest는 절대 커밋하지 않습니다 (.gitignore 적용).

## 사용법

### 1. kubeseal 설치 (로컬)
```bash
brew install kubeseal
```

### 2. 클러스터에 Sealed Secrets 컨트롤러 설치
```bash
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.26.2/controller.yaml
```

### 3. 원본 Secret 생성 (커밋 금지 — 로컬에서만 사용)
```bash
kubectl create secret generic postgres-secret \
  --from-literal=root-user=algosu_root \
  --from-literal=root-password=STRONG_PASSWORD \
  --namespace algosu \
  --dry-run=client -o yaml > /tmp/postgres-secret-plain.yaml
```

### 4. kubeseal로 암호화 후 커밋
```bash
kubeseal --format yaml < /tmp/postgres-secret-plain.yaml > postgres-secret.yaml
rm /tmp/postgres-secret-plain.yaml  # 원본 즉시 삭제
```

### 5. 암호화된 SealedSecret 적용
```bash
kubectl apply -f postgres-secret.yaml
```

## 관리 대상 시크릿 목록

| 파일명 | 포함 항목 |
|--------|-----------|
| postgres-secret.yaml | root-user, root-password |
| redis-secret.yaml | password |
| rabbitmq-secret.yaml | user, password |
| internal-api-keys.yaml | 서비스별 X-Internal-Key (서비스 간 공유 금지) |
| jwt-secret.yaml | JWT_SECRET |
| github-app-secret.yaml | GITHUB_APP_PRIVATE_KEY |
| gemini-api-secret.yaml | GEMINI_API_KEY |
