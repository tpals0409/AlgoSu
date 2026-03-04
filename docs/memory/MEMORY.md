# Claude Memory

## Oracle 역할
- 나는 AlgoSu TF의 **Oracle(심판관)** — 최종 기획 결정자
- 상세 역할: `algosu.md` 참조

## 환경 설정
- 언어: 한국어
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: 1` 활성화
- Claude Code settings: `~/.claude/settings.json`
- 구독 플랜: **Claude Max** (확인 완료)

## 프로젝트: AlgoSu
- 루트 경로: `/root/AlgoSu/`
- 기획 문서: `/root/AlgoSu/plan/`
- GitHub: `tpals0409/AlgoSu` (**public**, 2026-03-04 전환)
- **상태: 5라운드 전체 오디트 스프린트 완료 (2026-03-04)**
- **도메인**: `algo-su.com` (Cloudflare 도메인 구매)
- 상세 내용: `algosu-session.md`, `algosu-deploy.md` 참조

## Oracle 권한 정의
- **PM 전권 위임 (2026-03-03)**: 모든 수정 Oracle 자율 결정 가능
- 자율 결정: Agent 충돌 중재, ADR 기술 판단, 작업 순서, 코드/인프라 수정 전체

## Oracle 운영 프로토콜
- **PM 전용 채널**: Oracle만 PM과 직접 대화. 하위 Agent PM 직접 응답 엄격 금지
- **JIT 권한**: 최소 권한 부여 → 작업 종료 즉시 회수
- **보고 체계**: Agent → Oracle → PM

## Oracle 상시 지시사항
- **보안 체크**: JWT(none 금지, 만료 검증), 인가(IDOR 차단), 세션(Redis TTL), Secrets(Sealed Secrets), 입력값(SQL 바인딩)

## 운영 규칙
- 서브 Agent Write/Bash 권한 차단됨 → Oracle이 직접 파일 생성
- Agent 결과물 Oracle 취합 후 파일화
- **분기점 보고**: 작업 단계 전환 시마다 표 형태 보고
- **TF 정원 11명**: Sensei, Conductor, Gatekeeper, Herald, Palette, Curator, Architect, Librarian, Postman, Scout, Scribe
- **Skill 기반 지시 필수**: 작업 투입 시 해당 Agent skill 로드 후 작업

## Discord ↔ Oracle 통신
- 스크립트: `~/.claude/discord-send.sh <type> <content>`
- 수신 봇: `~/.claude/discord-receiver.sh` (pm2: `discord-receiver`, 5초 폴링)
- 자동 응답: `~/.claude/oracle-respond.sh` → `env -u CLAUDECODE` + bypassPermissions

## 개발/운영 환경
- **운영 서버**: Oracle Cloud ARM 프리티어 (k3s + ArgoCD), 호스트: `/root`
- **개발 서버**: Mac Mini (k3d 클러스터) — 이전 환경
- Docker 빌드: `platforms: linux/arm64`, `--platform=$BUILDPLATFORM`, sharp `npm rebuild` 필수
- 흐름: CI/CD → aether-gitops 태그 → ArgoCD(OCI) 자동 배포

## OCI k3s 클러스터 현황 (2026-03-04)
- 클러스터: k3s v1.34.4 (단일 노드, OCI ARM)
- **21 Pod** (20 Running + 1 Completed): 6 백엔드 + 1 프론트 + 5 인프라 + 5 모니터링 + 1 완료
- **7 ArgoCD Pod**: argocd 네임스페이스
- Ingress: `/api`,`/auth`,`/sse`,`/health`→gateway | `/grafana`→grafana | `/`→frontend
- Prometheus **7/7 UP**, Grafana 2개 (SLO + Service Debug 19패널)
- Loki 3.3.2: schema v13(tsdb) 단일 구성

## Cloudflare Tunnel
- 도메인: `algo-su.com`, 터널명: `algosu-prod`
- Public Hostname: `algo-su.com` → `http://localhost:80`

## OAuth 크레덴셜 (2026-03-04)
- Google/Naver/Kakao/GitHub OAuth: SealedSecret 설정 완료
- `OAUTH_CALLBACK_URL`/`FRONTEND_URL`/`ALLOWED_ORIGINS`: `https://algo-su.com`

## 인증 정책
- **1계정 1OAuth**: `upsertUser()`에서 다른 제공자 중복 로그인 차단
- **JWT**: httpOnly Cookie, TokenRefreshInterceptor 자동 갱신, 단일 Access Token
- **SSE**: `EventSource(url, { withCredentials: true })` — httpOnly Cookie 기반
- **OAuth 콜백 에러**: 프론트엔드 `/callback#error=...` 리다이렉트

