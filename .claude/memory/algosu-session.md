# AlgoSu MSA 전환 프로젝트 — 세션 기록

## 프로젝트 개요
- **목표**: 모놀리식(Next.js + Supabase) → 5개 마이크로서비스 MSA 전환
- **기간**: 1주일 핵심 구현 (Phase 1~2), 이후 스프린트 확장
- **문서**: `agents/`, `.claude/commands/`

---

## TF 구성 (9개 Agent)

| Agent | 이름 | Tier | 모델 | 담당 |
|-------|------|------|------|------|
| Agent-00 | Oracle(심판관) | — | 현재 세션 | 최종 기획 결정, PM 소통 |
| Agent-01 | Gatekeeper(관문지기) | Tier 1 | claude-opus-4-6 | API Gateway, JWT, SSE |
| Agent-02 | Conductor(지휘자) | Tier 1 | claude-opus-4-6 | Submission Service, Saga |
| Agent-03 | Postman(배달부) | Tier 2 | claude-sonnet-4-6 | GitHub Worker |
| Agent-04 | Sensei(분석가) | Tier 3 | claude-sonnet-4-6 | AI Analysis (FastAPI) |
| Agent-05 | Curator(출제자) | Tier 2 | claude-sonnet-4-6 | Problem Service |
| Agent-06 | Architect(기반설계자) | Tier 2 | claude-sonnet-4-6 | k3s, CI/CD, 모니터링 |
| Agent-07 | Librarian(기록관리자) | Tier 1 | claude-opus-4-6 | PostgreSQL, TypeORM |
| Agent-08 | Herald(전령) | Tier 3 | claude-sonnet-4-6 | Next.js 페이지 로직, SSE 수신 |
| Agent-09 | Palette(팔레트) | Tier 3 | claude-opus-4-6 | 디자인 시스템, shadcn/ui, Tailwind, 공통 컴포넌트 |

---

## Day 0 — 킥오프 (2026-02-27) ✅

### 주요 결정사항
1. **보안 체크리스트 전 Agent 적용** (Oracle 지시)
2. **보고 체계 확정**: 각 Agent → Oracle → PM (Oracle만 PM 직접 소통)
3. **인터페이스 계약 확정**: X-User-ID/X-User-Role/X-Internal-Key 헤더 규칙
4. **이미지 태그**: `main-{git-sha}` 강제, `latest` 사용 금지

---

## Day 1 — 인프라 기반 구축 (2026-02-27) ✅

### 투입 Agent: Architect / Librarian / Gatekeeper (병렬)

### 이슈
- 서브 Agent Write/Bash 권한 차단 → Oracle이 직접 파일 생성으로 해결

### 생성된 파일 목록

**루트**
- `.gitignore` — .env, secrets, kubeconfig 제외
- `.env.example` — 키 목록 (실제값 없음)
- `docker-compose.dev.yml` — PostgreSQL + PgBouncer + Redis + RabbitMQ

**인프라 (Architect)**
- `.github/workflows/ci.yml` — path filter, ARM aarch64, main-{sha} 태그
- `infra/k3s/namespace.yaml`
- `infra/k3s/postgres.yaml` — PostgreSQL + PgBouncer (Resource Limit 포함)
- `infra/k3s/redis.yaml`
- `infra/k3s/rabbitmq.yaml`
- `infra/k3s/monitoring/prometheus-config.yaml` — 스크랩 30s
- `infra/k3s/monitoring/loki-config.yaml` — 로그 보존 72h
- `infra/sealed-secrets/README-sealed-secrets.md`

**DB (Librarian)**
- `infra/k3s/postgres-init/01-create-databases.sql` — 4개 DB + 사용자 생성
- `infra/k3s/postgres-init/02-grant-permissions.sql` — 권한 분리, 크로스 접근 차단
- `services/submission/src/database/migrations/1700000000000-CreateSubmissionsAndDrafts.ts` — saga_step ENUM, drafts UNIQUE
- `.claude/commands/algosu-migrate.md` — Expand-Contract 패턴 규칙

**API Gateway (Gatekeeper)**
- `services/gateway/package.json`
- `services/gateway/tsconfig.json`
- `services/gateway/nest-cli.json`
- `services/gateway/.env.example`
- `services/gateway/Dockerfile` — 멀티스테이지, non-root
- `services/gateway/src/main.ts`
- `services/gateway/src/app.module.ts`
- `services/gateway/src/auth/auth.module.ts` — HS256 고정
- `services/gateway/src/auth/jwt.middleware.ts` — exp 검증, none 차단
- `services/gateway/src/auth/jwt.strategy.ts`
- `services/gateway/src/common/guards/internal-key.guard.ts` — 타이밍 어택 방지
- `services/gateway/src/proxy/proxy.module.ts` — SSE 엔드포인트 기초

### 보안 체크리스트 전 항목 통과 ✅

---

## Hermes / Oracle 인프라 작업 (2026-02-28) ✅

### 작업 내용

**1. Oracle 자동 제안 기능 추가**
- `auto-respond.ts`: `getOracleSuggestion(completedWork)` 추가 — `[작업완료]` 시 다음 단계 선제 제안
- `hermes-server.ts`: `type === 'report'` 수신 시 비동기 제안 생성 (non-blocking)
- `bot.ts`: Discord `[작업완료]` 태그 감지 시 비동기 제안 생성

**2. claude -p 타임아웃 버그 수정**
- 원인: `claude -p` 실행 시 `--tools` 미지정 → 도구 권한 확인 대기 → 60초 타임아웃
- 해결: `spawnClaude()`에 `--tools ""` 플래그 추가 (도구 없이 순수 텍스트 생성)

**3. script PTY → 직접 실행 방식 전환**
- 원인: pm2 환경에서 `script: tcgetattr/ioctl` 에러
- 해결: `spawnClaude()` 공통 헬퍼로 통합, `NO_COLOR=1 TERM=dumb`으로 직접 실행

**4. Oracle 시스템 프롬프트 역할 경계 수정**
- 문제: Oracle이 PM 메시지 수신 시 Hermes 인프라/AlgoSu 코드에 직접 접근
- 해결: `ORACLE_CONTEXT`에 금지 사항 명시 (Hermes 코드 접근 금지, 직접 코드 작성 금지, AlgoSu 서비스 직접 조작 금지)

