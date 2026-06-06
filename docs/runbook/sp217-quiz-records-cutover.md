# SP217 퀴즈 기록 컷오버 런북 (identity_db `quiz_records` + 재배포 + 라이브 E2E)

> 대상: Sprint 215~219로 **코드측 완성·검증**된 CS 퀴즈 로그인 기록 연동(`quiz_records`)을 **라이브 반영·검증**한다.
> 작성: Sprint 220 (2026-06-06). 관련 런북: [`db-migration.md`](./db-migration.md) (범용 DB 마이그레이션 절차).
> 실행 주체: **사용자/운영(ops)** — 운영 클러스터 접근이 필요하다. 본 런북은 실행 가능한 정확한 절차를 제공한다.

---

## 0. 핵심 사실 (먼저 이해할 것)

### 0.1 `migration:run`은 재배포가 자동으로 실행한다

`infra/k3s/identity-service.yaml`의 **`db-migrate` initContainer**가 앱 컨테이너 기동 **전**에 마이그레이션을 자동 실행한다:

```yaml
initContainers:
  - name: db-migrate
    image: ghcr.io/OWNER/algosu-identity:main-PLACEHOLDER
    command: ["node", "./node_modules/typeorm/cli.js", "migration:run", "-d", "dist/src/database/data-source.js"]
    envFrom:
      - secretRef:
          name: identity-service-secrets
```

따라서 **별도의 수동 `migration:run` 단계는 필요 없다.** 새 identity 이미지(마이그레이션 파일이 `dist/`에 포함됨)를 롤아웃하면 `db-migrate`가 `identity_db`에 `quiz_records`를 생성한다. 본 런북의 `kubectl exec ... migration:run`은 **검증/폴백 경로**다(§3.3, §5).

> 과거 이월 문구의 "운영측 `migration:run` + 재배포"는 두 개의 수동 단계처럼 읽혔으나, 실제로는 **재배포가 마이그레이션을 포함**한다. SP217은 이 점을 정정한다.

### 0.2 SP217 마이그레이션은 `statement_timeout` 위험이 없다

`services/identity/src/database/migrations/20260602000000-SP217-CreateQuizRecords.ts`:

```sql
CREATE TABLE quiz_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  category            VARCHAR(30)  NOT NULL,
  difficulty          VARCHAR(10)  NOT NULL,
  best_score_percent  INTEGER      NOT NULL,
  played_at           TIMESTAMPTZ  NOT NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_quiz_records_user_category_difficulty
    UNIQUE (user_id, category, difficulty)
);
CREATE INDEX idx_quiz_records_user_id ON quiz_records (user_id);
```

- **신규 빈 테이블**이라 `CREATE TABLE` + 작은 `CREATE INDEX`는 즉시 완료된다.
- 운영 postgres의 `statement_timeout=200`(200ms)을 초과하지 않는다 → **`SET statement_timeout=0` 불필요, `CREATE INDEX CONCURRENTLY` 불필요.**
- (대조: Sprint 196 `problem_db` GIN 인덱스는 대용량 테이블 rewrite라 `statement_timeout=0`이 필요했다. SP217은 해당 없음.)
- `down()` = `DROP TABLE IF EXISTS quiz_records` → **롤백 안전**.

### 0.3 merge ≠ 라이브

이미지 빌드는 main 머지 시 자동(`ghcr.io/tpals0409/algosu-{service}:main-<sha>`)이지만, 롤아웃은 **수동 ops**다(`infra/k3s/*.yaml`의 image는 `main-PLACEHOLDER` 리터럴). 새 기능이 라이브에 뜨려면 본 런북의 재배포가 필요하다. 상세는 메모리 `project-deploy-and-domain.md` 참조.

### 0.4 변경 대상 서비스 3종

| 서비스 | SP217 변경 | 라이브 반영에 필요 |
|---|---|---|
| **identity** | `quiz_records` 엔티티/서비스/컨트롤러 + 마이그레이션 | ✅ 롤아웃(= initContainer 마이그레이션) |
| **gateway** | BFF `GET/POST /api/quiz-records` | ✅ 롤아웃 |
| **frontend** | `/quiz` UI + `api-store.ts`(서버 연동) | ✅ 롤아웃 |

세 서비스를 **identity → gateway → frontend 순**으로 롤아웃한다(스키마 먼저, 그 위에 BFF, 그 위에 UI).

---

## 1. 사전 조건 확인

### 1.1 기능이 main에 머지되어 이미지가 빌드되었는지

SP217(`4c8d3b7`)~219(`d529db6`)는 main에 머지 완료. CI가 세 서비스 이미지를 GHCR에 푸시했는지 확인한다:

