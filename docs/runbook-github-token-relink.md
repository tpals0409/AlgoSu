# GitHub Token 재연동 런북

> 대상: `GITHUB_TOKEN_ENCRYPTION_KEY` 도입 이전 GitHub 연동 사용자
> 작성일: 2026-04-07 (Sprint 53)

---

## 배경

Sprint 50에서 `GITHUB_TOKEN_ENCRYPTION_KEY`를 도입하여 GitHub OAuth 토큰을 AES-256-GCM으로 암호화 저장하도록 변경했다.

**문제**: 키 도입 이전에 GitHub 연동한 사용자의 `github_token` 컬럼에는 **평문 토큰** 또는 **이전 키로 암호화된 토큰**이 저장되어 있다. `github-worker`가 이 토큰을 복호화하려 하면 `Invalid encrypted token format` 또는 GCM 인증 태그 불일치로 실패한다.

**영향**:
- 해당 사용자의 코드 제출 시 GitHub Push 단계에서 실패
- `github-worker`가 `TOKEN_INVALID`로 분류 → 프론트엔드에 "GitHub 재연동이 필요합니다" 메시지 표시
- 사용자가 프로필 페이지에서 재연동하면 새 키로 암호화된 토큰이 저장되어 해결됨

---

## 현재 동작 분석 (자동 감지 경로)

### 1. github-worker 복호화 실패 처리

`services/github-worker/src/worker.ts` (L316-329):

```
토큰 복호화 시도 → 실패 시:
  1. GitHub App Installation Token fallback 시도
  2. App 토큰도 실패 시:
     → statusReporter.reportTokenInvalid(submissionId)
     → publishStatusChange(submissionId, 'github_token_invalid')
     → 프론트엔드 SSE로 실시간 전달
```

- 복호화 실패는 `catch` 블록에서 처리되며, 에러를 throw하지 않고 App 토큰 fallback으로 진행
- App이 해당 레포에 설치되어 있으면 push는 성공 (App 토큰 경로)
- App 미설치 시 `TOKEN_INVALID` 상태로 보고

### 2. 프론트엔드 재연동 안내

- **제출 상태 페이지** (`frontend/src/app/submissions/[id]/status/page.tsx`): `github_token_invalid` 상태 시 "GitHub 재연동" 버튼 표시
- **프로필 페이지** (`frontend/src/app/profile/page.tsx`): GitHub 연동 섹션에 "재연동" 버튼 상시 표시
- **SSE 매핑** (`frontend/src/hooks/useSubmissionSSE.ts`): `github_token_invalid` → Step 2 실패 + "GitHub 재연동이 필요합니다" 메시지

### 3. 재연동 API 경로

```
POST /auth/github/relink
  → OAuthService.getGitHubAuthUrl(userId)
  → GitHub OAuth 화면 리다이렉트
  → 콜백에서 OAuthService.linkGitHub(userId, code)
  → encryptToken(accessToken, GITHUB_TOKEN_ENCRYPTION_KEY)
  → Identity Service DB 저장
```

---

## 영향받는 사용자 조회

### SQL: 무효 토큰 보유 사용자 목록

```sql
-- identity_db에서 실행
-- 암호화된 토큰은 iv:ciphertext:tag 형식 (hex, 콜론 2개 구분)
-- 평문 토큰은 'gho_' 또는 'ghp_' 접두사로 시작

SELECT id, email, github_username, github_connected,
       CASE
         WHEN github_token LIKE 'gho_%' THEN 'plaintext'
         WHEN github_token LIKE 'ghp_%' THEN 'plaintext'
         WHEN github_token IS NULL THEN 'no_token'
         WHEN github_token ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$' THEN 'encrypted'
         ELSE 'unknown_format'
       END AS token_status
FROM users
WHERE github_connected = true
  AND deleted_at IS NULL
ORDER BY updated_at DESC;
```

### SQL: 평문 토큰만 조회

```sql
SELECT id, email, github_username
FROM users
WHERE github_connected = true
  AND deleted_at IS NULL
  AND (github_token LIKE 'gho_%' OR github_token LIKE 'ghp_%');
```

---

## 해결 방법

### 방법 1: 사용자 자발적 재연동 (권장)

이미 구현된 UI 흐름을 활용한다:

1. 사용자가 코드 제출 → GitHub Push 실패 → 제출 상태 페이지에서 "GitHub 재연동" 버튼 클릭
2. 또는 프로필 페이지 (`/profile`) → GitHub 섹션 → "재연동" 버튼 클릭
3. GitHub OAuth 인증 완료 → 새 토큰이 현재 `GITHUB_TOKEN_ENCRYPTION_KEY`로 암호화 저장

