---
sprint: 220
title: "SP217 퀴즈 기록 컷오버 런북 + 라이브 E2E 검증 체크리스트"
date: "2026-06-06"
status: completed
agents: [Oracle, Librarian, Critic]
related_adrs: ["sprint-215", "sprint-216", "sprint-217", "sprint-218", "sprint-219"]
related_memory: ["sprint-window", "project-deploy-and-domain"]
topics: ["docs", "runbook", "deployment", "migration", "quiz"]
tldr: "Sprint 215~219로 코드측 완성·검증된 CS 퀴즈 로그인 기록 연동(quiz_records)을 라이브에 반영·검증하기 위한 운영 컷오버 런북을 산출한 docs-only 스프린트. 운영 클러스터 접근은 사용자/ops 전용이라 실제 migration:run·재배포·라이브 E2E는 직접 수행할 수 없으므로, 실행 가능한 정확한 절차를 문서로 남기는 데 집중했다. 핵심 정정: identity-service.yaml의 db-migrate initContainer가 롤아웃 시 migration:run을 자동 실행하므로, 과거 이월 문구의 '수동 migration:run + 재배포'는 실제로 '재배포(=initContainer 자동 마이그레이션)' 단일 흐름이다. SP217 마이그레이션은 신규 빈 테이블 CREATE TABLE이라 statement_timeout 위험이 없어(SP196 GIN 인덱스와 대조) CONCURRENTLY·SET timeout=0 불필요. 신규 런북 docs/runbook/sp217-quiz-records-cutover.md에 사전 조건·백업·identity 롤아웃(initContainer 마이그레이션)·gateway+frontend 롤아웃·롤백·라이브 E2E 6항목 체크리스트(로그인 영속화·higher-only·기기 간 동기화·난이도별 분리·merge-up 멱등·best-effort 폴백)를 정확한 API 경로(GET/POST /api/quiz-records, by-user/:userId)와 함께 기재. 정확성 발견: /quiz는 PUBLIC_PATHS 미포함 인증 게이트라 라이브 E2E는 로그인 사용자 기준이며 현 /quiz→/login 307은 정상 동작. 실행은 운영 이월 유지(런북 제공으로 실행 준비 완료). docs-only — 코드/스키마/번들 무변경."
---
# Sprint 220 — SP217 퀴즈 기록 컷오버 런북 + 라이브 E2E 검증 체크리스트

## 목표

- Sprint 215~219로 **코드측 완성·검증**된 CS 퀴즈 로그인 기록 연동(`quiz_records`)을 **라이브 반영·검증**할 수 있는 운영 컷오버 런북을 산출한다.
- 운영 클러스터 접근은 사용자/ops 전용이므로, 이 스프린트는 **실행이 아니라 "실행 가능한 정확한 절차" 산출**이 목표다(실제 실행은 운영 이월 유지).
- **docs-only** — 코드/스키마/테스트/번들 무변경(기능은 215~219에서 완료·검증).

## 배경

### merge ≠ 라이브, 그리고 반복된 "수동 migration:run + 재배포" 이월

Sprint 217이 `quiz_records`를 추가한 이래 215~219의 매 스프린트가 동일한 이월을 carry-over 해왔다: "운영측 `identity_db` `migration:run` + 서버 재배포 + 라이브 `/quiz` E2E 검증". 코드는 218(회귀 안전망)·219(lint 정리)로 검증됐으나 **라이브는 미검증**이다. 이미지 빌드는 main 머지 시 자동이지만 롤아웃은 수동 ops라(`infra/k3s/*.yaml`의 image는 `main-PLACEHOLDER` 리터럴), merge ≠ 라이브가 구조적으로 유지된다.

### initContainer가 마이그레이션을 자동 실행한다 (이월 문구 정정)

탐색 중 `infra/k3s/identity-service.yaml`의 **`db-migrate` initContainer**가 앱 컨테이너 기동 전에 `migration:run`을 자동 실행함을 확인했다:

```yaml
initContainers:
  - name: db-migrate
    command: ["node", "./node_modules/typeorm/cli.js", "migration:run", "-d", "dist/src/database/data-source.js"]
```

즉 그동안의 "수동 `migration:run` + 재배포"는 두 개의 분리된 수동 단계처럼 읽혔으나, 실제로는 **재배포(새 identity 이미지 롤아웃)가 마이그레이션을 포함**한다. 본 스프린트는 이 사실을 런북에 1차 경로로 명문화하고, `kubectl exec ... migration:run`은 검증/폴백 경로로 격하한다.