```bash
# 최신 main SHA 확인
git fetch origin && git rev-parse --short origin/main

# 해당 SHA 이미지가 GHCR에 있는지(예: identity)
# (ops 환경에서 레지스트리 권한으로 확인 — crane/docker 등)
crane ls ghcr.io/tpals0409/algosu-identity 2>/dev/null | grep "main-<sha>" || \
  echo "이미지 확인은 레지스트리 접근 권한으로 수행"
```

> identity 이미지에 마이그레이션 파일이 포함되었는지는 빌드된 `dist/src/database/migrations/20260602000000-SP217-CreateQuizRecords.js` 존재로 보장된다(소스가 main에 있으므로 빌드에 포함됨).

### 1.2 운영 클러스터 컨텍스트 확인

```bash
kubectl config current-context     # 운영 컨텍스트인지 확인 (로컬 k3d-algosu 아님)
kubectl get pods -n algosu | grep -E 'identity|gateway|frontend|postgres'
```

### 1.3 트래픽이 적은 시간대 권장

스키마 변경 자체는 즉시 완료되나, 롤아웃은 RollingUpdate(`maxUnavailable:0, maxSurge:1`)로 무중단이지만 안전하게 심야 권장.

---

## 2. 백업 (identity_db)

마이그레이션은 비파괴(신규 테이블 생성)지만, 롤아웃 전 스냅샷을 남긴다:

```bash
# postgres Pod 해시 확인 (identity_db는 'postgres' 인스턴스에 위치)
kubectl get pods -n algosu | grep '^postgres-'

# identity_db 전체 백업 (슈퍼유저 algosu_admin)
kubectl exec -n algosu pod/postgres-<hash> -- \
  pg_dump -U algosu_admin -d identity_db \
  > backup_identity_$(date +%Y%m%d_%H%M%S).sql
```

> `quiz_records`는 신규 테이블이므로 백업 없이도 롤백은 `DROP TABLE`로 안전하지만, identity_db 전체 백업은 표준 절차다([`db-migration.md`](./db-migration.md) §사전 준비).

---

## 3. identity 롤아웃 → 마이그레이션 자동 적용

### 3.1 새 이미지로 롤아웃

운영 ops 환경의 매니페스트(aether-gitops 또는 ops 오버레이)에서 identity 이미지 태그를 새 `main-<sha>`로 갱신하고 적용한다. 적용 직후 `db-migrate` initContainer가 먼저 기동되어 `migration:run`을 실행한다.

```bash
# (ops가 image 태그를 갱신하는 방식에 맞춰 수행 — 예시)
kubectl set image deployment/identity-service \
  db-migrate=ghcr.io/tpals0409/algosu-identity:main-<sha> \
  identity-service=ghcr.io/tpals0409/algosu-identity:main-<sha> \
  -n algosu
# 또는 GitOps: ops 매니페스트의 image 태그 커밋 → ArgoCD sync
```

> **주의**: initContainer(`db-migrate`)와 앱 컨테이너(`identity-service`) **둘 다** 같은 이미지 태그여야 한다. 하나만 갱신하면 마이그레이션과 앱 버전이 어긋난다.

### 3.2 initContainer 마이그레이션 성공 확인

```bash
# 새 파드 이름 확인
kubectl get pods -n algosu | grep identity-service

# db-migrate initContainer 로그 — migration:run 출력 확인
kubectl logs -n algosu <identity-pod> -c db-migrate

# 기대 출력(일부): "Migration CreateQuizRecords20260602000000 has been executed successfully."
```

initContainer가 실패하면 앱 컨테이너는 기동되지 않는다(파드가 `Init:Error`/`Init:CrashLoopBackOff`). 이 경우 §5 롤백.

### 3.3 스키마 적용 검증 (psql 직접 확인)

```bash
kubectl exec -n algosu pod/postgres-<hash> -- \
  psql -U algosu_admin -d identity_db -c \
  "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 3;"
# 기대: 'CreateQuizRecords20260602000000' 행 존재

kubectl exec -n algosu pod/postgres-<hash> -- \
  psql -U algosu_admin -d identity_db -c "\d quiz_records"
# 기대: 컬럼 8개 + uq_quiz_records_user_category_difficulty(UNIQUE) + idx_quiz_records_user_id 인덱스
```

### 3.4 identity 헬스 확인

```bash
kubectl get pods -n algosu | grep identity-service   # Running 1/1
kubectl exec -n algosu <identity-pod> -c identity-service -- \
  wget -qO- http://localhost:3004/health/ready || echo "readiness 확인은 클러스터 내부에서"
```

