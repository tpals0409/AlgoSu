# AlgoSu MSA 단위 테스트 계획서

> 작성일: 2026-02-28
> 작성자: Oracle (심판관)
> 상태: ✅ 전 Phase 완료 (122/122 테스트 통과, CI/CD 통합 완료)

---

## 1. 현황 분석

### 1.1 테스트 인프라 현황

| 항목 | 상태 | 비고 |
|------|------|------|
| 기존 테스트 파일 | ❌ 0개 | 프로젝트 소스 내 테스트 파일 미존재 |
| Jest 설정 | ⚠️ 부분 | Gateway/Problem/Submission/GitHub-Worker: `npm test` 스크립트만 존재, jest.config 미설정 |
| Identity Service | ❌ 미설정 | Jest 의존성 미설치, test 스크립트 없음 |
| AI Analysis (Python) | ❌ 미설정 | pytest 미포함, 설정 파일 없음 |
| Frontend | ❌ 미설정 | Jest 의존성 미포함 |
| CI/CD 테스트 단계 | ❌ 없음 | ci.yml에 테스트 실행 없음 |

### 1.2 테스트 대상 서비스 및 코드 규모

| 서비스 | 언어 | 주요 소스 파일 수 | 핵심 테스트 대상 |
|--------|------|-------------------|------------------|
| Gateway | TypeScript (NestJS) | 12개 | OAuth, Study, SSE, Rate Limit, Guards |
| Identity | TypeScript (NestJS) | 4개 | Auth (register/login), JWT 발급 |
| Problem | TypeScript (NestJS) | 7개 | CRUD, Cache, Guards |
| Submission | TypeScript (NestJS) | 8개 | CRUD, Draft, Saga, MQ Publisher |
| GitHub Worker | TypeScript (Node.js) | 5개 | Push, Token Manager, Status Reporter |
| AI Analysis | Python (FastAPI) | 5개 | Circuit Breaker, Claude Client, Worker |

---

## 2. 테스트 인프라 구축 (Phase 0)

### 2.1 TypeScript 서비스 공통 (Jest)

#### jest.config.ts 표준 템플릿
```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!**/main.ts', '!**/*.entity.ts', '!**/*.dto.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
```

#### 서비스별 사전 작업

| 서비스 | 필요 작업 |
|--------|-----------|
| Identity | `npm install --save-dev jest ts-jest @types/jest @nestjs/testing` + `package.json`에 test 스크립트 추가 |
| Gateway | `jest.config.ts` 생성 |
| Problem | `jest.config.ts` 생성 |
| Submission | `jest.config.ts` 생성 |
| GitHub Worker | `jest.config.ts` 생성 |

### 2.2 Python 서비스 (pytest)

#### AI Analysis 사전 작업
```bash
# requirements-dev.txt 생성
pytest==8.0.0
pytest-asyncio==0.23.5
pytest-cov==4.1.0
pytest-mock==3.12.0
```

#### pytest.ini
```ini
[pytest]
testpaths = tests
asyncio_mode = auto
```

### 2.3 CI/CD 통합 (ci.yml 수정)

각 서비스 빌드 job에 테스트 단계 추가:
```yaml
- name: Run unit tests
  run: npm test -- --coverage --ci
```

---

## 3. 서비스별 단위 테스트 계획

### 3.1 Identity Service (우선순위: 🔴 Critical)

> 인증의 기초 — 회원가입, 로그인, JWT 발급

#### 파일: `auth/auth.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `register()` — 정상 회원가입 | User 생성, bcrypt 해싱, JWT 반환 |
| 2 | `register()` — 중복 이메일 | ConflictException 발생 |
| 3 | `register()` — 기본 role | `MEMBER` 역할 할당 확인 |
| 4 | `login()` — 정상 로그인 | bcrypt 비교 성공, JWT 반환 |
| 5 | `login()` — 존재하지 않는 이메일 | UnauthorizedException 발생 |
| 6 | `login()` — 잘못된 비밀번호 | UnauthorizedException 발생 |
| 7 | `issueToken()` — JWT 페이로드 | sub, email, role 포함 확인 |

#### Mock 대상
- `Repository<User>` — TypeORM Repository
- `JwtService` — NestJS JWT

---

### 3.2 Gateway — OAuth Service (우선순위: 🔴 Critical)

> OAuth 인증, GitHub 연동, JWT 발급/갱신

