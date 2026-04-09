---
sprint: 67
title: "기술 블로그 포스트 추가 + GitOps 동기화"
date: "2026-04-09"
status: completed
agents: [Scribe, Conductor]
related_adrs: [ADR-004, ADR-005]
---

# Sprint 67: 기술 블로그 포스트 추가 + GitOps 동기화

## Decisions
### D1: 스프린트 코드 페이지 제거 및 ADR 포스트로 대체
- **Context**: 블로그에 스프린트별 페이지(`/sprint/[num]`, `/sprints`)가 있었으나 활용도가 낮고, ADR 기반 기술 포스트가 더 가치 있음
- **Choice**: 스프린트 페이지 및 관련 코드 제거, ADR-004/005 기술 포스트로 대체
- **Alternatives**: 스프린트 페이지 유지하면서 ADR 포스트 추가 — 중복 콘텐츠 발생으로 기각
- **Code Paths**: `blog/src/app/sprint/[num]/page.tsx`, `blog/src/app/sprints/page.tsx`, `blog/src/lib/posts.ts`, `blog/content/adr/adr-004-system-architecture.mdx`, `blog/content/adr/adr-005-ai-orchestration.mdx`

### D2: blog.yaml GitOps 매니페스트 동기화
- **Context**: 블로그 배포 매니페스트가 GHCR 이미지 풀 정책 및 strategy 설정이 누락되어 있었음
- **Choice**: imagePullPolicy + GHCR 레지스트리 + strategy 설정을 blog.yaml에 반영
- **Alternatives**: 없음
- **Code Paths**: `infra/k3s/blog.yaml`

## Patterns
해당 없음

## Gotchas
해당 없음

## Metrics
- Commits: 2건, Files changed: 8개 (+475/-100)