> **폴백 — initContainer 없이 수동 마이그레이션이 필요한 경우** (예: 이미 롤아웃된 구버전 파드에 핫픽스로 스키마만 먼저 넣어야 할 때): 앱 파드에서 직접 실행한다.
> ```bash
> kubectl exec -n algosu <identity-pod> -c identity-service -- \
>   node ./node_modules/typeorm/cli.js migration:run -d dist/src/database/data-source.js
> ```
> 단 SP217 표준 경로는 §3.1 재배포다.

---

## 4. gateway + frontend 롤아웃

identity 스키마/API가 준비된 뒤 BFF와 UI를 롤아웃한다.

```bash
# gateway (BFF /api/quiz-records) — Deployment·컨테이너 모두 'gateway'
kubectl set image deployment/gateway \
  gateway=ghcr.io/tpals0409/algosu-gateway:main-<sha> -n algosu

# frontend (/quiz UI + api-store) — Deployment·컨테이너 모두 'frontend'
kubectl set image deployment/frontend \
  frontend=ghcr.io/tpals0409/algosu-frontend:main-<sha> -n algosu

# 롤아웃 완료 대기
kubectl rollout status deployment/gateway -n algosu
kubectl rollout status deployment/frontend -n algosu
```

> gateway/frontend는 마이그레이션이 없으므로 단순 롤아웃이다. 순서상 **identity(스키마) → gateway(BFF) → frontend(UI)**.

---

## 5. 롤백

| 실패 지점 | 증상 | 조치 |
|---|---|---|
| §3.2 initContainer 마이그레이션 실패 | 파드 `Init:Error` | identity 이미지 태그를 직전 `main-<old-sha>`로 되돌려 재적용. `quiz_records`가 부분 생성됐으면 §5.1로 정리 후 재시도 |
| §3.3 스키마 불일치 | `migrations` 행 없음 / `\d` 실패 | initContainer 로그 재확인. 권한·DB 연결(`DATABASE_*` secret) 점검 |
| §6 E2E 실패 (앱 레벨) | API 401/500 | gateway/frontend 이미지 태그 롤백. 스키마는 비파괴라 유지 가능 |

### 5.1 마이그레이션 수동 롤백 (스키마 되돌리기)

```bash
# typeorm 표준 revert (down() = DROP TABLE quiz_records 실행)
kubectl exec -n algosu <identity-pod> -c identity-service -- \
  node ./node_modules/typeorm/cli.js migration:revert -d dist/src/database/data-source.js

# 또는 직접
kubectl exec -n algosu pod/postgres-<hash> -- \
  psql -U algosu_admin -d identity_db -c "DROP TABLE IF EXISTS quiz_records;"
```

> `quiz_records`는 다른 테이블이 참조하지 않는 독립 테이블이라 `DROP`이 안전하다. `statement_timeout` 무관(즉시 완료).

---

## 6. 라이브 E2E 검증 체크리스트

> **전제**: `/quiz`는 **인증 게이트** 경로다(`frontend/src/middleware.ts`의 `PUBLIC_PATHS`에 미포함). 로그인 후 AppLayout 네비게이션의 **Brain(퀴즈) 메뉴**로 진입한다. 비로그인 접근은 `/login?redirect=...`로 307 리다이렉트되는 것이 **정상**이다. 따라서 라이브 E2E는 **로그인 사용자 기준**으로 수행한다(SP217이 추가한 서버 영속화가 검증 대상). localStorage 폴백 경로는 프론트 폴백이며 라이브 익명 접근 모드가 아니다.

진입: `https://algo-su.com` 로그인 → 네비게이션 **퀴즈(Brain)** → `/quiz`.

API 계약 요약(검증 시 네트워크 탭/DevTools로 확인):

| 호출 | 경로 | 비고 |
|---|---|---|
| best 목록 조회 | `GET /api/quiz-records` | Cookie 인증 → 게이트웨이가 X-User-ID 주입. 응답 snake_case 배열 |
| 기록 저장 | `POST /api/quiz-records` | body `{category, difficulty, scorePercent, playedAt}` |

허용 값: `category ∈ {DATA_STRUCTURE, ALGORITHM, NETWORK, OS, DATABASE}`, `difficulty ∈ {ALL, EASY, MEDIUM, HARD}`, `scorePercent 0~100`, `playedAt` ISO8601.

### ✅ 6.1 로그인 플레이 → 서버 영속화

