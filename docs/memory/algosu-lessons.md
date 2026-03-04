# AlgoSu 작업 시 핵심 학습

## CI/CD 작업 시 핵심 학습

### GitHub Actions PR 권한 (2026-03-03)
- **dorny/paths-filter@v3**: PR 이벤트에서 변경 파일 목록을 GitHub API로 조회 → `pull-requests: read` 권한 필수. 없으면 "Resource not accessible by integration" 에러
- **wagoid/commitlint-github-action@v6**: PR 커밋 목록 조회에 `pull-requests: read` 필요 (동일 에러)
- **commitlint config 확장자**: v6부터 `.js` 미지원 → `.mjs`로 전환 + `module.exports` → `export default`
- **Next.js next lint CI**: `.eslintrc.json` 없으면 인터랙티브 설정 프롬프트 → CI 행. `extends: ["next/core-web-vitals", "next/typescript"]`로 사전 생성 필수
- **gitleaks-action vs CLI**: `gitleaks/gitleaks-action@v2`는 private repo에 유료 라이선스 필요 → CLI 직접 설치로 우회
- **gitleaks false positive**: localhost AMQP, 테스트 픽스처(test-jwt-secret 등) → `.gitleaks.toml` allowlist paths + regexes로 해결
- **GHA matrix + detect-changes 조합**: job-level `if`로 matrix변수 참조 불가 → step-level `if` + skip check 패턴 사용
- **ESLint no-control-regex**: 로그 sanitize 코드에서 제어문자 정규식 의도적 사용 → `.eslintrc.js`에서 off 필수
- **identity npm ci 실패**: package.json에 devDeps 추가 후 package-lock.json 미갱신 → `npm install --package-lock-only` 필수
- **ruff F401 threading**: worker.py에서 미사용 import — threading은 main.py에서만 사용. noqa 주석이나 future annotations 조작 불필요, 단순 제거로 해결
- **Trivy arm64**: Oracle ARM 프리티어 대상 → `--platform linux/arm64` 필수, 미지정 시 GHA(amd64)에서 이미지 찾기 실패
- **FastAPI 메이저 업그레이드 시 의존성 체인**: fastapi ↔ starlette ↔ pydantic 버전 호환 주의. fastapi 0.128.8은 pydantic>=2.7.0 필요

## k3d 배포 시 핵심 학습
- **Gateway CatchAllController** (`@All('*')`)가 `/metrics` 선점 → NestJS import 순서 중요 (MetricsModule → ProxyModule)
- **Promtail kubernetes_sd**: `__path__` relabel 필수, 없으면 타겟 발견해도 파일 tailing 안 함
- **CRI 로그 포맷**: k8s는 `<ts> <stream> <flags> <json>` 형태로 감싸므로 `- cri: {}` stage 필수
- **Prometheus PVC**: RollingUpdate 시 TSDB lock 충돌 → Recreate 전략 필수 (aether-gitops에 반영 완료)
- **Loki structured_metadata**: Loki 2.9 + Promtail 2.9에서 `structured_metadata` 스테이지 사용 시 Loki `limits_config`에 `allow_structured_metadata: true` 필수. `kubectl apply`는 ConfigMap data 내 YAML 라인 추가가 무시될 수 있음 → `kubectl replace -f` 사용
- **Promtail 미소비 추출값**: json stage에서 추출한 키를 labels/output/timestamp로 소비하지 않으면 Promtail 2.9+가 자동으로 structured_metadata로 전송 → Loki가 거부. 사용하지 않는 키는 json expressions에서 아예 제거
- **Prometheus alertname 중복**: 같은 그룹 내 동일 alertname은 Alertmanager 라우팅/중복제거에서 혼선 → `HighErrorRateGateway`, `HighErrorRateIdentity` 등 서비스별 고유명 사용
- **Docker build prod_node_modules**: tsconfig.json에 `"exclude": ["prod_node_modules"]` 필수

## Trivy + Docker + npm 학습 (2026-02-28)
- **npm `--only=production` deprecated**: npm 9+/Node 20+에서 무시됨 → `--omit=dev` 사용 필수
- **Trivy가 npm 번들 deps 검출**: node:20-alpine 내 `/usr/local/lib/node_modules/npm/node_modules/`에 tar, glob, minimatch, cross-spawn 등 취약 버전 포함 → 프로젝트 deps가 아닌 npm 자체 문제
- **해결법**: runner 스테이지에서 `rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx` — 프로덕션 런타임에 npm 불필요
- **npm overrides 범위**: 글로벌 override는 dev deps까지 영향 → Jest test-exclude 등과 충돌 가능. scoped override (`"typeorm": {"glob": "^10.5.0"}`)로 범위 제한 가능
- **Gateway Dockerfile 구조 차이**: Gateway는 production 스테이지에서 npm ci 실행 (다른 서비스는 builder에서 prod_node_modules 복사). npm 삭제는 npm ci 이후에 위치해야 함
- **Docker GHA cache**: `cache-from: type=gha` 사용 시 BuildKit 레이어 캐시 주의. lockfile 변경 시 COPY 레이어 해시 변경으로 npm ci 재실행됨 (정상 동작)