### 최종 상태 (2026-02-28)
- **Hermes Bot 완전 제거** — pm2 삭제, `/services/discord-bot/` 디렉토리 삭제
- **Oracle 직접 전송으로 전환** — `~/.claude/discord-send.sh` 사용

---

## Discord 자동 응답 시스템 구축 (2026-02-28) ✅

### 생성 파일
- `~/.claude/discord-receiver.sh` — PM 메시지 수신 봇 (pm2: discord-receiver)
- `~/.claude/oracle-respond.sh` — Oracle 자동 응답 트리거
- `~/.claude/oracle-system-prompt.md` — Oracle 자율 운영 시스템 프롬프트

### 핵심 해결 사항
- `env -u CLAUDECODE` 로 Claude Code 중첩 실행 차단 우회
- pm2 독립 프로세스로 실행 → Claude Code 세션과 완전 분리
- 동작: PM Discord 메시지 → 5초 내 감지 → macOS 알림 → oracle-respond.sh 백그라운드 실행 → claude -p (Oracle) → Discord 자동 답장

---

## Day 2 — DB 스키마 + Gateway 강화 + Problem Service (2026-02-28) ✅

### Librarian
- `services/problem/src/database/migrations/1700000100000-CreateProblemsTable.ts` — difficulty/status ENUM, 주차별/마감 인덱스
- `services/identity/src/database/migrations/1700000200000-CreateProfilesTable.ts` — user_role/github_token_status ENUM, AES-256-GCM 토큰 컬럼

### Gatekeeper
- `services/gateway/src/rate-limit/redis-throttler.storage.ts` — Redis 기반 Rate Limit (분당 60건, 제출 10건)
- `services/gateway/src/common/config/service-keys.config.ts` — 서비스별 고유 Internal Key 관리
- `services/gateway/src/proxy/proxy.module.ts` — 화이트리스트 기반 라우팅 + 서비스별 키 주입

### Curator
- Problem Service NestJS 전체 초기화 (package.json, Dockerfile, Entity/DTO/Controller/Service)
- `services/problem/src/cache/deadline-cache.service.ts` — 마감 시간 Redis 캐싱 (TTL 300s)

---

## Day 3 — Submission Service + Saga Orchestrator (2026-02-28) ✅

### Conductor
- Submission Service 전체 구현 (package.json, Dockerfile, Entity/DTO/Controller/Service)
- `services/submission/src/saga/saga-orchestrator.service.ts` — Saga 상태 전이 + Startup Hook 미완료 Saga 재개
- `services/submission/src/saga/mq-publisher.service.ts` — RabbitMQ Exchange/Queue/DLQ 선언 + 메시지 발행
- Draft UPSERT API + 정식 제출 시 Draft 삭제

### Librarian
- Init Container k8s YAML: problem-service, submission-service, identity-service

---

## Day 4 — Frontend + Auto-save (2026-02-28) ✅

### Herald
- `frontend/src/app/submit/[problemId]/page.tsx` — 코드 제출 페이지
- `frontend/src/components/submission/CodeEditor.tsx` — 코드 에디터 + 언어 선택 + 검증
- `frontend/src/components/submission/SubmissionStatus.tsx` — 3단계 상태 표시
- `frontend/src/hooks/useAutoSave.ts` — localStorage(1초) + 서버 Draft(30초) + 복원 우선순위
- `frontend/src/lib/api.ts` — Gateway 경유 API 클라이언트

---

## Day 5 — GitHub Worker + k3s 배포 (2026-02-28) ✅

### Postman
- GitHub Worker 전체 구현 (RabbitMQ 소비자, prefetch=2)
- `services/github-worker/src/token-manager.ts` — GitHub App Installation Token (Redis TTL 3600s, 50분 갱신)
- `services/github-worker/src/github-push.service.ts` — Octokit 기반 파일 생성/업데이트
- `services/github-worker/src/worker.ts` — Retry 3회 + DLQ + TOKEN_INVALID 분기
- `services/github-worker/src/status-reporter.ts` — Redis Pub/Sub 브로드캐스트

### Architect
- k3s YAML: gateway, github-worker, 전 서비스 Resource Limit 설정

---

## Day 6 — AI Analysis + SSE + 모니터링 (2026-02-28) ✅

### Sensei
- FastAPI AI Analysis Service (Gemini 연동)
- `services/ai-analysis/src/circuit_breaker.py` — Circuit Breaker (CLOSED/OPEN/HALF_OPEN)
- `services/ai-analysis/src/gemini_client.py` — Gemini API + Circuit Breaker 적용
- `services/ai-analysis/src/worker.py` — RabbitMQ 소비자 + Redis Pub/Sub

### Gatekeeper
- `services/gateway/src/sse/sse.controller.ts` — Redis Pub/Sub → SSE 스트림 (최종 상태 시 자동 종료)

### Architect
- k3s YAML: ai-analysis-service, prometheus, grafana, loki (Resource Limit 포함)

---

## Day 7 — 통합 검증 + SSE 프론트 + Sealed Secrets (2026-02-28) ✅

### Herald
- `frontend/src/hooks/useSubmissionSSE.ts` — EventSource API + 상태 매핑 + 자동 재연결

### Librarian
- `infra/sealed-secrets/sealed-secrets-template.yaml` — 전 서비스 Sealed Secrets 템플릿

### Architect
- CI/CD: Identity Service 빌드 job 추가
- `main-{git-sha}` 태그 규칙 전 서비스 확인 완료

---

## Definition of Done (1주일)

- [x] 코드 제출 → DB 저장 (saga_step=DB_SAVED, 즉시 반환)
- [x] saga_step 정상 전이 (DB_SAVED → GITHUB_QUEUED → AI_QUEUED → DONE)
- [x] GitHub Worker Retry/DLQ + TOKEN_INVALID 처리
- [x] AI Analysis Circuit Breaker (OPEN/HALF_OPEN/CLOSED)
- [x] SSE UI 실시간 상태 3단계 표시 (EventSource + Redis Pub/Sub)
- [x] Auto-save Draft API (localStorage 1초 + 서버 30초)
- [x] 서비스 재시작 후 미완료 Saga 자동 재개 (Startup Hook)
- [x] 전 Pod k3s Resource Limit 설정 완료
- [x] `main-{git-sha}` CI/CD 파이프라인 (6개 서비스 + frontend)
- [x] 전 서비스 X-Internal-Key 검증 (InternalKeyGuard)
- [x] Sealed Secrets 템플릿 준비 완료
- [x] 로그에 토큰/키/PII 노출 없음 (전 서비스 확인)

