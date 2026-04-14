---
sprint: 86
title: "블로그 콘텐츠 리프레이밍 — 경험담 중심 전환"
date: "2026-04-14"
status: completed
agents: [Oracle, Scribe, Herald]
related_adrs: []
---

# Sprint 86: 블로그 콘텐츠 리프레이밍

## Context

기존 블로그 7편은 ADR(Architecture Decision Record) 톤의 정보 전달형 글이었다. 채널톡 기술 블로그를 레퍼런스로 삼아 "경험담" 톤(문제→실험→성과→성찰)으로 리프레이밍하기로 결정.

디렉토리도 `content/adr/` → `content/posts/`로 리네이밍하여 콘텐츠 성격 변화를 반영.

## Decisions

### D1: 콘텐츠 디렉토리 리네이밍
- `content/adr/` → `content/posts/`, `content/adr-en/` → `content/posts-en/`
- `posts.ts` LOCALE_SUBDIR 매핑 변경.
- 이유: "ADR"은 내부 기록 성격, "posts"가 블로그 콘텐츠 성격에 적합.

### D2: meet-the-agents (구 Post 5) 삭제 → Post 1 통합
- Post 1이 8→12명 진화 스토리, TierMatrix, 실전 에피소드를 모두 커버하여 중복.
- 고유 콘텐츠(12명 상세 스펙)는 `docs/agents/commands/`에 별도 존재.
- sprint-journey order 6→5, session-policy-sync order 7→6으로 재조정.

### D3: 리프레이밍 공통 규칙
- 시리즈 footer 완전 삭제 (모든 포스트).
- 톤: "~합니다" 정보 전달 → "~했습니다/~이었죠" 경험담.
- 구조: 문제→실험→성과→성찰.
- MDX 커스텀 컴포넌트(HierarchyTree, PhaseTimeline 등) 전면 제거 → 표준 Markdown으로 단순화.

### D4: nginx absolute_redirect off
- k3d port-forward 환경에서 nginx 301 리다이렉트가 내부 포트를 노출하는 버그 수정.
- `absolute_redirect off;` 한 줄 추가로 해결.

### D5: blog NetworkPolicy 추가
- Post 3 작업 중 blog 서비스에 NetworkPolicy가 누락된 것을 발견.
- `service-network-policies.yaml`에 `blog-ingress` 정책 추가.

## Outcome

- Post 1 "AI 에이전트 오케스트레이션 실전기" — 완료
- Post 2 "MSA 설계, 사람이 결정하고 AI가 실행한다" — 완료
- Post 3 "12명의 AI를 통제하는 법" — 완료 (400줄→90줄 압축)
- Post 5 "67번의 스프린트를 돌아보며" — 완료 (264줄→105줄 압축)
- 전체: 7편 → 6편, 총 -2,227줄 감소

### 이월 항목
- Post 4 (cicd-ai-guardrails) 제목/결론 조정
- Post 6 (session-policy-sync) 시리즈 제거 + AI 맥락 추가
- 영문 포스트 동기화 + 최종 빌드 검증
- Sprint 87 카테고리 시스템 플랜 파일 작성 완료 (`sprint-87-plan.md`)

## 교훈

- **글 하나 단위로 (플랜→보완→작성) 사이클**을 돌리는 것이 품질과 일관성 모두에 효과적이었다.
- MDX 커스텀 컴포넌트는 유지 비용 대비 가독성 기여가 낮았다. 표준 Markdown으로 충분.
- 콘텐츠 리프레이밍은 예상보다 시간이 걸린다 — 7편 중 4편 완료, 나머지 이월.