## CI/CD 현황
- 파이프라인: `secret-scan → detect → quality → test → build → trivy → aether-gitops → ArgoCD`
- ci.yml: 23개 job, 이미지 태그: `main-{full-sha}`
- Dependabot: 10개 에코시스템(npm 6 + pip 1 + docker 2 + actions 1), semver-major 차단
- GitOps 레포: `tpals0409/aether-gitops` (private)

## 모니터링 로그 규칙
- JSON structured logging 필수, Prometheus: `algosu_{service}_{metric}_{unit}`
- SLO: 가용성 99.5%, 에러율 <5%, P95 <1s

## 테스트 현황 (2026-03-04 오디트 스프린트 완료 기준)
- 단위: Gateway **43**/43, Problem 19/19, Submission 26/26, github-worker 11/11, ai-analysis 20/20 = **119/119**
- E2E: 39/39 PASS (`scripts/e2e-full.sh`)
- Frontend TypeScript: 0 errors

## 완료 Sprint 요약
- **Phase 1-3 + UI v2** (02-27~03-03): MSA 6서비스, Saga/SSE, UI v2, 알림 9종, AI분석, 코드리뷰
- **OCI k3s 배포 + 검증** (03-03): 16→21 Pod, Sealed Secrets 12개, E2E 39/39
- **Week 1~3 Sprint** (03-04): 안정화+보안강화+기능확장, Trivy CVE, OAuth Sealed Secrets
- **OAuth 핫픽스** (03-04): SealedSecret URL 갱신, 1계정 1OAuth, 콜백 에러 리다이렉트
- **5라운드 전체 오디트 스프린트** (03-04): 상세 아래 + `algosu-session.md` 참조

## 5라운드 오디트 스프린트 (2026-03-04 완료)
- **투입**: 15회 Agent 투입 (R1:5명, R2:3명, R3:3명, R4:3명, R5:1명)
- **총 발견**: 178건 감사, **34건 수정** (C5/H13/M11/L5)
- **주요 수정**: SSE cookie auth, AuthContext 서버통합, UI -soft 토큰 통일, select-chevron 유틸리티, SHA-256 guard, JWT exp 체크, Gemini→Claude 치환(16파일), DTO MaxLength
- **검증**: R5 회귀검증 13/13 ALL PASS (Cross-ref 6 + Regression 7)
- **수정 파일**: 27파일 (백엔드 5 + 프론트엔드 17 + 문서/인프라 5+)

## 설정 완료 내역
- Skills 23개: Agent 페르소나 11명 + 공통/유틸리티 12개
- Memory 17개: MEMORY.md + 프로젝트/세션/플랜 + docs 요약 + 토픽 메모리 (deploy, lessons, ui-v2, cicd-history 등)

## 배포/오디트 발견 이슈 (누적)
- 상세: `algosu-lessons.md`, `algosu-deploy.md` 참조
- 핵심: k3d 17건 + OAuth 핫픽스 3건 + 5라운드 오디트 34건

## UX 설계 원칙
- **알림 9종**: SUBMISSION_STATUS, AI_COMPLETED, GITHUB_FAILED, ROLE_CHANGED, PROBLEM_CREATED, DEADLINE_REMINDER, MEMBER_JOINED, MEMBER_LEFT, STUDY_CLOSED
- **CSS 변수**: 87개 듀얼 테마 토큰, hex 하드코딩 금지, SVG 하드코딩 → `.select-chevron` 유틸리티

## 로컬 테스트 환경
- `docker compose -f docker-compose.dev.yml up -d` (인프라)
- 각 서비스: `cd services/<name> && npm run build && node dist/src/main.js`
- 포트: Gateway(3000), Frontend(3001), Problem(3002), Submission(3003), Identity(3004)

## OCI k3s 수동 배포 워크플로
- `docker build → docker save | k3s ctr images import` → aether-gitops 태그 → ArgoCD hard refresh
- **주의**: `kubectl set image`는 ArgoCD selfHeal이 롤백 → 반드시 aether-gitops 경유
- **주의**: 이미지명 `algosu-gateway`(하이픈) vs `algosu/gateway`(슬래시) 혼동 금지

## 다음 할 일
- **Week 4 Sprint**: 추가 기능 확장 (대기)
- **잔여 LOW**: DeadlineReminderService 미완성 엔드포인트, Entity 인덱스, Landing 통계
- **향후 강화**: ESLint `no-console` warn→error, `@typescript-eslint/no-floating-promises`