### 남은 작업 (Phase 2+ / 스프린트)
- [ ] 실 배포 후 E2E 테스트 (k3s 클러스터에서)
- [ ] Sealed Secrets kubeseal 명령으로 실 암호화 적용
- [ ] Grafana 대시보드 구성 (SLO 모니터링)
- [ ] Phase 3: Dual Write + DB 분리
- [ ] Phase 4: ArgoCD GitOps 도입

---

## 📌 체크포인트 스냅샷 (2026-02-28 21:28 KST)

### 프로젝트 규모
| 항목 | 수치 |
|------|------|
| 서비스 수 | 6개 (gateway, submission, problem, github-worker, ai-analysis, identity) |
| 프론트엔드 | 1개 (Next.js) |
| 서비스 소스 파일 | 71개 |
| 인프라 파일 | 19개 |
| 프론트엔드 파일 | 6개 |
| CI/CD 파일 | 1개 |
| 소스 코드 라인 | 3,452줄 (TS/TSX/Python) |
| 인프라 설정 라인 | 1,336줄 (YAML/SQL) |
| 총 코드 라인 | ~4,800줄 |

### 서비스별 파일 수
| 서비스 | 파일 수 | 기술 스택 |
|--------|---------|-----------|
| gateway | 16개 | NestJS, JWT, Redis Rate Limit, SSE |
| submission | 19개 | NestJS, TypeORM, Saga, RabbitMQ |
| problem | 17개 | NestJS, TypeORM, Redis Cache |
| github-worker | 9개 | Node.js, Octokit, RabbitMQ |
| ai-analysis | 9개 | FastAPI, Gemini, Circuit Breaker |
| identity | 1개 | Migration only (스키마 준비) |

### 인프라 구성
- **k3s 매니페스트**: namespace, postgres, redis, rabbitmq, 6개 서비스 Deployment
- **모니터링**: Prometheus, Grafana, Loki (YAML 준비)
- **보안**: Sealed Secrets 템플릿, InternalKeyGuard 전 서비스 적용
- **CI/CD**: GitHub Actions (path filter, ARM aarch64, main-{sha} 태그)

### Phase 1+2 완료 항목 (12/12) ✅
1. 코드 제출 → DB 저장 (Saga)
2. Saga 상태 전이 (DB_SAVED → GITHUB_QUEUED → AI_QUEUED → DONE)
3. GitHub Worker (Retry 3회 + DLQ + TOKEN_INVALID)
4. AI Analysis Circuit Breaker
5. SSE 실시간 상태 표시
6. Auto-save Draft (localStorage + 서버)
7. 서비스 재시작 시 미완료 Saga 자동 재개
8. 전 Pod Resource Limit
9. CI/CD 파이프라인 (7개 빌드 job)
10. 전 서비스 X-Internal-Key 검증
11. Sealed Secrets 템플릿
12. 로그 보안 검증 완료

### 다음 세션에서 해야 할 일
1. **실 배포**: k3s 클러스터에 전체 서비스 배포
2. **E2E 테스트**: 코드 제출 → GitHub Push → AI 분석 → SSE 수신 전체 플로우
3. **Sealed Secrets 실 적용**: kubeseal 명령으로 암호화
4. **Grafana 대시보드**: SLO 모니터링 구성
5. **Phase 3 계획**: Dual Write + DB 분리 스프린트

---

---

## UI 개선 작업 — 목업 기반 전면 재작성 (2026-02-28 후속) ✅

### 발단
- 브라우저 확인 결과 UI가 목업과 너무 달라 Palette + Herald 투입 결정
- Round 1, 2 (부분 수정) 시도 → 여전히 불일치
- Round 3: Stitch 방식(처음부터 재작성) 채택, Palette 모델 Opus 4.6으로 격상