1. 로그인 상태로 `/quiz` 진입 → 분야·난이도 선택 후 1회 완주.
2. 결과 화면 도달 시 **`POST /api/quiz-records` 201** 발생(DevTools Network).
3. DB 확인:
   ```bash
   kubectl exec -n algosu pod/postgres-<hash> -- psql -U algosu_admin -d identity_db -c \
     "SELECT user_id, category, difficulty, best_score_percent FROM quiz_records ORDER BY updated_at DESC LIMIT 5;"
   ```
   - **기대**: 방금 플레이한 `(user_id, category, difficulty, scorePercent)` 1행.

### ✅ 6.2 best는 높을 때만 갱신 (higher-only upsert)

1. 같은 (분야, 난이도)를 **더 낮은 점수**로 재플레이 → 결과 화면 "최고 기록" 변동 없음.
2. DB `best_score_percent`가 **유지**(낮은 값으로 덮이지 않음).
3. **더 높은 점수**로 재플레이 → `best_score_percent` 갱신, `played_at` 갱신.
   - 동시성: identity의 `INSERT … ON CONFLICT (user_id,category,difficulty) DO UPDATE … WHERE best_score_percent < EXCLUDED` 단일 원자 쿼리(TOCTOU 회피).

### ✅ 6.3 기기 간 best 동기화

1. **다른 기기(또는 시크릿 창)** 에서 같은 계정 로그인 → `/quiz` 진입.
2. 같은 (분야, 난이도) 선택 시작 화면에 **6.1/6.2에서 저장한 best가 표시**.
   - 내부: `GET /api/quiz-records`가 서버 best를 반환(localStorage 아님).

### ✅ 6.4 난이도별 best 분리

1. 같은 분야를 **다른 난이도**(예: EASY vs HARD)로 각각 플레이.
2. DB에 **별도 행**으로 존재(복합 키 `(user_id, category, difficulty)`):
   ```bash
   kubectl exec -n algosu pod/postgres-<hash> -- psql -U algosu_admin -d identity_db -c \
     "SELECT category, difficulty, best_score_percent FROM quiz_records WHERE user_id='<uid>' ORDER BY category, difficulty;"
   ```
   - **기대**: 같은 category에 difficulty가 다른 복수 행. 난이도별 best가 서로 덮어쓰지 않음.

### ✅ 6.5 게스트 → 로그인 merge-up (멱등, 1회)

> 시나리오: 비로그인 상태에서 먼저 플레이해 localStorage(`algosu.quiz.records.v2`)에 기록이 쌓인 사용자가 로그인하는 경우. (라이브에서 `/quiz`는 인증 게이트이므로 이 경로는 주로 **로그인 직후 첫 진입 시 잔존 localStorage**가 있을 때 발생.)

1. (재현) DevTools로 `localStorage['algosu.quiz.records.v2']`에 임의 best를 심거나, 직전 비로그인 세션의 잔존 데이터 사용.
2. 로그인 후 `/quiz` 첫 진입 → **1회** merge-up: localStorage best가 서버로 `POST`(higher-only, 멱등).
   - 같은 세션에서 페이지를 다시 열어도 **재업로드 없음**(`mergedUpRef` 세션 1회 가드).
3. 서버 best가 localStorage 값 이상으로 동기화(낮으면 서버 값 유지).

### ✅ 6.6 best-effort 폴백 (장애 격리)

1. (선택) 네트워크 차단 상태로 완주 → **결과 화면은 정상 렌더**(저장 실패해도 크래시 없음).
2. `POST` 실패는 조용히 무시되고 결과 표시를 막지 않음(Sprint 215/217 best-effort 설계).

---

## 7. 사후 조치

- [ ] 본 컷오버 결과를 sprint-window 이월 항목에서 제거(실행 완료 시).
- [ ] `quiz_records` 행 누적 모니터링(초기 며칠 사용자 기록 적재 확인).
- [ ] 메모리 `MEMORY.md` "후속 처리 필요"의 SP217 항목 체크.

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `services/identity/src/database/migrations/20260602000000-SP217-CreateQuizRecords.ts` | `quiz_records` 마이그레이션(up/down) |
| `infra/k3s/identity-service.yaml` | `db-migrate` initContainer(자동 마이그레이션) |
| `services/identity/src/quiz-record/quiz-record.controller.ts` | Identity internal API(`/api/quiz-records`, `by-user/:userId`) |
| `services/gateway/src/quiz-record/quiz-record.controller.ts` | BFF(`GET/POST /api/quiz-records`) |
| `frontend/src/lib/quiz/api-store.ts` | 프론트 서버 연동 저장소 |
| `frontend/src/middleware.ts` | `/quiz` 인증 게이트(PUBLIC_PATHS) |
| [`db-migration.md`](./db-migration.md) | 범용 DB 마이그레이션 절차(백업·timeout·롤백) |