#### 파일: `auth/oauth/oauth.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `generateState()` — CSRF state 생성 | Redis SET 호출, TTL 300초, UUID 형식 |
| 2 | `validateAndConsumeState()` — 유효 state | Redis DEL 호출, 예외 없음 |
| 3 | `validateAndConsumeState()` — 무효/만료 state | BadRequestException 발생 |
| 4 | `getAuthorizationUrl('google')` — URL 생성 | Google OAuth URL 포맷 + client_id + state 포함 |
| 5 | `getAuthorizationUrl('naver')` — URL 생성 | Naver OAuth URL 포맷 |
| 6 | `getAuthorizationUrl('kakao')` — URL 생성 | Kakao OAuth URL 포맷 |
| 7 | `getAuthorizationUrl('invalid')` — 미지원 Provider | BadRequestException 발생 |
| 8 | `handleCallback()` — Google 콜백 정상 | 토큰 교환 → upsert → JWT 발급 |
| 9 | `handleCallback()` — 신규 사용자 | User CREATE 확인 |
| 10 | `handleCallback()` — 기존 사용자 | User UPDATE 확인 |
| 11 | `linkGitHub()` — 정상 연동 | github_connected=true, github_username 설정 |
| 12 | `linkGitHub()` — 토큰 교환 실패 | BadRequestException 발생 |
| 13 | `linkGitHub()` — 존재하지 않는 사용자 | UnauthorizedException 발생 |
| 14 | `unlinkGitHub()` — 연동 해제 | github_connected=false, null 초기화 |
| 15 | `refreshAccessToken()` — 정상 갱신 | 새 accessToken 발급, Redis 검증 |
| 16 | `refreshAccessToken()` — 만료된 token | UnauthorizedException 발생 |
| 17 | `refreshAccessToken()` — Redis 불일치 | UnauthorizedException 발생 |
| 18 | `issueJwt()` — 알고리즘 검증 | HS256 사용 확인, `none` 불가 |

#### Mock 대상
- `axios` — 외부 OAuth API 호출
- `ioredis` — Redis 클라이언트
- `Repository<User>` — TypeORM
- `ConfigService` — 환경변수

---

### 3.3 Gateway — Study Service (우선순위: 🟡 High)

> 스터디 CRUD, 초대 코드, 멤버 관리

#### 파일: `study/study.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `createStudy()` — 정상 생성 | Study 저장 + ADMIN 멤버 자동 등록 |
| 2 | `createStudy()` — 캐시 무효화 | Redis DEL 호출 확인 |
| 3 | `getMyStudies()` — 목록 조회 | memberships → studies 매핑 |
| 4 | `getStudyById()` — 멤버 검증 | 비멤버 접근 시 ForbiddenException |
| 5 | `updateStudy()` — ADMIN 권한 확인 | 비ADMIN 접근 시 ForbiddenException |
| 6 | `deleteStudy()` — 정상 삭제 | DB 삭제 + Redis 패턴 캐시 삭제 |
| 7 | `deleteStudy()` — 비ADMIN | ForbiddenException |
| 8 | `createInvite()` — 초대 코드 발급 | UUID 코드, 7일 만료, ADMIN만 |
| 9 | `joinByInviteCode()` — 정상 가입 | MEMBER 역할 생성 |
| 10 | `joinByInviteCode()` — 만료된 코드 | BadRequestException |
| 11 | `joinByInviteCode()` — 이미 멤버 | ConflictException |
| 12 | `joinByInviteCode()` — 유효하지 않은 코드 | NotFoundException |
| 13 | `removeMember()` — 멤버 추방 | DB 삭제 + 캐시 무효화 |
| 14 | `removeMember()` — 자기 자신 추방 | BadRequestException |

#### Mock 대상
- `Repository<Study>`, `Repository<StudyMember>`, `Repository<StudyInvite>`
- `ioredis`
- `ConfigService`

---

### 3.4 Gateway — InternalKeyGuard (우선순위: 🔴 Critical)

> 보안 핵심 — 타이밍 어택 방지 포함

#### 파일: `common/guards/internal-key.guard.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | 유효한 Internal Key | canActivate → true |
| 2 | 헤더 누락 | UnauthorizedException |
| 3 | 잘못된 Key | UnauthorizedException |
| 4 | `timingSafeEqual()` — 동일 문자열 | true |
| 5 | `timingSafeEqual()` — 다른 문자열 | false |
| 6 | `timingSafeEqual()` — 길이 다른 문자열 | false |

---

### 3.5 Problem Service (우선순위: 🟡 High)

