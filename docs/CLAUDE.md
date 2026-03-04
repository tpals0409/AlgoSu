# AlgoSu — Claude Code 프로젝트 가이드

## 프로젝트 개요
알고리즘 스터디 관리 플랫폼. 코드 제출 → GitHub 자동 Push → AI 분석 → 코드리뷰의 풀스택 워크플로우를 제공한다.

- **아키텍처**: 6 마이크로서비스 + 1 프론트엔드 (모노레포)
- **인프라**: k3d(개발) / k3s+ArgoCD(운영, OCI ARM)
- **인증**: OAuth 전용 (Google/Naver/Kakao) + httpOnly Cookie JWT

## 디렉토리 구조

```
AlgoSu/
├── services/           # 백엔드 마이크로서비스
│   ├── gateway/        # NestJS — API Gateway, OAuth, JWT, SSE, Study, Notification, Review proxy
│   ├── submission/     # NestJS — Submission, Draft, Saga, Review/Reply, StudyNote
│   ├── problem/        # NestJS — Problem CRUD, Deadline Cache, Dual-Write
│   ├── identity/       # NestJS — User, Study, Notification DB (마이그레이션 전용)
│   ├── github-worker/  # Node.js — RabbitMQ 소비자, GitHub Push, Token Manager
│   └── ai-analysis/    # FastAPI(Python) — Claude API 분석, Circuit Breaker
├── frontend/           # Next.js 15 (App Router, Tailwind, shadcn/ui)
│   └── src/
│       ├── app/        # 페이지 (20+ 라우트)
│       ├── components/ # UI 컴포넌트 (ui/ 22종 + layout/ + review/ + submission/ + landing/ + analytics/ + dashboard/ + providers/)
│       ├── contexts/   # AuthContext, StudyContext
│       ├── hooks/      # useAutoSave, useSubmissionSSE, useRequireAuth 등
│       └── lib/        # api.ts, auth.ts, utils.ts, constants.ts, guards.ts
├── infra/
│   ├── k3s/            # k8s 매니페스트 (base 16 + monitoring 9 = 25개 YAML)
│   │   ├── monitoring/ # Prometheus, Grafana(SLO대시보드), Loki, Promtail
│   │   └── postgres-init/ # DB 초기화 SQL
│   ├── overlays/       # dev/staging/prod Kustomize 오버레이
│   └── sealed-secrets/ # SealedSecret 템플릿 + 생성물
├── docs/               # 규칙 문서 (migration, CI/CD, monitoring, annotation)
├── scripts/            # deploy.sh, e2e-jwt-payload.sh, e2e-full.sh
├── .github/workflows/  # ci.yml (23개 job)
├── docker-compose.dev.yml  # 로컬 인프라 (PG + Redis + RabbitMQ)
└── plan/               # 기획 문서
```

## 서비스 포트 (로컬)

| 서비스 | 포트 | 기술 스택 |
|--------|------|-----------|
| Gateway | 3000 | NestJS, JWT, Redis Rate Limit, SSE |
| Frontend | 3001 | Next.js 15, Tailwind, shadcn/ui |
| Problem | 3002 | NestJS, TypeORM, Redis Cache |
| Submission | 3003 | NestJS, TypeORM, Saga, RabbitMQ |
| Identity | 3004 | NestJS, TypeORM |
| GitHub Worker | — | Node.js, Octokit, RabbitMQ |
| AI Analysis | 8000 | FastAPI, Claude API, Circuit Breaker |

## 로컬 개발 환경

```bash
# 1. 인프라 기동 (PostgreSQL + Redis + RabbitMQ)
docker compose -f docker-compose.dev.yml up -d

# 2. 각 서비스 빌드 & 실행
cd services/<name> && npm run build && node dist/src/main.js

# 3. 프론트엔드
cd frontend && npm run dev
```

## k3d 클러스터 (개발 환경)

- 클러스터: `k3d-algosu` (단일 노드, traefik disabled, 포트 80/443)
- 네임스페이스: `algosu`
- **16 Pod**: 6 백엔드 + 1 프론트 + 5 인프라(PG/PG-Problem/Redis/RMQ/MinIO) + 4 모니터링
- Sealed Secrets Controller: kube-system (v0.26.2)
- initContainer: `node ./node_modules/typeorm/cli.js migration:run`

## 주요 기술 결정

- **JWT**: httpOnly Cookie 저장, TokenRefreshInterceptor로 서버측 자동 갱신
- **publicId (UUID)**: 모든 외부 노출 식별자는 UUID, 내부 PK는 auto-increment
- **Saga 패턴**: Submission 생성 → GitHub Push → AI 분석 (상태 전이 + DLQ)
- **SSE S6**: Gateway에서 Redis Pub/Sub → SSE 스트림 (최종 상태 시 자동 종료)
- **CSP**: next.config.ts에 Content-Security-Policy 헤더 설정
- **Dual-Write**: Problem DB 분리 (expand 모드, 매시간 reconciliation)
- **AI 분석**: Claude API (prompt.py), 일일 5회/유저 제한
- **코드리뷰**: 2-패널 뷰 (CodePanel + CommentThread), StudyNote, ReviewComment/Reply

## 디자인 시스템 v2

- **CSS 변수**: 87개 듀얼 테마 토큰 (globals.css)
- **공통 컴포넌트**: 22종 (Badge, Button, Card, Input, DiffBadge, ScoreGauge, StatusBadge 등)
- **원칙**: CSS 변수 100% 활용, hex 하드코딩 금지, Tailwind 유틸리티 우선

## 코드 에디터 (CodeEditor.tsx)

- **자동완성**: BOJ 알고리즘 스니펫 29개 (builtins/keywords 없음 — Monaco 내장이 처리)
- **레이아웃**: 데스크톱 split-view (문제정보 420px + 에디터 flex), 반응형 높이 `calc(100vh - 16rem)`
- **풀스크린**: Maximize/Minimize 토글, Escape 해제 (suggest-widget 충돌 방지)
- **진단**: JS/TS 문법 오류 빨간 밑줄 활성화
- **접근성**: sr-only 라벨, Ctrl+Enter 단축키, focus-visible

## 마이그레이션 규칙

- Expand-Contract 패턴 필수 (`docs/migration-rules.md`)
- 파일명: `{timestamp}-{PascalCase}.ts`
- initContainer에서 자동 실행 (k3d 배포 시)
- `npm run migration:run` — 로컬 실행

## CI/CD

- 파이프라인: `secret-scan → detect → quality → test → build → trivy → aether-gitops 태그 → ArgoCD sync`
- ci.yml: 23개 job
- 이미지 태그: `main-{git-sha}` 강제, `latest` 사용 금지
- Docker: `platforms: linux/arm64`
- GitOps: `tpals0409/aether-gitops` (private)

## 보안 체크리스트 (모든 코드 작업 전 필수)

- JWT: `none` 알고리즘 금지, 만료 검증 필수
- 인가: IDOR 차단 (publicId 사용, study_member 권한 검증)
- 세션: Redis TTL 관리
- Secrets: Sealed Secrets 사용 (평문 Secret 금지)
- 입력값: SQL 바인딩 (raw query 금지)
- 로그: 토큰/키/PII 노출 금지

## 코드 규칙

- JSON structured logging (Prometheus: `algosu_{service}_{metric}_{unit}`)
- 전 서비스 GlobalExceptionFilter + StructuredLoggerService
- InternalKeyGuard로 서비스 간 통신 보안
- StudyMemberGuard로 스터디 멤버 권한 검증
- 상세: `docs/annotation-dictionary.md`, `docs/monitoring-log-rules.md`
