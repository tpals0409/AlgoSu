# AlgoSu MSA — 코드 규칙 문서

> 문서 버전: v1.0  
> 적용 범위: algosu-app 모노레포 전체 (NestJS × 4, FastAPI × 1, Next.js × 1)  
> 기반 문서: AlgoSu MSA Architecture Context v3 / Oracle 결정 기록 v1.0

---

## 목차

1. [네이밍 컨벤션](#1-네이밍-컨벤션)
2. [폴더 / 파일 구조](#2-폴더--파일-구조)
3. [Git 커밋 / 브랜치 규칙](#3-git-커밋--브랜치-규칙)
4. [TypeScript / ESLint / Prettier (NestJS · Next.js)](#4-typescript--eslint--prettier-nestjs--nextjs)
5. [Python 코드 스타일 (FastAPI — Sensei)](#5-python-코드-스타일-fastapi--sensei)
6. [공통 금지 사항](#6-공통-금지-사항)

---

## 1. 네이밍 컨벤션

### 1.1 공통 원칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수 / 함수 | `camelCase` | `submissionId`, `getSagaStep()` |
| 클래스 / 인터페이스 / 타입 | `PascalCase` | `SubmissionService`, `SagaStep` |
| 상수 (불변 전역 값) | `UPPER_SNAKE_CASE` | `MAX_CODE_SIZE`, `REDIS_TTL` |
| Enum 이름 | `PascalCase` | `SagaStep`, `GithubSyncStatus` |
| Enum 값 | `UPPER_SNAKE_CASE` | `SagaStep.DB_SAVED`, `SagaStep.DONE` |
| 파일명 (TS) | `kebab-case` | `submission.service.ts`, `saga-orchestrator.ts` |
| 파일명 (Python) | `snake_case` | `analysis_service.py`, `circuit_breaker.py` |
| 환경변수 | `UPPER_SNAKE_CASE` | `RABBITMQ_URL`, `REDIS_HOST` |
| k8s 리소스명 | `kebab-case` | `submission-service`, `ai-analysis-worker` |
| DB 테이블명 | `snake_case` (복수형) | `submissions`, `drafts`, `problems` |
| DB 컬럼명 | `snake_case` | `saga_step`, `processing_locked` |
| RabbitMQ Exchange/Queue | `kebab-case` dot 구분 | `algosu.submissions`, `github.push.queue` |
| Redis 채널/키 | `colon 구분` | `submission:{id}:status` |

### 1.2 TypeScript 세부 규칙

```typescript
// ✅ 인터페이스 — 'I' 접두사 사용 금지
interface SubmissionRepository { ... }

// ✅ 타입 별칭 — 서술적 이름
type SagaStepTransition = {
  from: SagaStep;
  to: SagaStep;
};

// ✅ DTO — 접미사 명시
class CreateSubmissionDto { ... }
class SubmissionResponseDto { ... }

// ✅ 서비스/컨트롤러/레포지토리 — NestJS 접미사 규칙 준수
class SubmissionService { ... }
class SubmissionController { ... }
class SubmissionRepository { ... }

// ✅ 상수 파일 — constants 파일로 분리
// submission.constants.ts
export const SUBMISSION_QUEUE = 'github.push.queue';
export const MAX_CODE_BYTES = 100_000;

// ❌ 금지 — 매직 넘버 인라인 사용
if (code.length > 100000) { ... }  // 금지
if (code.length > MAX_CODE_BYTES) { ... }  // 허용
```

### 1.3 Python 세부 규칙

```python
# ✅ 함수/변수 — snake_case
def process_analysis_event(submission_id: str) -> AnalysisResult: ...

# ✅ 클래스 — PascalCase
class GeminiCircuitBreaker: ...

# ✅ 상수 — UPPER_SNAKE_CASE, 파일 상단 정의
MAX_RETRY_COUNT = 3
CIRCUIT_BREAKER_THRESHOLD = 0.5

# ✅ Pydantic 모델 — PascalCase + 접미사
class AnalysisRequestSchema(BaseModel): ...
class AnalysisResponseSchema(BaseModel): ...
```

---

## 2. 폴더 / 파일 구조

### 2.1 모노레포 최상위 구조

```
algosu-app/                          # 애플리케이션 모노레포
├── api-gateway/                     # Agent-01 Gatekeeper
├── submission-service/              # Agent-02 Conductor
├── problem-service/                 # Agent-05 Curator
├── github-worker/                   # Agent-03 Postman
├── ai-analysis-service/             # Agent-04 Sensei
├── frontend/                        # Agent-08 Herald
├── .github/
│   └── workflows/                   # CI/CD 파이프라인
├── .gitignore
└── README.md

algosu-infra/                        # 인프라 모노레포
├── k8s/
│   ├── api-gateway/
│   ├── submission-service/
│   ├── problem-service/
│   ├── github-worker/
│   ├── ai-analysis-service/
│   ├── frontend/
│   └── shared/                      # PostgreSQL, Redis, RabbitMQ
└── argocd/
    └── applications.yaml
```

### 2.2 NestJS 서비스 내부 구조 (공통)

```
{service-name}/
├── src/
│   ├── main.ts                      # 진입점
│   ├── app.module.ts
│   ├── {domain}/                    # 도메인 단위 폴더
│   │   ├── {domain}.module.ts
│   │   ├── {domain}.controller.ts
│   │   ├── {domain}.service.ts
│   │   ├── {domain}.repository.ts
│   │   ├── dto/
│   │   │   ├── create-{domain}.dto.ts
│   │   │   └── {domain}-response.dto.ts
│   │   ├── entities/
│   │   │   └── {domain}.entity.ts
│   │   └── {domain}.constants.ts
│   ├── common/
│   │   ├── filters/                 # 전역 예외 필터
│   │   ├── guards/                  # 인증 가드 (Internal API Key 등)
│   │   ├── interceptors/
│   │   └── decorators/
│   ├── config/
│   │   └── configuration.ts         # ConfigModule 설정
│   └── database/
│       └── migrations/              # TypeORM Migration 파일
│           └── {timestamp}-{description}.ts
├── test/
│   ├── unit/
│   └── e2e/
├── Dockerfile
├── .env.example                     # 실제 .env는 Git 커밋 금지
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

**submission-service 예시 (Conductor)**

```
submission-service/src/
├── submission/
│   ├── submission.module.ts
│   ├── submission.controller.ts
│   ├── submission.service.ts
│   ├── submission.repository.ts
│   ├── saga/
│   │   ├── saga-orchestrator.ts
│   │   └── saga.constants.ts        # SagaStep enum 등
│   ├── draft/
│   │   ├── draft.service.ts
│   │   └── draft.entity.ts
│   ├── dto/
│   └── entities/
│       └── submission.entity.ts
└── internal/                        # 타 서비스가 호출하는 Internal API
    └── internal.controller.ts       # GET /internal/submissions/:id
```

### 2.3 FastAPI 서비스 내부 구조 (ai-analysis-service)

```
ai-analysis-service/
├── app/
│   ├── main.py                      # FastAPI 진입점
│   ├── core/
│   │   ├── config.py                # 환경변수 / 설정
│   │   └── circuit_breaker.py       # cockatiel 래핑
│   ├── analysis/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py               # Pydantic 모델
│   ├── messaging/
│   │   └── consumer.py              # RabbitMQ 소비자 (prefetch=2)
│   └── internal/
│       └── submission_client.py     # Submission Service Internal API 호출
├── tests/
├── Dockerfile
├── requirements.txt
├── pyproject.toml                   # Python 도구 설정 통합 (팀 합의 후)
└── .env.example
```

### 2.4 Next.js 프론트엔드 구조 (frontend)

```
frontend/
├── src/
│   ├── app/                         # App Router
│   │   ├── layout.tsx               # SSE Context Provider 위치
│   │   ├── (auth)/
│   │   └── submissions/
│   │       └── [id]/
│   │           └── page.tsx
│   ├── components/
│   │   ├── submission/
│   │   │   ├── SubmissionEditor.tsx
│   │   │   └── SagaStatusDisplay.tsx
│   │   └── common/
│   │       └── NotificationBell.tsx
│   ├── hooks/
│   │   ├── useSSE.ts                # EventSource 연결 관리
│   │   └── useAutoSave.ts           # Draft 자동 저장
│   ├── lib/
│   │   └── api/                     # API 클라이언트
│   └── contexts/
│       └── SSEContext.tsx           # 전역 SSE 상태 관리
├── public/
├── Dockerfile
└── package.json
```

### 2.5 파일명 규칙 요약

| 파일 유형 | 규칙 | 예시 |
|-----------|------|------|
| NestJS 모듈 | `{domain}.module.ts` | `submission.module.ts` |
| NestJS 컨트롤러 | `{domain}.controller.ts` | `submission.controller.ts` |
| NestJS 서비스 | `{domain}.service.ts` | `submission.service.ts` |
| TypeORM 마이그레이션 | `{timestamp}-{PascalDesc}.ts` | `1700000000000-CreateSubmissions.ts` |
| TypeORM 엔티티 | `{domain}.entity.ts` | `submission.entity.ts` |
| DTO | `{action}-{domain}.dto.ts` | `create-submission.dto.ts` |
| 상수 | `{domain}.constants.ts` | `submission.constants.ts` |
| Python 모듈 | `{module_name}.py` | `circuit_breaker.py` |
| React 컴포넌트 | `PascalCase.tsx` | `SagaStatusDisplay.tsx` |
| React 훅 | `use{Name}.ts` | `useSSE.ts` |
| k8s 매니페스트 | `{resource-type}.yaml` | `deployment.yaml`, `service.yaml` |

---

## 3. Git 커밋 / 브랜치 규칙

### 3.1 브랜치 전략

```
main                                 # 배포 기준 브랜치 (보호 브랜치)
└── feature/{agent-id}/{기능명}       # 기능 개발
└── fix/{agent-id}/{버그명}           # 버그 수정
└── chore/{agent-id}/{작업명}         # 설정, 빌드, 문서 등
```

**브랜치명 규칙**

```
feature/agent-02/saga-orchestrator
feature/agent-01/jwt-middleware
fix/agent-03/dlq-retry-logic
chore/agent-06/qemu-buildx-setup
```

- 슬래시(`/`) 이후 소문자 kebab-case
- 브랜치명에 이슈 번호 포함 권장: `feature/agent-02/saga-orchestrator-#12`
- `main` 직접 push 금지 — 반드시 PR을 통해 병합

### 3.2 커밋 메시지 규칙 (Conventional Commits)

**형식**

```
{type}({scope}): {subject}

{body}        ← 선택. 변경 이유·맥락 설명
{footer}      ← 선택. 이슈 참조, BREAKING CHANGE 명시
```

**type 목록**

| type | 사용 시점 |
|------|-----------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 기능 변경 없는 코드 개선 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정, 의존성, CI 변경 |
| `docs` | 문서 변경 |
| `style` | 코드 포맷팅(기능 변경 없음) |
| `perf` | 성능 개선 |
| `revert` | 커밋 되돌리기 |

**scope**: 서비스명 또는 도메인명

```
feat(submission): Saga Orchestrator 초기 구현
fix(github-worker): TOKEN_INVALID 즉시 DLQ 진입 처리
chore(ci): QEMU/Buildx ARM 크로스 컴파일 파이프라인 추가
feat(gateway): SSE 엔드포인트 query param JWT 인증 구현
refactor(problem): 마감 시간 캐시 미스 시 DB 직접 조회로 변경
```

**금지 패턴**

```
# ❌ 금지
git commit -m "fix"
git commit -m "수정"
git commit -m "작업중"
git commit -m "WIP"

# ✅ WIP 상태가 필요한 경우
git commit -m "chore(submission): WIP — Saga 재개 로직 구현 중 (미완료)"
```

### 3.3 PR(Pull Request) 규칙

- **PR 제목**: 커밋 메시지 형식과 동일 (`feat(submission): ...`)
- **PR 본문**: 아래 템플릿 사용

```markdown
## 변경 내용
<!-- 무엇을 왜 변경했는지 -->

## 관련 Oracle 결정
<!-- 해당되는 경우: C-02, H-01 등 -->

## 테스트 확인
- [ ] 단위 테스트 통과
- [ ] 로컬 E2E 확인

## 스크린샷 (UI 변경 시)
```

- PR은 최소 1명의 리뷰 승인 후 병합
- 충돌 해소 책임: PR 작성자
- `main` 병합 후 브랜치 즉시 삭제

### 3.4 이미지 태그 규칙

```
# ✅ 필수
ghcr.io/algosu/{service-name}:main-{git-sha}

# ❌ 절대 금지
ghcr.io/algosu/{service-name}:latest
```

---

## 4. TypeScript / ESLint / Prettier (NestJS · Next.js)

### 4.1 tsconfig.json 기준 (strict 모드)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 4.2 ESLint 설정 기준 (`.eslintrc.js`)

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { project: 'tsconfig.json', sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // ── 타입 안전성 (strict 원칙) ──────────────────────────────
    '@typescript-eslint/no-explicit-any': 'error',          // any 금지
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error', // 반환 타입 명시
    '@typescript-eslint/explicit-module-boundary-types': 'error',

    // ── 코드 품질 ──────────────────────────────────────────────
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-floating-promises': 'error',     // await 누락 방지
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',

    // ── NestJS 패턴 ────────────────────────────────────────────
    '@typescript-eslint/no-inferrable-types': 'off',        // 명시적 타입 허용
  },
};
```

**예외 처리 기준**: 불가피하게 `any`가 필요한 경우 인라인 주석으로 사유 명시

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = JSON.parse(message) as any; // RabbitMQ 원본 메시지 파싱 — 검증 후 즉시 타입 단언
```

### 4.3 Prettier 설정 (`.prettierrc`)

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 4.4 TypeScript 코드 작성 규칙

**의존성 주입 및 인터페이스**

```typescript
// ✅ 인터페이스로 의존성 추상화 — 테스트 용이성 확보
@Injectable()
export class SagaOrchestrator {
  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly messagingService: MessagingService,
  ) {}
}
```

**비동기 처리**

```typescript
// ✅ async/await 사용. Promise 체이닝 금지
async createSubmission(dto: CreateSubmissionDto): Promise<SubmissionResponseDto> {
  const submission = await this.submissionRepository.save(dto);
  await this.messagingService.publishGithubPush(submission.id);  // DB 업데이트 → MQ 발행 순서 고정
  return SubmissionResponseDto.from(submission);
}

// ❌ 금지 — Promise 체이닝
this.repo.save(dto)
  .then(s => this.mq.publish(s.id))
  .catch(e => ...);
```

**에러 처리**

```typescript
// ✅ NestJS 예외 클래스 사용
throw new ConflictException('이미 진행 중인 제출이 존재합니다.');
throw new NotFoundException(`submission ${id} not found`);

// ✅ 외부 서비스 호출 시 try/catch 필수
try {
  await this.geminiClient.analyze(code);
} catch (error: unknown) {
  if (error instanceof GeminiApiError) {
    this.logger.error('Gemini API 호출 실패', { submissionId, error });
    throw error;
  }
  throw new InternalServerErrorException();
}
```

**환경변수**

```typescript
// ✅ ConfigService를 통해 접근. process.env 직접 접근 금지
@Injectable()
export class AppConfig {
  constructor(private readonly configService: ConfigService) {}

  get rabbitmqUrl(): string {
    return this.configService.getOrThrow<string>('RABBITMQ_URL');
  }
}

// ❌ 금지
const url = process.env.RABBITMQ_URL;
```

**로깅**

```typescript
// ✅ NestJS Logger 사용. console.log 금지
private readonly logger = new Logger(SubmissionService.name);

this.logger.log(`Saga started: ${submissionId}`);
this.logger.error('Saga 재개 실패', { submissionId, error });
this.logger.warn(`Rate limit 근접: userId=${userId}`);
```

---

## 5. Python 코드 스타일 (FastAPI — Sensei)

> ⚠️ **도구 선택(Ruff vs Black+Flake8)은 팀 합의 후 `pyproject.toml`에 확정한다.**  
> 아래는 도구 선택과 무관하게 적용되는 공통 코드 규칙이다.

### 5.1 공통 코드 규칙

**타입 힌트 필수**

```python
# ✅ 모든 함수에 타입 힌트 명시
async def process_analysis(
    submission_id: str,
    circuit_breaker: GeminiCircuitBreaker,
) -> AnalysisResult:
    ...

# ❌ 금지 — 타입 힌트 없음
async def process_analysis(submission_id, circuit_breaker):
    ...
```

**Pydantic 모델로 입출력 검증**

```python
# ✅ RabbitMQ 메시지 수신 즉시 Pydantic으로 파싱
class AnalysisEventSchema(BaseModel):
    submission_id: UUID
    study_id: int
    timestamp: datetime

    model_config = ConfigDict(frozen=True)  # 불변 객체

async def on_message(raw: dict) -> None:
    event = AnalysisEventSchema.model_validate(raw)
    await analysis_service.process(event.submission_id)
```

**환경변수**

```python
# ✅ pydantic-settings BaseSettings 사용
class Settings(BaseSettings):
    rabbitmq_url: str
    redis_host: str
    gemini_api_key: str
    submission_service_url: str

    model_config = SettingsConfigDict(env_file='.env')

settings = Settings()

# ❌ 금지 — os.environ 직접 접근
import os
url = os.environ['RABBITMQ_URL']
```

**에러 처리**

```python
# ✅ 구체적인 예외 타입 명시
try:
    result = await gemini_client.analyze(code)
except GeminiRateLimitError:
    # 429 → DELAYED + 재시도
    await publish_status(submission_id, AnalysisStatus.DELAYED)
except GeminiClientError:
    # 400 → FAILED
    await publish_status(submission_id, AnalysisStatus.FAILED)
except GeminiServerError:
    # 5xx → Retry 3회 후 DELAYED
    raise

# ❌ 금지 — 광범위한 예외 처리
except Exception:
    pass
```

**로깅**

```python
# ✅ structlog 또는 logging 표준 모듈 사용. print 금지
import logging
logger = logging.getLogger(__name__)

logger.info("분석 시작", extra={"submission_id": str(submission_id)})
logger.error("Gemini API 오류", extra={"submission_id": str(submission_id), "status_code": 500})

# ❌ 금지
print(f"분석 시작: {submission_id}")
```

### 5.2 팀 합의 시 선택지 (pyproject.toml)

**옵션 A — Ruff (통합 권장)**

```toml
[tool.ruff]
line-length = 100
target-version = "py311"
select = ["E", "F", "I", "N", "UP", "ANN", "B", "SIM"]
ignore = ["ANN101", "ANN102"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

**옵션 B — Black + Flake8**

```toml
[tool.black]
line-length = 100
target-version = ["py311"]

[tool.flake8]
max-line-length = 100
extend-ignore = ["E203", "W503"]
```

> 합의 전까지 두 옵션 모두 적용하지 않는다. **합의 결과를 `pyproject.toml`에 커밋 후 Oracle 브로드캐스트.**

---

## 6. 공통 금지 사항

아래 항목은 서비스 언어·Agent에 관계없이 **전체 코드베이스에서 엄격히 금지**한다.

| 금지 항목 | 이유 |
|-----------|------|
| `latest` 이미지 태그 | 롤백 불가. 반드시 `main-{git-sha}` 사용 |
| 타 서비스 DB 직접 접근 | Database per Service 핵심 원칙 위반 |
| 환경변수 하드코딩 | 보안 취약점. `.env.example`에 키만 남기고 실제 값은 k3s Secret |
| `.env` 파일 Git 커밋 | 보안 사고 방지. `.gitignore`에 반드시 포함 |
| `console.log` / `print` 운영 코드 사용 | 구조화 로거(NestJS Logger / Python logging) 사용 |
| 미완료 Saga 상태에서 타 서비스 DB 쓰기 | Conductor가 Saga 상태 Single Source of Truth |
| 비동기 함수에서 `await` 누락 | ESLint `no-floating-promises`로 자동 감지 |
| TypeScript `any` 무분별 사용 | strict 원칙. 불가피한 경우 주석 필수 |
| `TODO` 주석 방치 | PR 병합 전 해소 또는 이슈 등록 후 주석에 이슈 번호 명시: `// TODO(#42): ...` |
| `main` 브랜치 직접 push | 반드시 PR 경유 |

---

> **문서 버전**: v1.0  
> **다음 업데이트**: Python 도구 팀 합의 완료 후 5.2항 확정 반영