#### 파일: `problem/problem.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `create()` — 문제 생성 | DB 저장, 캐시 설정, 주차 캐시 무효화 |
| 2 | `findById()` — 정상 조회 | studyId 스코핑 확인 |
| 3 | `findById()` — 미존재 | NotFoundException |
| 4 | `findById()` — 다른 studyId | NotFoundException (cross-study 차단) |
| 5 | `findByWeekAndStudy()` — 캐시 히트 | Redis에서 반환 |
| 6 | `findByWeekAndStudy()` — 캐시 미스 | DB 조회 → 캐시 저장 |
| 7 | `getDeadline()` — 캐시 히트 | `cache_hit` status |
| 8 | `getDeadline()` — 캐시 미스 | DB fallback → `db_hit` status |
| 9 | `getDeadline()` — deadline null | `null` 반환 |
| 10 | `update()` — 부분 수정 | 변경된 필드만 업데이트, 캐시 무효화 |
| 11 | `findActiveByStudy()` — 활성 문제 | status=ACTIVE 필터 |

#### 파일: `cache/deadline-cache.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `getDeadline()` — 캐시 히트 | Redis GET 반환값 |
| 2 | `getDeadline()` — 캐시 미스 | null 반환 |
| 3 | `getDeadline()` — Redis 오류 | null 반환 (fall-through) |
| 4 | `setDeadline()` — 정상 설정 | Redis SET + EX 300 |
| 5 | `setDeadline()` — deadline null | value='null' 저장 |
| 6 | `invalidateDeadline()` — 캐시 삭제 | Redis DEL 호출 |
| 7 | `setWeekProblems()` — TTL 확인 | EX 600 |
| 8 | `invalidateWeekProblems()` — 삭제 | Redis DEL 호출 |

---

### 3.6 Submission Service (우선순위: 🔴 Critical)

#### 파일: `submission/submission.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `create()` — 정상 제출 | GitHub 연동 검증 → DB 저장 → Saga 진행 |
| 2 | `create()` — 멱등성 (중복 key) | 기존 제출 반환 |
| 3 | `create()` — GitHub 미연동 | ForbiddenException |
| 4 | `create()` — Saga 진행 실패 | DB 저장은 성공 (에러 로그만) |
| 5 | `findById()` — 정상 조회 | Submission 반환 |
| 6 | `findById()` — 미존재 | NotFoundException |
| 7 | `findByStudyAndUser()` — 목록 | studyId + userId 필터 |
| 8 | `findByProblem()` — 문제별 목록 | studyId + userId + problemId 필터 |

#### 파일: `draft/draft.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `upsert()` — 신규 생성 | Draft CREATE |
| 2 | `upsert()` — 기존 업데이트 | language/code 업데이트, savedAt 갱신 |
| 3 | `findByProblem()` — 조회 | studyId + userId + problemId |
| 4 | `findByProblem()` — 미존재 | null 반환 |
| 5 | `deleteByProblem()` — 삭제 | Repository.delete 호출 |

#### 파일: `saga/saga-orchestrator.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `advanceToGitHubQueued()` — 정상 | DB 업데이트 먼저 → MQ 발행 나중 (멱등성 순서) |
| 2 | `advanceToGitHubQueued()` — studyId 미전달 | DB에서 조회 후 진행 |
| 3 | `advanceToAiQueued()` — 정상 | sagaStep=AI_QUEUED, githubSyncStatus=SYNCED |
| 4 | `advanceToDone()` — 완료 | sagaStep=DONE |
| 5 | `compensateGitHubFailed()` — 일반 실패 | AI 분석은 진행 |
| 6 | `compensateGitHubFailed()` — TOKEN_INVALID | AI 분석 스킵 |
| 7 | `compensateAiFailed()` — AI 실패 | sagaStep=DONE 처리 |
| 8 | `onModuleInit()` — 미완료 Saga 재개 | DB_SAVED → advanceToGitHubQueued 호출 |
| 9 | `onModuleInit()` — 미완료 없음 | 정상 시작 로그 |
| 10 | `resumeSaga()` — GITHUB_QUEUED | MQ 재발행 |
| 11 | `resumeSaga()` — AI_QUEUED | MQ 재발행 |

---

### 3.7 GitHub Worker (우선순위: 🟡 High)

#### 파일: `github-push.service.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `push()` — 새 파일 생성 | Octokit createOrUpdateFileContents, base64 인코딩 |
| 2 | `push()` — 기존 파일 업데이트 | sha 전달하여 업데이트 |
| 3 | `push()` — 파일 경로 규칙 | `submissions/{userId}/{problemId}/{submissionId}.{ext}` |
| 4 | `push()` — 언어→확장자 매핑 | python→py, java→java, cpp→cpp 등 |
| 5 | `push()` — 미지원 언어 | 확장자 `txt` 기본값 |