## UI 통일 작업 학습 (2026-03-03)
- **레거시 CSS 변수 런타임 깨짐**: globals.css에 미정의 변수(`--surface`, `--border-color`, `--shadow-light`, `--color-*`)는 fallback 없이 initial 값으로 렌더링 → 배경 투명, 테두리 없음. 마이그레이션 누락 컴포넌트 주의 (SubmissionStatus.tsx 사례)
- **Tailwind 미정의 클래스**: `rounded-m`처럼 tailwind.config에 없는 키는 border-radius 미적용. `rounded-md`(=`var(--radius-m)`) 사용
- **인라인 style vs Tailwind**: 동적 값(JavaScript 변수 기반 width%, color 계산)은 인라인 style 유지. 정적 px/% 값만 Tailwind arbitrary value로 전환
- **모달 오버레이 통일**: `bg-black/50` 하드코딩 → 다크모드에서 과도하게 어두움. 전 프로젝트 표준 `bg-bg/80 backdrop-blur-sm` + `shadow-modal` 사용
- **h1 타이포그래피 표준**: 전 서비스 `text-[22px] font-bold tracking-tight text-text` (14/14 페이지 기준). 예외 발생 시 즉시 통일
- **Palette+Scout 분업 패턴**: 디자인 토큰 수정(Palette) + 인라인 스타일 전환(Scout) 병렬 처리 → 상호 더블체크 사이클로 누락 최소화

## Agent Team 운영 학습 (2026-02-28)
- **worktree 코드 유실**: `isolation: "worktree"`로 Agent 투입 후 TeamDelete 호출 시, merge 안 된 worktree 브랜치까지 삭제됨 → 모든 코드 유실
- **교훈**: worktree Agent 작업 완료 후 반드시 main에 merge → 그 다음 TeamDelete
- **PM 지시**: TF 외 범용 Agent 투입 금지. 반드시 skill 로드하여 페르소나+규칙 적용 상태로 작업
- **범용 Agent 문제**: skill 없이 투입하면 보안 체크, 모니터링 로그 규칙, 코드 컨벤션 보장 불가

## OCI k3s 배포 시 핵심 학습 (2026-03-03)
- **이미지 네이밍 불일치**: CI에서 `algoso-*`로 빌드, Kustomize에서 `algosu-*` 참조 → docker tag로 리태깅. 근본 해결은 CI 이미지명 통일
- **Redis URL 특수문자**: `openssl rand -base64` 패스워드에 `+` 포함 → Python urllib가 포트로 파싱 → `openssl rand -hex` 사용 필수 (URL-safe)
- **k3s vs k3d Traefik**: k3d는 traefik 자동 포함, k3s는 미포함 → Helm으로 별도 설치 필요
- **KUBECONFIG 환경변수**: k3s 설치 후 `export KUBECONFIG=/etc/rancher/k3s/k3s.yaml` 필수 (kubeseal, kubectl 모두)
- **ArgoCD CRD 크기 제한**: 일반 `kubectl apply` 실패 (262144 bytes annotation 제한) → `--server-side --force-conflicts` 사용

## 테스트 수정 시 핵심 학습 (2026-03-03)
- **ioredis mock `.on()`**: OAuthService/StudyService 생성자에서 `this.redis.on('error', ...)` 호출 → mock에 `on: jest.fn().mockReturnThis()` 필수
- **GeminiClient → ClaudeClient 전환**: test 파일명은 유지되나 내부 mock 대상 변경 (`src.gemini_client.genai` → `src.claude_client.anthropic`), RateLimitError를 실제 Exception 서브클래스로 mock 해야 catch 정상 작동
- **config 모듈 top-level validation**: `config.ts`에서 모듈 로드 시 `getRequired()` 호출 → jest.mock으로 모듈 자체를 mock해야 테스트 suite 로드 가능
- **HTTP 메서드 변경**: `_report_result()`가 POST→PATCH로 변경됨 → 테스트에서 `http_client.patch` assert 필요