**장점**: 안전하고 자연스러운 흐름, 추가 개발 불필요
**단점**: 사용자가 직접 행동해야 함, 인지하지 못하면 계속 실패

### 방법 2: 무효 토큰 일괄 초기화 + 재연동 유도

DB에서 평문 토큰을 NULL로 초기화하여, 다음 Push 시 GitHub App fallback을 우선 사용하게 하고, 사용자에게 재연동을 안내한다.

```sql
-- 주의: 반드시 백업 후 실행
-- 평문 토큰 NULL 처리 (github_connected는 유지)
UPDATE users
SET github_token = NULL,
    updated_at = NOW()
WHERE github_connected = true
  AND deleted_at IS NULL
  AND (github_token LIKE 'gho_%' OR github_token LIKE 'ghp_%');
```

이후 GitHub App이 설치된 레포는 App 토큰으로 push가 계속 가능하다. App 미설치 레포 사용자만 재연동이 필요하다.

### 방법 3: 마이그레이션 스크립트로 재암호화 (비권장)

평문 토큰을 읽어서 새 키로 암호화하는 일회성 스크립트를 실행한다.

**비권장 사유**:
- 평문 토큰이 이미 GitHub에서 만료/폐기되었을 가능성 높음 (OAuth 토큰 수명)
- 스크립트가 DB에 직접 접근하여 암호화해야 하므로 키 노출 리스크 있음
- 재연동이 더 안전하고 최신 토큰을 보장함

---

## 운영 절차

### 사전 확인

```bash
# 영향받는 사용자 수 확인
kubectl exec -n algosu pod/postgres-XXXXX -- psql -U algosu_admin -d identity_db -c "
  SELECT
    COUNT(*) FILTER (WHERE github_token LIKE 'gho_%' OR github_token LIKE 'ghp_%') AS plaintext_count,
    COUNT(*) FILTER (WHERE github_token ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$') AS encrypted_count,
    COUNT(*) FILTER (WHERE github_token IS NULL AND github_connected = true) AS no_token_count
  FROM users
  WHERE github_connected = true AND deleted_at IS NULL;
"
```

### 실행 (방법 2 선택 시)

```bash
# 1. 백업
kubectl exec -n algosu pod/postgres-XXXXX -- pg_dump -U algosu_admin -d identity_db -t users > /tmp/users_backup_$(date +%Y%m%d).sql

# 2. 평문 토큰 NULL 처리
kubectl exec -n algosu pod/postgres-XXXXX -- psql -U algosu_admin -d identity_db -c "
  UPDATE users
  SET github_token = NULL, updated_at = NOW()
  WHERE github_connected = true
    AND deleted_at IS NULL
    AND (github_token LIKE 'gho_%' OR github_token LIKE 'ghp_%');
"

# 3. 결과 확인
kubectl exec -n algosu pod/postgres-XXXXX -- psql -U algosu_admin -d identity_db -c "
  SELECT COUNT(*) AS remaining_plaintext
  FROM users
  WHERE github_connected = true
    AND (github_token LIKE 'gho_%' OR github_token LIKE 'ghp_%');
"
```

### 사후 모니터링

- `github-worker` 로그에서 `GHW_BIZ_005` (복호화 실패 fallback) 발생 빈도 확인
- `github_token_invalid` SSE 이벤트 발생 빈도 확인
- 프론트엔드에서 재연동 완료한 사용자 수 추적 (Identity DB `updated_at` 변경 확인)

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `services/gateway/src/auth/oauth/token-crypto.util.ts` | AES-256-GCM 암복호화 유틸 |
| `services/gateway/src/auth/oauth/oauth.service.ts` | GitHub 연동/재연동 로직, 토큰 암호화 저장 |
| `services/github-worker/src/token-manager.ts` | 토큰 복호화 + App 토큰 관리 |
| `services/github-worker/src/worker.ts` | 복호화 실패 감지 및 TOKEN_INVALID 처리 (L316-329) |
| `services/github-worker/src/status-reporter.ts` | TOKEN_INVALID 상태 보고 |
| `frontend/src/hooks/useSubmissionSSE.ts` | github_token_invalid SSE 매핑 |
| `frontend/src/app/submissions/[id]/status/page.tsx` | 재연동 버튼 UI |
| `frontend/src/app/profile/page.tsx` | 프로필 재연동 버튼 |
| `services/identity/src/user/user.entity.ts` | users 테이블 github_token 컬럼 |