#### 파일: `token-manager.spec.ts`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `getTokenForRepo()` — 캐시 히트 | Redis GET 반환 |
| 2 | `getTokenForRepo()` — 캐시 미스 | fetchAndCacheToken 호출 |
| 3 | `fetchAndCacheToken()` — 정상 | GitHub API 호출 → Redis SET + TTL 3600 |
| 4 | `fetchAndCacheToken()` — 환경변수 미설정 | Error throw |
| 5 | `fetchAndCacheToken()` — App 미설치(404) | 'TOKEN_INVALID' 에러 |
| 6 | `close()` — 정리 | timer 해제 + Redis quit |

---

### 3.8 AI Analysis Service — Python (우선순위: 🟡 High)

#### 파일: `tests/test_circuit_breaker.py`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | 초기 상태 | CLOSED, failure_count=0 |
| 2 | `record_success()` — CLOSED 상태 | failure_count 리셋 |
| 3 | `record_failure()` — threshold 미만 | 상태 유지 CLOSED |
| 4 | `record_failure()` — threshold 도달 | CLOSED → OPEN 전환 |
| 5 | `is_open` — OPEN + timeout 미경과 | True (차단) |
| 6 | `is_open` — OPEN + timeout 경과 | HALF_OPEN 전환, False |
| 7 | `record_success()` — HALF_OPEN | successes 누적, threshold 도달 시 CLOSED |
| 8 | `record_failure()` — HALF_OPEN | 즉시 OPEN 복귀 |
| 9 | `can_execute()` — CLOSED | True |
| 10 | `can_execute()` — OPEN | False |

#### 파일: `tests/test_claude_client.py`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `analyze_code()` — 정상 | feedback + status='completed' |
| 2 | `analyze_code()` — Circuit Breaker OPEN | fallback 응답, status='delayed' |
| 3 | `analyze_code()` — Claude API 오류 | status='failed', record_failure 호출 |
| 4 | `_build_prompt()` — 프롬프트 포맷 | 언어, 코드, 컨텍스트 포함 확인 |
| 5 | 보안: 코드 로그 50자 제한 | code_preview 길이 확인 |

#### 파일: `tests/test_worker.py`

| # | 테스트 케이스 | 검증 포인트 |
|---|---------------|-------------|
| 1 | `_on_message()` — 정상 처리 | 파싱 → 분석 → 결과 보고 → Pub/Sub → ACK |
| 2 | `_on_message()` — 처리 실패 | NACK (requeue=False) |
| 3 | `_get_submission()` — API 호출 | X-Internal-Key 헤더 포함 확인 |
| 4 | `_publish_status()` — Redis Pub/Sub | 채널명 + 페이로드 포맷 |

---

## 4. 보안 테스트 케이스 (전 서비스 공통)

> Oracle 보안 체크 의무 항목 기반

| # | 항목 | 테스트 케이스 |
|---|------|---------------|
| 1 | JWT `none` 알고리즘 | `none` 알고리즘 토큰 → 거부 확인 |
| 2 | JWT 만료 검증 | 만료된 토큰 → UnauthorizedException |
| 3 | JWT HS256 명시 | 발급 시 algorithm='HS256' 확인 |
| 4 | IDOR 방지 | 다른 userId 데이터 접근 → 403/404 |
| 5 | Cross-study 차단 | 다른 studyId로 접근 → 403/404 |
| 6 | InternalKeyGuard 타이밍 어택 | `timingSafeEqual()` 일관된 시간 |
| 7 | SQL Injection 방지 | TypeORM 파라미터 바인딩 사용 확인 |
| 8 | 토큰 로그 노출 | 로그 출력에 토큰/키 미포함 확인 |

---

## 5. 실행 계획 및 우선순위

### 5.1 실행 순서 (의존성 고려)