## PM 라이브 테스트 핫픽스 학습 (2026-03-03)
- **Gateway INTERNAL_API_KEY 누락**: sealed-secrets-template에 Gateway의 `INTERNAL_API_KEY` 미정의 → downstream 서비스(Problem/Submission)가 `/internal/*` 호출 시 Gateway에서 `configService.getOrThrow('INTERNAL_API_KEY')` 500 발생 → 멤버십 확인 전면 실패
  - 해결: `kubectl get secret → python3 base64 encode → kubectl apply` 로 직접 주입
  - 키 구조: Gateway `INTERNAL_API_KEY` = downstream 서비스들의 `INTERNAL_KEY_GATEWAY` (동일값)
- **k3s 수동 배포 시 주의사항**:
  - `kubectl rollout restart`는 이미지 풀 시도 → GHCR 미인증이면 실패. 대신 `kubectl delete pods` → 기존 ReplicaSet이 재생성
  - initContainer 이미지는 `kubectl set image`로 업데이트 안됨 → `kubectl patch --type='json'`로 별도 패치 필요
  - deployment 이름: `submission-service` (NOT `submission`), `frontend` (NOT `frontend-service`)
- **에러 메시지 통일**: 같은 Guard 패턴이라도 서비스별로 다른 문구 사용 가능 → 신규 Guard 작성 시 기존 서비스 문구와 일치시키기
- **Gitleaks CI**: `.claude/memory/*.md`, `scripts/e2e-*.sh` 경로가 false positive → `.gitleaks.toml` allowlist paths에 추가
- **프론트엔드 _currentStudyId**: `StudyContext`에서 `setCurrentStudyIdForApi()` 호출 → api.ts의 `_currentStudyId` 설정 → `X-Study-ID` 헤더 전송. `currentStudyId`가 null이면 헤더 미전송 → downstream guard 실패

## Week 1 안정화 학습 (2026-03-04)
- **GHCR Fine-grained vs Classic PAT**: Fine-grained token은 `read:packages` 스코프 미지원 → GHCR pull에 **Classic PAT** 필수 (`read:packages` 스코프 선택)
- **sharp ARM64 네이티브 모듈 크래시**: `--platform=$BUILDPLATFORM`(x86) builder에서 설치된 sharp의 네이티브 바인딩(libvips)이 ARM64 runner에서 `Error: Cannot find module '../build/Release/sharp-linux-arm64v8.node'` 크래시 → production 스테이지에서 `npm rebuild sharp` 추가하여 ARM64용 바인딩 재컴파일 후 npm 삭제. Gateway만 sharp 사용, 나머지 6개 서비스는 순수 JS로 영향 없음