### SP217 마이그레이션은 timeout 위험이 없다

`20260602000000-SP217-CreateQuizRecords.ts`는 신규 빈 테이블 `CREATE TABLE quiz_records` + 복합 UNIQUE + 작은 `CREATE INDEX`다. 운영 postgres의 `statement_timeout=200`을 초과하지 않아 **`SET statement_timeout=0`·`CREATE INDEX CONCURRENTLY` 불필요**하다(Sprint 196 `problem_db` GIN 인덱스가 대용량 rewrite로 timeout=0이 필요했던 것과 대조). `down()` = `DROP TABLE IF EXISTS` → 롤백 안전.

## 결정

### D1. 신규 전용 컷오버 런북 작성 (범용 db-migration.md 보강 아님)

`docs/runbook/sp217-quiz-records-cutover.md`를 신규 작성한다. 근거: 컷오버는 (마이그레이션 + 재배포 3종 + 라이브 E2E)를 아우르는 절차라 범용 `db-migration.md`(백업·timeout·롤백 일반론)보다 범위가 넓다. 범용 런북과는 **상호 참조**로 연결한다.

### D2. 재배포(initContainer 자동 마이그레이션)를 1차 경로로 명문화

런북은 **identity 롤아웃 = 마이그레이션 자동 적용**을 1차 경로로, `kubectl exec ... migration:run`을 검증/폴백 경로로 기재한다. 반복 이월 문구의 "수동 migration:run" 프레이밍을 사실에 맞게 정정한다.

### D3. 라이브 E2E는 로그인 사용자 기준 (정확성 발견)

`frontend/src/middleware.ts`의 `PUBLIC_PATHS`에 `/quiz`가 **없으므로** `/quiz`는 인증 게이트다(로그인 후 AppLayout Brain 메뉴로 진입). 비로그인 접근의 `/quiz → /login` 307은 **정상 동작**이며 미배포 신호가 아니다. 따라서 라이브 E2E 체크리스트는 SP217이 추가한 **로그인 사용자 서버 영속화**를 검증 대상으로 삼는다. localStorage 폴백은 프론트 폴백이지 라이브 익명 접근 모드가 아니다.

## 구현

### 산출물

| 파일 | 내용 |
|---|---|
| `docs/runbook/sp217-quiz-records-cutover.md` (신규) | §0 핵심 사실(initContainer 자동 마이그레이션·timeout 무관·merge≠라이브·서비스 3종) / §1 사전 조건 / §2 백업 / §3 identity 롤아웃+마이그레이션 검증 / §4 gateway+frontend 롤아웃 / §5 롤백 / §6 라이브 E2E 6항목 / §7 사후 조치 |
| `docs/adr/sprints/sprint-220.md` (신규, 본 문서) | 컷오버 가이드 결정·initContainer 발견·실행 이월 유지 기록 |
| `docs/adr-en/sprints/sprint-220.md` (신규) | 영문 SSOT |
| `docs/adr/README.md` | sprint ADR 카운트 157→158, 범위 62~219→62~220 |
| `docs/runbook/db-migration.md` | SP217 컷오버 런북 상호 참조 추가 |

### 검증한 API 계약 (런북 E2E 정확성)

- **Frontend → Gateway BFF**: `GET /api/quiz-records`(내 best 목록), `POST /api/quiz-records` body `{category, difficulty, scorePercent, playedAt}`. Cookie 인증 → JWT 미들웨어가 X-User-ID 주입.
- **Gateway → Identity internal**: X-Internal-Key. `POST /api/quiz-records`(upsert, `{data}` 래핑), `GET /api/quiz-records/by-user/:userId`.
- 허용 값: `category ∈ {DATA_STRUCTURE, ALGORITHM, NETWORK, OS, DATABASE}`, `difficulty ∈ {ALL, EASY, MEDIUM, HARD}`, `scorePercent 0~100`, `playedAt` ISO8601.
- 배포 이름: Deployment `identity-service`(컨테이너 `db-migrate`+`identity-service`), `gateway`, `frontend`. identity_db는 `postgres` 인스턴스(슈퍼유저 `algosu_admin`).

## 검증

- docs-only — 코드/스키마/번들 무변경.
- ADR 게이트: index count(sprint 158, --strict) / adr-en coverage(sprint-220 EN 존재, --strict) / adr-links 0 broken / doc-refs no broken.
- 런북 내부 상대 링크(`db-migration.md`) 유효성.

## 교훈