```
Phase 0: 테스트 인프라 구축 (Jest/pytest 설정) ✅ 완료
  ↓
Phase 1 [🔴 Critical]: Identity + Guards + Submission Saga ✅ 완료 (7+6+12=25 tests)
  - auth.service.spec.ts ✅ 7/7 PASS
  - internal-key.guard.spec.ts ✅ 6/6 PASS
  - saga-orchestrator.service.spec.ts ✅ 12/12 PASS
  ↓
Phase 2 [🔴 Critical]: OAuth + Submission ✅ 완료 (18+9+5=32 tests)
  - oauth.service.spec.ts ✅ 18/18 PASS
  - submission.service.spec.ts ✅ 9/9 PASS
  - draft.service.spec.ts ✅ 5/5 PASS
  ↓
Phase 3 [🟡 High]: Problem + Study ✅ 완료 (11+8+15=34 tests)
  - problem.service.spec.ts ✅ 11/11 PASS
  - deadline-cache.service.spec.ts ✅ 8/8 PASS
  - study.service.spec.ts ✅ 15/15 PASS
  ↓
Phase 4 [🟡 High]: Worker 서비스 ✅ 완료 (5+6+10+5+4+1=31 tests)
  - github-push.service.spec.ts ✅ 5/5 PASS
  - token-manager.spec.ts ✅ 6/6 PASS
  - test_circuit_breaker.py ✅ 10/10 PASS
  - test_claude_client.py ✅ 6/6 PASS
  - test_worker.py ✅ 4/4 PASS
  ↓
Phase 5: CI/CD 통합 ✅ 완료
  - ci.yml 테스트 단계 추가 ✅
  - 커버리지 Artifact 업로드 ✅
  - 테스트 → 빌드 의존관계 설정 ✅
```

### 5.2 커버리지 목표

| 서비스 | Line Coverage | Branch Coverage | 비고 |
|--------|:------------:|:---------------:|------|
| Identity | 90%+ | 80%+ | 인증 핵심 |
| Gateway (OAuth) | 85%+ | 75%+ | 외부 API Mock 범위 한정 |
| Gateway (Study) | 85%+ | 80%+ | 권한 분기 다수 |
| Gateway (Guards) | 95%+ | 90%+ | 보안 핵심 |
| Problem | 90%+ | 80%+ | 캐시 로직 포함 |
| Submission | 90%+ | 85%+ | Saga 흐름 포함 |
| GitHub Worker | 80%+ | 70%+ | 외부 API 의존 |
| AI Analysis | 85%+ | 80%+ | Circuit Breaker 포함 |

### 5.3 Mock 전략

| 외부 의존성 | Mock 방법 |
|-------------|-----------|
| TypeORM Repository | `jest.fn()` 기반 mock repository |
| Redis (ioredis) | `ioredis-mock` 또는 `jest.fn()` |
| RabbitMQ (amqplib) | `jest.fn()` mock channel |
| axios (OAuth API) | `jest.mock('axios')` |
| Octokit (GitHub API) | `jest.fn()` mock methods |
| Claude API | `unittest.mock.patch` |
| ConfigService | `{ get: jest.fn(), getOrThrow: jest.fn() }` |
| fetch (Node.js) | `jest.fn()` global mock |

---

## 6. 예상 산출물

```
services/
├── identity/src/auth/
│   └── auth.service.spec.ts
├── gateway/src/
│   ├── auth/oauth/oauth.service.spec.ts
│   ├── study/study.service.spec.ts
│   ├── common/guards/internal-key.guard.spec.ts
│   └── sse/sse.controller.spec.ts (선택)
├── problem/src/
│   ├── problem/problem.service.spec.ts
│   ├── cache/deadline-cache.service.spec.ts
│   └── common/guards/internal-key.guard.spec.ts
├── submission/src/
│   ├── submission/submission.service.spec.ts
│   ├── draft/draft.service.spec.ts
│   └── saga/saga-orchestrator.service.spec.ts
├── github-worker/src/
│   ├── github-push.service.spec.ts
│   └── token-manager.spec.ts
└── ai-analysis/
    └── tests/
        ├── test_circuit_breaker.py
        ├── test_claude_client.py
        └── test_worker.py
```

**총 테스트 파일**: 14개
**총 테스트 케이스**: ~105개
**예상 소요 시간**: Phase 0~5 전체 약 8~12시간

---

## 7. 테스트 실행 명령어

```bash
# TypeScript 서비스 개별 실행
cd services/identity && npm test
cd services/gateway && npm test
cd services/problem && npm test
cd services/submission && npm test
cd services/github-worker && npm test

# 커버리지 포함
npm test -- --coverage

# Python AI Analysis
cd services/ai-analysis && python -m pytest tests/ -v --cov=src

# 전체 테스트 (루트에서)
# → CI/CD 통합 후 GitHub Actions에서 자동 실행
```

---

> **Oracle 판단**: 이 계획은 아키텍처 v3 변경 없이 기존 코드에 대한 테스트 추가이므로, Oracle 자율 결정 범위 내입니다. PM 승인 후 즉시 실행 가능합니다.