## CI/CD 정비 학습 (2026-03-04)
- **QEMU ARM64 SIGILL**: `--platform linux/arm64`로 빌드 시 npm ci에서 `signal 4 (Illegal instruction)` 크래시 → builder에 `--platform=$BUILDPLATFORM` 추가하여 네이티브 빌드, runner만 ARM64
- **prod_node_modules TypeScript 스캔**: builder에서 `prod_node_modules`를 `/app`에 생성하면 `nest build`(tsc)가 minio/rxjs/pg 등의 `.ts` 소스 파일 111개 에러 → `/tmp`로 이동하여 빌드 컨텍스트에서 격리
- **GitHub Actions 러너 할당 실패**: Private repo 무료 할당량 소진 → runner_name=""", steps=0, 2초만에 failure. Public 전환으로 해결 (Actions 무제한)
- **Dependabot 메이저 범프 폭탄**: 설정 없이 방치하면 NestJS 10→11, Tailwind 3→4 등 대량 PR 생성 → `semver-major` 차단 필수
- **aether-gitops kustomization.yaml 잘림**: CI의 Python yaml.dump가 비정상 종료 시 파일 잘림 가능 → 정기 검증 필요
- **gh run rerun --failed**: 전체 workflow가 아닌 실패 job만 재실행 가능 (빌드 시간 절약)

## Week 2 Sprint 학습 (2026-03-04)

### Loki 2.9.x → 3.x 마이그레이션
- **`shared_store` 필드 제거**: Loki 3.x에서 `boltdb_shipper`, `tsdb_shipper`, `compactor` 내 `shared_store` 필드가 삭제됨. 설정 파싱 시 `field shared_store not found` 에러 발생
- **`delete_request_store` 필수**: retention 활성화 시 `compactor.delete_request_store` 미지정이면 에러. `filesystem` 또는 적절한 store 지정 필수
- **`allow_structured_metadata` + schema v13**: structured metadata 저장은 schema v13(tsdb) 이상에서만 가능. v11이 active인 상태에서 `allow_structured_metadata: true` 설정하면 에러. v13 schema 추가 후에도 시작일(from) 이전이면 v11이 active → `false`로 설정해야 안전
- **ConfigMap 변경 후 Pod 재시작**: `kubectl apply`로 ConfigMap 갱신해도 기존 Pod는 캐시된 ConfigMap 사용 → `kubectl rollout restart` 필수
- **이중 schema 운용**: v11(boltdb-shipper)과 v13(tsdb) 동시 설정 가능. `from` 날짜 기준으로 자동 전환. 기존 데이터 유실 없음

### Entity toJSON()으로 내부 PK 스트리핑
- **IDOR 방어**: auto-increment `id`를 API 응답에서 제거해야 함. TypeORM entity에 `toJSON()` 메서드 추가하여 `{ id, ...내부FK }` 구조분해로 제거
- **패턴**: `toJSON() { const { id, submission, ...rest } = this as Record<string, unknown>; return rest; }` — NestJS의 `ClassSerializerInterceptor` 없이도 `JSON.stringify()` 시 자동 적용

### psql 변수 바인딩으로 SQL injection 방어
- **위험**: Shell heredoc 내 `$VARIABLE` 확장은 SQL injection 가능. 특히 패스워드에 `'; DROP TABLE` 등 포함 시
- **해결**: psql `-v "varname=value"` 플래그로 변수 전달 + SQL 내 `:'varname'` 문법으로 안전 바인딩. heredoc은 반드시 `<<-'EOSQL'` (quoted)로 셸 확장 차단
- **패턴**: `psql -v ON_ERROR_STOP=1 -v "pw=${PG_PASSWORD}" --username "$POSTGRES_USER" <<-'EOSQL'` + `CREATE USER foo WITH PASSWORD :'pw';`

### Gateway proxy 에러 전파
- **문제**: Gateway proxyToSubmission()에서 downstream 4xx/5xx 응답을 HTTP 200으로 wrapping하여 반환 → 프론트엔드가 정확한 에러 상태코드를 받지 못함
- **해결**: `throw new HttpException(errorData.message, errorData.statusCode ?? response.status)` 로 정확한 상태코드 전파. catch 블록에서 `HttpException`은 재throw, 나머지만 500 처리

### kube-state-metrics RBAC 최소 권한
- **원칙**: kube-state-metrics에 `secrets` 리소스 list/watch 권한은 불필요하며 보안 리스크. 메트릭에 secret 이름이 노출될 수 있음
- **실무**: 필요한 리소스만 명시적 나열 (pods, deployments, services 등). 추후 필요 시 점진 추가

## OAuth 핫픽스 학습 (2026-03-04)

### SealedSecret URL 불일치
- **문제**: SealedSecret에 `OAUTH_CALLBACK_URL=http://localhost`, `FRONTEND_URL=http://localhost` 하드코딩 → OAuth 콜백 URL이 `http://localhost/auth/oauth/naver/callback`으로 이중 경로 생성
- **교훈**: ArgoCD가 SealedSecret을 관리하므로, `kubectl patch secret`으로 수동 수정해도 ArgoCD selfHeal이 원복함 → **반드시 aether-gitops의 SealedSecret YAML을 kubeseal로 재생성 후 push**
- **확인법**: `kubectl exec -n algosu deploy/gateway -- env | grep -E 'OAUTH|FRONTEND|ALLOWED'`

### ArgoCD selfHeal과 수동 배포의 충돌
- **문제**: `kubectl set image`로 이미지 태그를 수동 변경해도, ArgoCD selfHeal이 aether-gitops의 kustomization.yaml 태그로 원복
- **교훈**: ArgoCD 관리 리소스는 절대 `kubectl set image` 사용 금지 → aether-gitops `overlays/prod/kustomization.yaml`의 `images[].newTag` 수정 + `git push` + ArgoCD hard refresh
- **Hard refresh 명령**: `kubectl annotate application algosu -n argocd argocd.argoproj.io/refresh=hard --overwrite`

### 이미지 네이밍 규칙 (hyphen vs slash)
- **문제**: `docker build -t ghcr.io/tpals0409/algosu/gateway` (slash) 빌드 → k8s는 `ghcr.io/tpals0409/algosu-gateway` (hyphen) 참조 → ImagePullBackOff
- **교훈**: 반드시 kustomization.yaml의 `images[].name` 패턴과 동일하게 빌드. CI에서는 `algosu-{service}` 패턴 사용

### OAuth 콜백 에러 핸들링 패턴
- **문제**: OAuth 콜백에서 에러 발생 시 JSON 응답 반환 → 브라우저에 raw JSON 표시 (뒤로가기, state 만료 등)
- **해결**: 모든 에러를 `res.redirect(frontendUrl/callback#error=...)` 형태로 프론트엔드에 전달
- **패턴**: `@Query('error') oauthError` 파라미터 추가, try-catch로 감싸고 `BadRequestException`은 사용자 메시지 전달, 나머지는 `auth_failed`
- **프론트엔드**: URL fragment `#error=...`에서 에러 추출, 한국어 메시지 포함 시 직접 표시, 아니면 기본 메시지

### 1계정 1OAuth 정책 강제
- **문제**: 같은 이메일로 다른 OAuth 프로바이더 로그인 시 기존 계정 데이터 덮어쓰기 (provider 변경)
- **해결**: `upsertUser()`에서 `user.oauth_provider !== provider` 시 `BadRequestException` throw
- **UX**: "이 이메일은 이미 Google(으)로 가입되어 있습니다. 기존 계정으로 로그인해주세요." 메시지를 프론트엔드까지 전달

### Google OAuth PLACEHOLDER 크레덴셜
- **교훈**: 테스트 환경에서 `CLIENT_ID_HERE` 등 PLACEHOLDER로 설정하면 OAuth 시작 URL 생성은 성공하지만 Google 401 반환 → SealedSecret에 실제 값 설정 필수
- **확인법**: `kubectl exec -n algosu deploy/gateway -- env | grep GOOGLE_CLIENT_ID` (실제 ID인지 PLACEHOLDER인지 확인)

## Phase 3 Dual Write 학습
- **TypeORM 다중 연결**: `@InjectRepository(Entity, CONNECTION_NAME)` + `TypeOrmModule.forFeature([Entity], CONNECTION_NAME)` 패턴
- **DualWriteService 패턴**: 모드별 read/write 라우팅, 신 DB 쓰기 실패는 로그만 (구 DB 트랜잭션 영향 안줌)
- **Reconciliation**: md5(row_to_json) checksum 비교, @Cron('0 * * * *') 매시간 실행

## 5라운드 오디트 스프린트 핵심 학습 (2026-03-04)

### UI 토큰 패턴 (확정)
- **배경**: `-soft` 토큰 사용 (`bg-success-soft`, `bg-primary-soft`) — CSS 변수에 이미 rgba 포함
- **테두리/그라디언트**: `/10`, `/30` opacity modifier 유지 가능 (디자인 시스템 의도적 허용)
- **SVG data URI**: CSS 변수 사용 불가 (DOM 외부) → `globals.css`에 `.select-chevron` 유틸리티 정의 + `.dark .select-chevron` 오버라이드로 테마 반응형 구현

### httpOnly Cookie 환경 프론트엔드
- **SSE**: `new EventSource(url, { withCredentials: true })` — localStorage 토큰 전달 불가, 쿠키 자동 포함
- **사용자 식별**: `getCurrentUserId()` (localStorage 기반) → 항상 null. 서버 API 멤버 목록에서 이메일 매칭으로 ID 확보
- **GitHub 연동 상태**: localStorage `getGitHubConnected()` → 서버 프로필 `profile.github_connected` 기반으로 전환

### NestJS 보안 패턴
- **InternalKeyGuard 타이밍 공격 방지**: `Buffer.from(key)` 직접 비교 시 키 길이 누출 → 양쪽 모두 SHA-256 해시 후 `timingSafeEqual` 비교
- **HttpException 재throw**: proxy 컨트롤러 catch에서 `if (error instanceof HttpException) throw error;` 필수 — 없으면 다운스트림 403/404가 500으로 변환됨
- **SSE JWT exp 체크**: `verifyToken()`에서 `payload['exp']` 부재 시 명시적 거부 필요 (JwtMiddleware와 동작 일치)

### K8s 오탐 패턴
- **`$(ENV_VAR)` in exec probes**: K8s는 command/args 배열에서 `$(VAR)` 구문으로 환경 변수 치환 지원. 쉘 구문이 아님 — 정상 동작
- **RabbitMQ prometheus plugin**: 3.8+ base 이미지에 번들됨. management 이미지 불필요
- **initContainer 리소스**: 마이그레이션용 initContainer는 메인 컨테이너보다 낮은 리소스 설정 정상

### Agent 오탐 필터링 원칙
- 운영 환경에서 정상 동작 중인 인프라 YAML은 agent 지적에도 변경 금지
- 코드 확인 전 agent 보고 맹신 금지 (R4: create-submission.dto.ts MaxLength 이미 존재, studies/create 중복클릭 방지 이미 구현)
- R5 최종 검증 단계에서 회귀 0건 확인이 핵심 품질 게이트
