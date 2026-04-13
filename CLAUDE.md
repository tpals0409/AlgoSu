# AlgoSu — Claude Code 프로젝트 가이드

## 프로젝트 개요
알고리즘 스터디 관리 플랫폼. 코드 제출 → GitHub Push → AI 분석 → 코드리뷰 워크플로우.
- **아키텍처**: 6 마이크로서비스 + 1 프론트엔드 (모노레포)
- **인프라**: k3d(개발) / k3s+ArgoCD(운영, OCI ARM)
- **인증**: OAuth(Google/Naver/Kakao) + httpOnly Cookie JWT

## 디렉토리 구조

```
AlgoSu/
├── CLAUDE.md
├── agents/
│   ├── _shared/persona-base.md      # 공통 규칙 SSoT
│   └── commands/                    # 내부 참조 (에이전트 11 + 도구 7)
│       ├── {agent}.md               # 에이전트별 역할/책임/도구참조
│       └── {tool}.md                # 규칙 문서 (annotate, monitor 등)
├── .claude/
│   └── commands/                    # 사용자용 슬래시 커맨드 (5개)
│       ├── algosu-oracle.md         # Oracle 에이전트 (유일한 진입점)
│       ├── algosu-review.md         # 코드 리뷰
│       ├── algosu-adr-blog.md       # ADR→블로그 변환
│       ├── start.md / stop.md       # 세션 생명주기
├── services/                        # 백엔드 마이크로서비스
│   ├── gateway/                     # NestJS — API Gateway, OAuth, JWT, SSE
│   ├── submission/                  # NestJS — Submission, Saga Orchestrator
│   ├── problem/                     # NestJS — Problem CRUD, Deadline
│   ├── identity/                    # NestJS — User, Study DB
│   ├── github-worker/               # Node.js — RabbitMQ, GitHub Push
│   └── ai-analysis/                 # FastAPI — Claude API, Circuit Breaker
├── frontend/                        # Next.js 15 (App Router, Tailwind, shadcn/ui)
├── infra/k3s/                       # k8s 매니페스트 + monitoring
├── scripts/                         # deploy.sh, e2e 테스트
└── .github/workflows/ci.yml         # CI (15개 job)
```

## 빌드 & 테스트

```bash
# NestJS 서비스 (gateway, submission, problem, identity, github-worker)
cd services/<name> && npm test          # 단위 테스트
cd services/<name> && npm run test:cov  # 커버리지
cd services/<name> && npm run build     # 빌드

# FastAPI (ai-analysis)
cd services/ai-analysis && python -m pytest
cd services/ai-analysis && ruff check . && mypy .

# Frontend
cd frontend && npm test                 # Vitest
cd frontend && npm run build            # Next.js 빌드

# 전체 lint
npx eslint .
```

## 핵심 패턴 퀵 레퍼런스
- **DB**: 3-DB 분리 (identity_db / problem_db / submission_db), Database per Service
- **인증**: Custom OAuth + httpOnly Cookie JWT (Supabase 미사용)
- **서비스 통신**: X-Internal-Key 헤더 + SHA-256 timingSafeEqual
- **이벤트 흐름**: Submission → RabbitMQ → GitHub-Worker(Push) / AI-Analysis(분석)
- **외부 ID**: publicId(UUID), 내부 PK: auto-increment
- **커밋 컨벤션**: `feat|fix|chore(<scope>): <subject>`

## 파일 탐색 규칙
- 에이전트 공통 규칙: `agents/_shared/persona-base.md` (SSoT)
- 에이전트 역할: `agents/commands/{name}.md` (Oracle이 참조)
- 도구/규칙: `agents/commands/{tool}.md` (각 에이전트가 필요 시 Read)
- 사용자 커맨드: `.claude/commands/` (oracle, review, adr-blog, start, stop)
