---
sprint: 76
title: "블로그 UI 이월"
date: "2026-04-10"
status: completed
agents: [Oracle, Palette, Scout, Curator]
related_adrs: []
---

# Sprint 76: 블로그 UI 이월

## Decisions
### D1: Pipeline → PhaseTimeline 전면 전환
- **Context**: Pipeline 컴포넌트가 `max-w-3xl`(768px)에서 8단계 가로 배치 시 텍스트 과밀. sprint-journey.mdx만 PhaseTimeline(세로 타임라인)을 사용하여 시각 일관성 부재
- **Choice**: 전 포스트의 Pipeline을 PhaseTimeline으로 전환 (3파일, 7개 Pipeline → 0개)
- **Alternatives**: Pipeline 4+4 분할 (시도 후 사용자 피드백으로 PhaseTimeline 통일로 변경)
- **Code Paths**: `blog/content/adr/cicd-ai-guardrails.mdx`, `blog/content/adr/orchestration-structure.mdx`, `blog/content/adr/system-architecture-overview.mdx`

### D2: 코드블록 Client Component 신설
- **Context**: rehype-highlight가 구문강조만 제공, 언어 표시/복사 기능 부재. 기술 블로그에서 코드 복사 불가는 Major 페인포인트
- **Choice**: `code-block.tsx` Client Component 신설 — 언어 라벨(className 파싱) + clipboard 복사 버튼 + "복사됨" 피드백
- **Alternatives**: rehype 플러그인 교체 (불필요한 의존성 추가 회피)
- **Code Paths**: `blog/src/components/blog/code-block.tsx`, `blog/src/components/mdx-components.tsx`

### D3: 포스트 네비 "← 지난 글 | 새 글 →" 좌우 배치
- **Context**: 기존 "← 이전 글 / 다음 글 →"은 시간축 vs 목록 위치 의미론 혼란 (Scout Major 판정)
- **Choice**: 좌=older(← 지난 글), 우=newer(새 글 →) — 시간축 좌→우(과거→미래) 방향
- **Alternatives**: "← 새 글 / 지난 글 →" (한번 시도 후 사용자 피드백으로 스왑)
- **Code Paths**: `blog/src/app/posts/[slug]/page.tsx`

### D4: 블로그 포스트 수치 Sprint 67 기준 복원
- **Context**: Sprint 74-2 사실검증에서 4개 포스트 수치를 73으로 갱신했으나, 원래 Sprint 67 시점 기록. 이후 스프린트는 별도 게시글로 추가 예정
- **Choice**: 4개 포스트의 수치를 Sprint 67 기준으로 복원 (67개 스프린트, 2,432개 테스트)
- **Alternatives**: 현행 73 유지 (사용자가 별도 게시글 방침 확정하여 복원 결정)
- **Code Paths**: `blog/content/adr/sprint-journey.mdx`, `blog/content/adr/orchestration-structure.mdx`, `blog/content/adr/meet-the-agents.mdx`, `blog/content/adr/agent-orchestration-solo-dev.mdx`

### D5: Hero MetricGrid 메인 페이지 삽입
- **Context**: 블로그 메인 페이지에 h1+설명 1줄만 존재, 프로젝트 규모감 전달 부재 (Scout Critical 판정)
- **Choice**: 기존 MetricGrid 컴포넌트 재활용, 6개 수치 카드 (Sprints/Tests/Agents/Services/CI/ADR)
- **Alternatives**: 별도 Hero 컴포넌트 신설 (기존 컴포넌트 재활용이 효율적)
- **Code Paths**: `blog/src/app/page.tsx`

## Patterns
### P1: Palette+Scout 병렬 평가 → Oracle 판정
- **Where**: 디자인 작업 전 단계
- **When to Reuse**: 블로그/프론트엔드 시각 디자인 작업 시 — Palette(디자인 제안) + Scout(UX 심각도) 병렬 수집 후 Oracle이 종합 결정

### P2: MDX pre 핸들러 → Client Component 위임
- **Where**: `blog/src/components/mdx-components.tsx` → `code-block.tsx`
- **When to Reuse**: MDX 렌더링에서 인터랙티브 기능(복사, 토글 등)이 필요할 때 — RSC 환경에서 Client Component로 위임

## Gotchas
### G1: ArgoCD 자동 sync 지연
- **Symptom**: CI GitOps job 성공 후에도 블로그 Pod가 이전 이미지로 실행
- **Root Cause**: ArgoCD polling interval 내에 수동 확인 시 아직 동기화 전 상태
- **Fix**: `kubectl patch app algosu -n argocd --type merge -p '{"operation":{"sync":{"revision":"HEAD"}}}'`로 수동 sync 트리거

### G2: 포스트 네비 좌우 배치 2회 반복
- **Symptom**: 첫 시도(좌=newer, 우=older) 후 사용자가 재스왑 요청
- **Root Cause**: 시간축 방향(좌→우 = 과거→미래)이 직관적이라는 판단이 첫 시도에서 누락
- **Fix**: "← 지난 글(좌) | 새 글 →(우)" 확정. 향후 네비 방향 결정 시 시간축 좌→우 컨벤션 적용

## Metrics
- Commits: 2건, Files changed: 11개
