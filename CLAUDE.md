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
├── agents/                          # 에이전트 페르소나
│   ├── _shared/persona-base.md      # 공통 베이스 (전 에이전트 필수 참조)
│   └── {agent-name}/persona.md      # 에이전트별 역할/책임/판단기준
├── .claude/
│   └── commands/                    # 슬래시 커맨드 (23개)
│       ├── algosu-{agent}.md        # 에이전트 스킬 (12개)
│       └── algosu-{tool}.md         # 도구/참조 스킬 (11개)
├── services/                        # 백엔드 마이크로서비스
│   ├── gateway/                     # NestJS — API Gateway, OAuth, JWT, SSE
│   ├── submission/                  # NestJS — Submission, Saga Orchestrator
│   ├── problem/                     # NestJS — Problem CRUD, Deadline
│   ├── identity/                    # NestJS — User, Study DB
│   ├── github-worker/               # Node.js — RabbitMQ, GitHub Push
│   └── ai-analysis/                 # FastAPI — Claude API, Circuit Breaker
├── frontend/                        # Next.js 15 (App Router, Tailwind, shadcn/ui)
├── infra/
│   ├── k3s/                         # k8s 매니페스트 (base + monitoring)
│   ├── overlays/                    # dev/staging/prod Kustomize
│   └── sealed-secrets/              # SealedSecret 템플릿
├── scripts/                         # deploy.sh, e2e 테스트
└── .github/workflows/ci.yml         # CI (23개 job)
```

## 파일 탐색 규칙
- 에이전트 작업 시: `agents/_shared/` → `agents/{name}/` 순서로 참조
- 슬래시 커맨드: `.claude/commands/algosu-{name}.md`
- 규칙 확인 시: 각 커맨드 파일 내 참조 경로 따라 Read