1. **재배포가 마이그레이션을 포함하면 "수동 migration:run"은 잘못된 이월 프레이밍** — initContainer 패턴(`db-migrate`)을 쓰는 서비스는 롤아웃이 곧 마이그레이션이다. 이월 문구를 작성할 때 배포 메커니즘(initContainer vs 수동 Job)을 먼저 확인하면, 운영에 불필요한 수동 단계를 지시하지 않는다.
2. **마이그레이션 위험 등급은 대상 테이블 상태에 의존** — 신규 빈 테이블 `CREATE TABLE`은 timeout 위험이 없어 SP196 GIN 인덱스의 `SET statement_timeout=0` 절차를 그대로 복붙하면 과잉이다. 마이그레이션별로 rewrite 유발 여부를 판정해 절차를 차등화한다.
3. **라이브 검증 시나리오는 라우트 보호 수준을 먼저 확인** — `/quiz`가 인증 게이트(`PUBLIC_PATHS` 미포함)임을 모르면 "게스트 익명 플레이"를 라이브 E2E에 넣어 잘못된 기대(307이 버그라는 오판)를 만든다. 미들웨어의 공개 경로 목록이 E2E 시나리오의 전제다.
4. **실행 불가 작업도 "실행 가능한 정확한 절차"로 산출하면 이월이 진척된다** — 운영 접근이 없어 직접 실행은 못 해도, 정확한 API 경로·배포 이름·검증 쿼리를 담은 런북은 사용자가 곧바로 실행할 수 있는 상태로 이월을 전진시킨다.

신규패턴: 해당 없음(기존 런북 작성 패턴 적용).

## Sprint 221+ 이월

- **(운영 실행) 본 런북에 따라 identity → gateway → frontend 롤아웃 + 라이브 `/quiz` E2E 6항목 검증** (사용자/운영, 중요): 런북으로 절차는 확정됐으나 실제 실행·검증은 운영 접근 필요. 완료 시 sprint-window·MEMORY 이월 항목 제거.
- GA4 admin(스트림 URL·history page_view OFF·프로덕션 UAT) — 사용자 직접.
- 운영 Sprint 196 `problem_db` 마이그레이션 실행 + 재배포 — 사용자/운영.
- 하네스 체크업 `--full` CI 정기 실행 자동화(월 1회 cron) 검토 — Sprint 209 이월.

## Critic 교차 리뷰

- **대상**: `docs/` 5파일 (base `d529db6`..HEAD, docs-only)
- **Codex 명령**: `codex review --base d529db6 -c model=gpt-5.5`
- **세션 ID**: `019e9af1-0e30-7411-b54b-7e54efd36c57`

**R1 — Critical/High 0건, P2 1건 + P3 2건 (모두 수정 반영)**:

1. **[P2] 이미지 태그를 `origin/main` 최신 SHA가 아닌 서비스별 마지막 빌드 SHA로** — docs-only 머지 후 `origin/main`은 서비스 경로를 변경하지 않고, CI 경로 필터가 변경된 서비스만 빌드·푸시하므로 `main-<docs-sha>` 서비스 이미지가 존재하지 않을 수 있다. 운영자가 이를 롤아웃하면 없는 태그를 찾게 된다. → §1.1을 "각 서비스의 GHCR 최신 `main-<sha>`(= 그 서비스를 마지막으로 변경한 머지 SHA)를 `crane ls`/`git log -- <path>`로 확인, 없으면 `ci-rebuild-all.md`로 강제 재빌드"로 재작성. §3.1·§4 롤아웃에 "§1.1의 서비스별 SHA 사용" 명시.
2. **[P3] README 잔존 범위** — 헤더는 158/62~220으로 갱신했으나 바로 아래 문장이 `Sprint 62 ~ 219`로 남아 내부 불일치. → `62 ~ 220`으로 정정.
3. **[P3] merge-up 재진입 기대** — §6.5가 "같은 세션 재진입 시 재업로드 없음"이라 했으나 `mergedUpRef`는 컴포넌트 로컬 useRef라 새로고침/재마운트 시 리셋되어 재-POST 발생(higher-only라 무해). "POST 0회" 기대는 거짓 실패 유발. → 기대를 "같은 마운트 내 리렌더만 가드, 새로고침은 재-POST 가능하나 멱등 결과(best 불변)가 검증 포인트"로 한정.

**종합 판정**: ✅ 머지 가능 — 모든 지적은 런북 정확성(운영자 오인 방지) 보강이며 docs-only. 수정 후 ADR 게이트 4종 재통과.