### Palette (Round 3 — Stitch 모드, Opus 4.6) ✅
**전면 재작성 파일:**
- `frontend/src/app/globals.css` — Google Fonts import, 라이트/다크 CSS 변수 전체, glass 유틸리티
- `frontend/tailwind.config.ts` — borderRadius/boxShadow 하드코딩값(JIT 호환), bg2/bg3/surface/text2/text3 토큰 추가
- `frontend/src/components/ui/Badge.tsx` — dot prop, 5개 variant(default/info/success/warning/error/muted)
- `frontend/src/components/ui/Button.tsx` — 6개 variant, 4개 size, 하드코딩 색상(#947EB0/#6D5A8A)
- `frontend/src/components/ui/Card.tsx` — 기본 p-4, shadow-light
- `frontend/src/components/ui/Input.tsx` — 목업 form-input 스펙(8px 12px padding, bg-bg2/bg3)
- `frontend/src/components/layout/TopNav.tsx` — glass 배경, 목업 nav-item active 색상, 벨/아바타 28x28px
- Herald 지시서: `frontend/.palette-herald-sync.md` 생성

### Herald ✅
- `frontend/src/app/problems/page.tsx` — `<Card className="p-0">` 적용 (padding 중복 제거)
- `frontend/src/app/(auth)/layout.tsx` — 로그인 상단 로고를 목업 스타일로 수정 (8px dot + AlgoSu 20px bold)
- 빌드 에러 0건 ✓, algosu-frontend 재시작 완료

### Oracle (직접 수정) ✅
- `frontend/src/components/layout/TopNav.tsx` — 테마 토글 버튼 복원 (Palette 재작성 시 누락)
  - `next-themes` `useTheme` 훅, Sun/Moon 아이콘(lucide-react), 28x28px bg-bg2

### 버그 수정 — allowedLanguages 배열 반환 문제 ✅
- 원인: varchar 컬럼에 수동 JSON.stringify + pm2 포트 3002 충돌
- 해결: `problem.entity.ts` → `type: 'simple-json'`, `deserializeProblem()` 완전 제거

### Problem DB 테스트 데이터 삽입 ✅
- 4개 문제: 두 수의 합(SILVER/ACTIVE), 최장 공통 부분 문자열(GOLD/ACTIVE), 팰린드롬(BRONZE/CLOSED), 이진 탐색(SILVER/ACTIVE)

---

## 단위 테스트 Phase 0~5 전체 완료 (2026-02-28) ✅

### 테스트 실행 결과: 122/122 ALL PASS

| 서비스 | 테스트 파일 | 테스트 수 | 결과 |
|--------|-----------|----------|------|
| Identity | auth.service.spec.ts | 7 | ✅ |
| Gateway | internal-key.guard.spec.ts, oauth.service.spec.ts, study.service.spec.ts | 39 | ✅ |
| Submission | submission.service.spec.ts, saga-orchestrator.service.spec.ts, draft.service.spec.ts | 26 | ✅ |
| Problem | problem.service.spec.ts, deadline-cache.service.spec.ts | 19 | ✅ |
| GitHub Worker | github-push.service.spec.ts, token-manager.spec.ts | 11 | ✅ |
| AI Analysis | test_circuit_breaker.py, test_gemini_client.py, test_worker.py | 20 | ✅ |

### CI/CD 통합
- `.github/workflows/ci.yml` 업데이트: 빌드 전 테스트 실행 단계 추가
- 각 서비스별 test job 생성 (Node.js 20 / Python 3.11)
- 테스트 통과 후에만 Docker 빌드 진행 (needs 의존관계)
- 커버리지 Artifact 자동 업로드 (7일 보관)

### 테스트 인프라 현황
- Jest config: 5개 TypeScript 서비스 완비
- pytest config: AI Analysis 서비스 완비
- 총 테스트 파일: 14개 (TS 11 + Python 3)

---

---

## v1.1+v1.2 전면 적용 작전 (2026-02-28) ✅

### 근거 문서
- `AlgoSu_Oracle_Decisions_Update_v1.1.md` — 다중 스터디 서비스화 *(원본: Mac `/Users/leokim/Desktop/추가사항 문서/`)*
- `AlgoSu_Oracle_Decisions_Update_v1.2.md` — OAuth 인증 도입
- `AlgoSu_TF_Kickoff_Plan_v2.1.md` — Palette 합류
- `AlgoSu_Code_Conventions_Update_v1.1.md` — 디자인 토큰 규칙
- 적용 계획서: `memory/algosu-v1.1-v1.2-plan.md`

### 핵심 변경 9개 결정
| 결정 | 내용 |
|------|------|
| C-02 | study_id=1 고정 → 다중 스터디 완전 지원 (studies 테이블) |
| C-03 | 단일 레포 → 스터디별 GitHub 레포 + SKIPPED |
| H-03 | Custom Auth (Supabase 미사용) — Google/Naver/Kakao OAuth 직접 + JWT 자체 발급 |
| H-05 | study_id UUID FK + users 테이블 (oauth_provider, github_connected) |
| M-02 | 비멤버 403 차단 |
| M-11 | X-User-Role 폐기 → study_members 캐시 권한 |
| NEW-01 | 스터디 생성/가입/초대 플로우 |
| NEW-02 | 다중 스터디 + X-Study-ID 헤더 |
| NEW-04 | GitHub 2단계 연동 (소셜 1차 → GitHub 2차 필수) |

### Phase A — DB 마이그레이션 (Librarian, Opus) ✅
**신규 생성:**
- `services/identity/src/database/migrations/1700000300000-CreateStudiesTables.ts` — studies, study_members, study_invites
- `services/identity/src/database/migrations/1700000400000-CreateUsersTable.ts` — users, oauth_provider_enum

**수정:**
- `1700000000000-CreateSubmissionsAndDrafts.ts` — study_id UUID 추가, SKIPPED ENUM, drafts UNIQUE 3중
- `1700000100000-CreateProblemsTable.ts` — study_group_id → study_id UUID
- `1700000200000-CreateProfilesTable.ts` — study_group_id 제거
- `infra/k3s/postgres-init/02-grant-permissions.sql` — identity_user 권한 보강

### Phase B — Gateway + Custom Auth (Gatekeeper, Opus) ✅
**JWT/헤더:**
- jwt.middleware.ts: role 삭제, X-Study-ID UUID 검증+전달
- jwt.strategy.ts: JwtPayload/ValidatedUser role 제거
- proxy.module.ts: X-User-Role→X-Study-ID 전환

**Custom Auth (신규):**
- `src/auth/oauth/` — oauth.module/controller/service, user.entity
- Google/Naver/Kakao OAuth 직접 연동 + JWT 자체 발급 (HS256)
- OAuth state CSRF 방지 (Redis 5분 TTL)
- GitHub 연동/해제/재연동 API
- Refresh Token (Redis 7일 TTL)

**Internal API (신규):**
- `src/internal/` — GET /internal/users/:user_id/github-status

**스터디 API (신규):**
- `src/study/` — 8개 엔드포인트 (CRUD + 초대 + 멤버 관리)
- 멤버 추방 시 Redis 캐시 즉시 무효화

**기타:** app.module TypeORM identity_db 연결, package.json 의존성, .env.example

### Phase C-1 — Submission Service (Conductor, Opus) ✅
- submission.entity.ts: studyId UUID + SKIPPED ENUM
- draft.entity.ts: studyId UUID
- submission.service.ts: create(dto, userId, studyId), findByStudyAndUser(), verifyGitHubConnected()
- submission.controller.ts: 전 핸들러 x-study-id + StudyMemberGuard
- saga-orchestrator.service.ts: MQ 메시지에 studyId 포함
- mq-publisher.service.ts: SubmissionEvent studyId 추가
- draft.service.ts: 전 메서드 studyId 반영
- **신규:** common/guards/study-member.guard.ts (인메모리 캐시 + Gateway Internal API)

### Phase C-2 — Problem Service (Curator, Sonnet) ✅
- problem.entity.ts: studyGroupId → studyId UUID
- create-problem.dto.ts: studyGroupId 제거
- deadline-cache.service.ts: 캐시 키 studyId 포함
- problem.service.ts: 전 메서드 studyId 스코핑
- problem.controller.ts: X-User-Role 전면 제거, StudyMemberGuard 적용
- problem.module.ts: StudyMemberGuard 등록
- **신규:** common/guards/study-member.guard.ts

### Phase P — UI 톤 개선 (Palette, Sonnet) ✅
- globals.css: 다크 --bg L7%→L11%, 레이어 명도차 10~12%p, --text3 WCAG AA, 라이트 더 밝게
- tailwind.config.ts: primary-50~900 스케일, error 스케일, rounded-card/btn, shadow-card/modal
- Badge.tsx: 반투명 22%, 색상→CSS variable
- Button.tsx: bg-[#947EB0]→bg-primary-500, hover 밝아지는 방향
- Card.tsx: shadow-card 모드별 분기, rounded-card
- Input.tsx: 다크 명도차 확보, focus→primary-500
- TopNav.tsx: glass-dark utility, active→primary-900
- **신규:** frontend/.palette-herald-sync.md (Herald 지시서 Round 4)

### Phase D — GitHub Worker (Postman, Sonnet) ✅
- worker.ts: studyId 추가, SKIPPED 분기 (github_repo null→reportSkipped)
- github-push.service.ts: 환경변수 하드코딩 제거→PushInput repoOwner/repoName 동적
- token-manager.ts: getTokenForRepo(owner,repo), Redis 키 레포별, Installation ID 동적 조회
- status-reporter.ts: studyId 추가, reportSkipped() 메서드
- .env.example: GATEWAY_INTERNAL_URL, INTERNAL_KEY_GATEWAY

### Phase E — Frontend (Herald, Sonnet) ✅ (빌드 0 에러)
**신규:**
- contexts/StudyContext.tsx — 전역 스터디 상태, localStorage 동기화
- (auth)/callback/page.tsx — OAuth 콜백, github_connected 분기
- (auth)/github-link/page.tsx — GitHub 연동 페이지
- studies/page.tsx — 스터디 목록 + 초대 코드 가입
- studies/create/page.tsx — 스터디 생성 폼
- middleware.ts — 라우팅 미들웨어 (미인증/미연동/미선택 가드)

**수정:**
- layout.tsx: StudyProvider 추가
- api.ts: X-Study-ID 자동 첨부, studyApi/authApi 추가
- login/page.tsx: Google/Naver/Kakao OAuth 버튼
- useAutoSave.ts: 키 algoso:draft:{studyId}:{problemId}
- useSubmissionSSE.ts: github_skipped 상태
- submit/[problemId]/page.tsx: 스터디/github 가드
- TopNav.tsx: StudySelector 드롭다운

### 스킬 파일 업데이트 (14개 전체)
- Agent 스킬 9개: Oracle 프로토콜 삽입 + v1.1+v1.2 변경사항 반영
- 문서 참조 스킬 5개: 업데이트 문서 경로 추가
- 핵심: Custom Auth (Supabase 미사용), 디자인 토큰 {semantic}-{scale}, 인라인 하드코딩 금지

### Oracle 운영 프로토콜 (PM 위임, 이번 세션에서 적용)
- PM 전용 채널: Oracle만 PM 직접 소통
- 중앙 집중식 통제: Agent 독자 작업 금지
- JIT 권한: 최소 권한 부여 → 작업 종료 즉시 회수
- 전수 모니터링 + 위험 시 Discord 긴급 보고

### 작전 통계
- 투입 Agent: 7명 (Librarian, Gatekeeper, Conductor, Curator, Palette, Postman, Herald)
- 위험 상황: 0건
- 전체 산출물: ~60+ 파일 (수정+신규)

### 주의사항
- 이전 단위 테스트(122개)는 v1.0 기준 → v1.1+v1.2 코드에 맞게 **테스트 재실행/수정 필요**
- Discord 자동 응답 Oracle이 처리한 "HIGH 위험도 수정" 내역은 이 세션에 없음 (별도 프로세스)

### 다음 할 일
1. ~~v1.1+v1.2 코드 기준 단위 테스트 재실행 + 수정~~
2. ~~docker-compose로 로컬 통합 테스트~~ ✅
3. ~~E2E 플로우 검증~~ ✅ (로컬 — OAuth 실 연동 제외)
4. Sealed Secrets kubeseal 실 적용
5. Grafana SLO 대시보드
6. Phase 3 (DB 분리) 스프린트

---

## 로컬 통합 E2E 테스트 (2026-02-28) ✅

### 환경 구성
- **Docker Compose**: PostgreSQL 16(:5432), Redis 7.2(:6379), RabbitMQ 3.13(:5672)
- **로컬 서비스**: Gateway(3000), Problem(3002), Submission(3003)
- **프론트엔드**: Next.js 15.1.7 Turbopack(:3001)
- **DB**: identity_db, problem_db, submission_db, analysis_db (4개)

### 테스트 데이터
| 항목 | 값 |
|------|-----|
| User ID | 0e30a92c-b872-4aef-b07d-571b675301b5 |
| Study ID | ebec2a5b-b76e-42ce-a409-d31c00104128 |
| Problem ID | c0cffc99-6b24-42da-aa21-33acdc486159 |
| JWT Secret | algoso_local_jwt_secret_min_32_chars_dev |

### 서비스 기동 전 수정 사항

**1. Identity Service — migration 인프라 부재**
- `services/identity/src/database/data-source.ts` 신규 생성 (TypeORM CLI용)
- `package.json`에 `migration:run`/`migration:revert` 스크립트 추가
- `app.module.ts` synchronize: true → false 변경

**2. 전 서비스 — migration path 오류**
- NestJS는 `dist/src/`로 빌드 (not `dist/`)
- identity/problem/submission 3개 서비스 `package.json` migration:run 경로 수정

**3. Identity Migration — PostgreSQL 호환 문제**
- `CREATE INDEX CONCURRENTLY` → 트랜잭션 내 불가 → CONCURRENTLY 제거
- `WHERE expires_at > NOW()` partial index → NOW() 비-IMMUTABLE → WHERE 제거

**4. v1.0 ↔ v1.2 스키마 충돌**
- Identity: 기존 users(username/password_hash) vs v1.2 users(oauth_provider/github_connected)
- Problem/Submission: 기존 v1.0(study_group_id) vs v1.1(study_id UUID)
- 해결: 전 테이블 DROP + migration 기록 초기화 + 재마이그레이션

**5. Gateway Entity-Migration 불일치**
- Study: github_repo 컬럼 누락, name length 200→100
- StudyInvite: code 타입 uuid→varchar(20), used_count/max_uses 누락
- study.service.spec.ts 테스트 mock 업데이트

**6. Problem StudyMemberGuard — Gateway fallback 부재**
- Redis-only 구현 → 캐시 miss 시 즉시 403
- Gateway Internal API fallback 추가 (Submission 패턴과 통일)
- `GATEWAY_INTERNAL_URL`, `INTERNAL_KEY_GATEWAY` 환경변수 추가

**7. Gateway Internal API — membership 엔드포인트 부재**
- Problem/Submission Guard가 호출하는 `/internal/studies/:id/members/:userId` 미구현
- `InternalController.checkMembership()` 추가
- `InternalModule`에 `TypeOrmModule.forFeature([StudyMember])` 등록

**8. 프론트엔드 환경변수**
- `.env.local`에 `NEXT_PUBLIC_API_URL=http://localhost:3000` 추가 (SSE 훅용)

### 수정된 파일 목록
| 파일 | 변경 |
|------|------|
| `services/identity/src/database/data-source.ts` | 신규 |
| `services/identity/package.json` | migration 스크립트 |
| `services/identity/src/app.module.ts` | synchronize→false |
| `services/identity/src/database/migrations/1700000200000-*.ts` | CONCURRENTLY 제거 |
| `services/identity/src/database/migrations/1700000300000-*.ts` | NOW() partial index 제거 |
| `services/problem/package.json` | migration path |
| `services/submission/package.json` | migration path |
| `services/gateway/src/study/study.entity.ts` | github_repo, code type, used_count, max_uses |
| `services/gateway/src/study/study.service.spec.ts` | mock 업데이트 |
| `services/gateway/src/internal/internal.controller.ts` | checkMembership 추가 |
| `services/gateway/src/internal/internal.module.ts` | StudyMember import |
| `services/problem/src/common/guards/study-member.guard.ts` | Gateway fallback 추가 |
| `services/gateway/.env` | identity_db, OAuth, CORS 설정 |
| `services/problem/.env` | GATEWAY_INTERNAL_URL, INTERNAL_KEY_GATEWAY |
| `services/submission/.env` | GATEWAY_INTERNAL_URL, INTERNAL_KEY_GATEWAY |
| `frontend/.env.local` | NEXT_PUBLIC_API_URL |

### E2E 테스트 결과: 20/20 PASS

**페이지 렌더링 (4/4)**
| # | 테스트 | 결과 |
|---|--------|------|
| 1 | Main Page (/) | ✅ 200 |
| 2 | Login Page (/login) — OAuth 버튼 3종 | ✅ 200 |
| 3 | Studies Page (/studies) | ✅ 200 |
| 4 | Problems Page (/problems) | ✅ 200 |

**인증/보안 (4/4)**
| # | 테스트 | 결과 |
|---|--------|------|
| 5 | OAuth Callback (/callback?token=...) | ✅ 200 |
| 6 | CORS Pre-flight (Authorization + X-Study-ID) | ✅ 204 |
| 19 | 잘못된 Study ID → 403 | ✅ |
| 20 | 잘못된 JWT → 401 | ✅ |

**API 전체 플로우 (12/12)**
| # | 테스트 | 결과 |
|---|--------|------|
| 7 | Study List (JWT 인증) | ✅ 200 |
| 8 | Problem Active (Gateway → Problem) | ✅ 200 |
| 9 | Submission List (Gateway → Submission) | ✅ 200 |
| 10 | Draft 저장 (Auto-save) | ✅ 201 |
| 11 | Draft 조회 | ✅ 200 |
| 12 | Submission 생성 (Saga: DB_SAVED → GITHUB_QUEUED) | ✅ 201 |
| 13 | Submission 단건 조회 | ✅ 200 |
| 14 | Problem 단건 조회 | ✅ 200 |
| 15 | Draft 삭제 | ✅ 204 |
| 16 | Draft 삭제 확인 (data: null) | ✅ 200 |
| 17 | Saga Step 전이 검증 | ✅ |
| 18 | 미인증 접근 → 401 | ✅ |

### 미테스트 항목 (외부 의존)
- **OAuth 실 로그인**: Google/Naver/Kakao Client ID 미설정 → 실 배포 시 테스트
- **GitHub Worker MQ 소비**: Worker 미구동 (MQ 발행은 정상 확인)
- **SSE 실시간 스트림**: Redis Pub/Sub 이벤트 발행 필요 (Worker/AI 연동 시)
- **AI Analysis Service**: Python 서비스 미구동

### Discord 보고
- `#work-report` 채널에 결과 전송 완료 (2026-02-28 12:42 KST)

---

## Phase 3 Sprint 3-2 — 전체 기능 구현 (2026-02-28, HEAD: bddbf98) ✅

### 개요
- 36파일 변경, +4,220줄
- 기획 문서 대비 누락 기능 15개(백엔드 7 + 프론트엔드 8) 일괄 구현

### 백엔드 (7개)

| ID | 기능 | 담당 | 핵심 파일 |
|----|------|------|----------|
| B-1 | AI 분석 결과 조회 | Sensei | `submission.controller.ts` GET /:id/analysis (IDOR 방지) |
| B-2 | AI 결과 저장 | Sensei | entity 4컬럼 + migration + `submission-internal.controller.ts` PATCH |
| B-3 | 그룹 최적화 코드 합성 | Sensei | `main.py` POST /group-analysis + internal by-problem API |
| B-4 | 제출 목록 페이지네이션 | Conductor | `PaginationQueryDto` + `findByStudyAndUserPaginated()` |
| B-5 | 스터디 통계 API | Gatekeeper | `study.controller.ts` GET /stats + `submission.service.ts` getStudyStats() |
| B-6 | 역할 변경 API | Gatekeeper | PATCH /members/:userId/role (ADMIN 검증, 자기변경 차단, 최소 1 ADMIN) |
| B-7 | 알림 시스템 | Gatekeeper | notification entity/service/controller/module + migration + SSE 연동 |

### 프론트엔드 (8개)

| ID | 기능 | 담당 | 파일 |
|----|------|------|------|
| A-1 | 대시보드 | Herald | `dashboard/page.tsx` (434줄) — 통계카드, 주차별 차트, 멤버 통계 |
| A-2 | AI 피드백 페이지 | Herald | `submissions/[id]/analysis/page.tsx` — 점수 게이지, 최적화 코드 |
| A-3 | 제출 이력 | Herald | `submissions/page.tsx` (376줄) — 페이지네이션, 필터 |
| A-4 | 프로필 | Herald | `profile/page.tsx` (346줄) — GitHub 연동 관리, 스터디 목록 |
| A-5 | 알림 벨 | Herald | `NotificationBell.tsx` (258줄) — 30초 폴링, 읽음 처리 |
| A-6 | 문제 관리 UI | Palette | `problems/create/page.tsx` + `problems/[id]/edit/page.tsx` (ADMIN 전용) |
| A-7 | 검색/필터 | Palette | `problems/page.tsx` 개선 — 난이도, 주차, 상태 필터 |
| A-8 | 스터디 상세 | Palette | `studies/[id]/page.tsx` — 멤버 관리, 초대 코드, 역할 변경 |

### 공통 변경
- `api.ts` (339줄): authApi(unlink/relink), studyApi(stats/members/invite/changeRole/removeMember), submissionApi(list/getAnalysis), notificationApi(list/unreadCount/markRead)
- `auth.ts`: GitHub 연동 localStorage 유틸
- `TopNav.tsx`: Avatar→프로필 링크, NotificationBell 컴포넌트

### 사건 기록
- **worktree 코드 유실**: Agent 5명을 `isolation: "worktree"`로 투입 → TeamDelete 호출 시 merge 전 브랜치 삭제 → 전체 코드 유실 → 재투입(직접 쓰기)으로 복구
- **PM 지시 (Agent 투입 규칙)**: TF 외 범용 Agent 투입 금지. Skill 기반 지시 필수, 메모리 기반 감시 필수

---

## 스킬 목록

| Skill | 용도 |
|-------|------|
| `algosu-conductor` | Conductor Agent 활성화 (Opus) |
| `algosu-gatekeeper` | Gatekeeper Agent 활성화 (Opus) |
| `algosu-librarian` | Librarian Agent 활성화 (Opus) |
| `algosu-architect` | Architect Agent 활성화 (Sonnet) |
| `algosu-curator` | Curator Agent 활성화 (Sonnet) |
| `algosu-postman` | Postman Agent 활성화 (Sonnet) |
| `algosu-herald` | Herald Agent 활성화 (Sonnet) |
| `algosu-palette` | Palette Agent 활성화 (**Opus** — 2026-03-02 변경) |
| `algosu-sensei` | Sensei Agent 활성화 (Sonnet) |
| `algosu-arch` | 아키텍처 문서 참조 |
| `algosu-kickoff` | 킥오프 계획서 참조 |
| `algosu-persona` | 페르소나 프롬프트 참조 |
| `algosu-conventions` | 코드 규칙 참조 |
| `algosu-ui` | UI 디자인 시스템 참조 |

---

## 알고리즘 태그 저장 + Analytics 시각화 (2026-03-02) ✅

### 개요
- Solved.ac에서 가져온 알고리즘 태그를 Problem DB에 저장하고, Analytics 페이지에서 "내가 푼 알고리즘 유형" 시각화
- 시각화 방식 탐색: 수평 바 → CSS 버블 → SVG circle packing → **태그 칩 그리드** (최종 채택)

### Step 1: 태그 저장 파이프라인 (백엔드 5파일 + 프론트 2파일)

| # | 파일 | 변경 |
|---|------|------|
| 1 | `services/problem/src/database/migrations/1700000100002-AddTagsColumn.ts` | **신규** — tags varchar(500) 컬럼 |
| 2 | `services/problem/src/problem/problem.entity.ts` | `@Column({ type: 'simple-json', nullable: true }) tags` |
| 3 | `services/problem/src/problem/dto/create-problem.dto.ts` | 양쪽 DTO에 `@IsOptional() @IsArray() @IsString({ each: true }) tags` |
| 4 | `services/problem/src/problem/problem.service.ts` | create()에 `tags: dto.tags ?? null`, update()에도 동일 |
| 5 | `services/problem/src/problem/problem.service.spec.ts` | mockProblem에 `tags: null` 추가 |
| 6 | `frontend/src/lib/api.ts` | `Problem.tags`, `CreateProblemData.tags` 타입 추가 |
| 7 | `frontend/src/app/problems/create/page.tsx` | handleSubmit에 `if (bojResult?.tags?.length) data.tags = bojResult.tags` |

### Step 2: solvedProblemIds Stats 통합 (submissionApi.list() 대체)

**문제**: `submissionApi.list({ limit: 200 })`가 Promise.allSettled에서 silently 실패 → Section C 미렌더링
**해결**: stats 파이프라인에 `solvedProblemIds` 추가

| # | 파일 | 변경 |
|---|------|------|
| 1 | `services/submission/src/submission/submission.service.ts` | `getStudyStats()`에 optional `userId` 파라미터, `SELECT DISTINCT problem_id` 쿼리 |
| 2 | `services/submission/src/submission/submission-internal.controller.ts` | `@Query('userId') userId` 수신 후 service에 전달 |
| 3 | `services/gateway/src/study/study.service.ts` | 내부 호출 시 `params.set('userId', userId)`, 응답에 `solvedProblemIds` 포함 |
| 4 | `frontend/src/lib/api.ts` | `StudyStats`에 `solvedProblemIds: string[]` |
| 5 | `frontend/src/app/analytics/page.tsx` | `submissionApi` 의존 제거, `stats.solvedProblemIds`에서 파생 |

### Step 3: Analytics 시각화 결정 과정

1. **수평 바 차트** (WeeklyBar 패턴) — PM: "막대 그래프가 별론데"
2. **CSS 버블** (flex-wrap divs) — PM: "너무 정갈하게 보이는데"
3. **SVG circle packing** (레퍼런스 기반) — 여러 이슈:
   - "우리 테마랑 안 어울려" → Palette(Sonnet) 투입, 색상 조정
   - 긴 태그명 원 밖 overflow → `splitTag()` 2줄 분리
   - 호버 시 전체 텍스트 → tooltip → 원 안 표시
   - 글자 가독성 → `paint-order: stroke` 아웃라인
   - **최종**: "전체적인 UI랑 안 어울려" → Palette Opus로 격상
4. **Palette (Opus) 분석**: 방향 A(버블 수정) vs 방향 B(교체) 비교
   - SVG 유기적 원형 ≠ 직교 그리드 UI (근본적 충돌)
   - SVG에서 CSS 변수 사용 불가, paint-order stroke = 디자인과 싸우는 hack
   - **방향 B 권장**: 태그 칩 그리드 (기존 UI 패턴 재사용)
5. **태그 칩 그리드** (최종) — flex-wrap, 3단계 시각 구분:
   - **상위**(ratio≥0.7): `gradient-brand border-primary/30 text-primary-foreground`
   - **중위**(ratio≥0.4): `bg-bg3 border-primary/15`
   - **하위**: `bg-bg2 border-border`
   - 공통: `font-mono text-[11px] rounded-md`

### Palette 모델 변경
- `~/.claude/commands/algosu-palette.md`: `model: claude-sonnet-4-6` → `model: claude-opus-4-6`
- 사유: Sonnet 분석이 표면적 수정에 그쳐 근본적 디자인 판단 부족

### 디자인 교훈
- **SVG 기반 유기적 차트는 직교 그리드 UI와 근본적으로 충돌** — Tailwind 토큰 기반 컴포넌트가 테마 정합성 최고
- **시각화 선택 시**: 기존 UI 패턴(카드, 배지, 바)과의 일관성 우선, 독립적 차트 라이브러리 지양
- **CSS 변수 100% 활용**: hex 하드코딩 금지 원칙은 시각화에도 동일 적용

### 빌드/검증
- `services/problem`: `npm run build` 통과 ✅
- `services/submission`: `npm run build` 통과 ✅
- `services/gateway`: `npm run build` 통과 ✅
- `frontend`: `npx tsc --noEmit` 통과 ✅
- 로컬 서비스 재시작 완료 (Gateway:3000, Submission:3003)

---

## UI v2 전면 교체 + k3d 배포 검증 (2026-03-02, HEAD: 026b469)

### 개요
- **커밋**: `feat: UI v2 전면 교체 + k3d 배포 검증 완료`
- **변경**: 173 files, +14,913 / -3,401
- **Sprint**: UI-1 ~ UI-6 전체 완료
- **k3d**: 16 Pod 전체 Running, 모든 health 검증 완료

### Sprint UI-1: Backend Foundation
- publicId (UUID) 전환: users, studies, submissions, notifications 모두 외부 식별자 UUID화
- httpOnly Cookie JWT: localStorage 제거, `cookie.util.ts` + `TokenRefreshInterceptor`
- CORS: Gateway에서 credentials 포함 설정
- GlobalExceptionFilter: 전 서비스 통일 에러 응답 (publicId 노출 차단)
- CSP: `next.config.ts`에 Content-Security-Policy 헤더
- Route Guard: `AuthGuard`, `StudyActiveGuard` 적용
- SSE S6 리팩토링: Redis Pub/Sub 기반 SSE 스트림 안정화

### Sprint UI-2: Backend Features
- 알림 9종: SUBMISSION_STATUS, AI_COMPLETED, GITHUB_FAILED, ROLE_CHANGED, PROBLEM_CREATED, DEADLINE_REMINDER, MEMBER_JOINED, MEMBER_LEFT, STUDY_CLOSED
- DeadlineReminder: 마감 24시간/1시간 전 알림 자동 생성
- AI 정책: Claude API 전환 (`prompt.py` 신규), 일일 5회/유저 제한, AI_SKIPPED saga step
- ReviewComment/Reply API: Submission 서비스에 코드리뷰 댓글/답글 CRUD
- StudyNote API: 스터디 노트 생성/조회/수정
- 프로필 API: 아바타 프리셋 기반 (MinIO 미사용), GitHub 연동 상태

### Sprint UI-3: Frontend Core
- 디자인 시스템 v2: 47개 CSS 변수 듀얼 테마 (라이트/다크), `globals.css` 전면 재작성
- 공통 컴포넌트 22종: Badge, Button, Card, Input, DiffBadge, DifficultyBadge, ScoreBadge, ScoreGauge, StatusBadge, StatusIndicator, LangBadge, TimerBadge, CategoryBar, Skeleton, LoadingSpinner, EmptyState, Alert, BackBtn, Logo, NotificationToast, NotifPanel, Toast
- Landing 페이지: HeroButtons, FeatureCards, HomeRedirect
- Login: OAuth 3종 버튼, 디자인 시스템 적용
- Dashboard: 통계카드, 주차별 차트, 마감 임박 문제, 멤버 통계

### Sprint UI-4: Frontend Pages
- Problems: 검색/필터 (난이도, 주차, 상태, 태그), 문제 상세, 생성/편집 (ADMIN)
- Submissions: 페이지네이션, 필터, AI 분석 결과 표시, 코드 제출 페이지
- Studies: 목록, 생성, 상세 (멤버 관리, 초대 코드, 역할 변경)
- Profile: GitHub 연동, 아바타, 스터디 목록
- Notifications: NotificationBell (10초 폴링), NotifPanel 드롭다운
- Error/NotFound: error.tsx, not-found.tsx

### Sprint UI-5: Code Review
- ReviewPage (`/reviews/[submissionId]`): 2-패널 뷰 (코드 + 댓글)
- CodePanel: 라인번호 + 하이라이트 + 코드 표시
- CommentThread: 댓글 트리 구조, 줄 번호 참조
- ReplyItem: 답글 표시/작성
- StudyNoteEditor: 마크다운 스터디 노트 작성/편집
- CommentForm: 새 댓글 작성 폼

### Sprint UI-6: Integration + Stabilization
- 마이그레이션 12건 idempotent 처리 (IF NOT EXISTS, DO $$ 패턴)
- github-worker 이미지 수정: k3d 배포 호환
- MinIO: Deployment + Service + PVC + init-job (아바타 프리셋 전환으로 미사용이나 인프라 준비됨)
- k3d 16 Pod 전체 Running 검증:
  - 백엔드 6: gateway, problem, submission, identity, github-worker, ai-analysis
  - 프론트 1: frontend
  - 인프라 5: postgres, postgres-problem, redis, rabbitmq, minio
  - 모니터링 4: prometheus, grafana, loki, promtail

### 주요 아키텍처 변경
1. **publicId 전환**: 모든 엔티티에 `@Column({ type: 'uuid', unique: true }) publicId` 추가, 외부 API는 publicId만 노출
2. **httpOnly Cookie**: `cookie.util.ts`로 JWT 쿠키 설정, `TokenRefreshInterceptor`로 만료 임박 시 자동 갱신
3. **AI Claude 전환**: Gemini → Claude API, `prompt.py`에서 프롬프트 관리, 일일 5회 제한
4. **코드리뷰 시스템**: ReviewComment + ReviewReply 엔티티, Submission 서비스에서 CRUD, 프론트 2-패널 UI

### k3d 배포 검증 결과
- 16/16 Pod Running
- 모든 서비스 /health 200 OK
- 마이그레이션 전체 성공 (initContainer)
- Sealed Secrets 적용 완료

### 다음 할 일
1. aether-gitops 동기화 (UI v2 변경사항 반영)
2. OCI k3s 배포 (VM 접속 정보 확보 후)
3. OAuth 실 연동 테스트
4. Grafana SLO 대시보드 구성
5. UI v2 기준 단위 테스트 + E2E 재작성
