---
sprint: 77
title: "새 블로그 게시글 — 세션 정책 4-Layer 동기화 삽질기"
date: "2026-04-10"
status: completed
agents: [Oracle, Scribe, Palette]
related_adrs: []
---

# Sprint 77: 새 블로그 게시글 — 세션 정책 4-Layer 동기화 삽질기

## Context

Sprint 67 이후 10개 스프린트(68~76)에서 축적된 기술 경험 중 블로그 포스트로 작성할 주제를 선정. 5개 후보(세션 동기화, 보안 런북, MDX 시각화, AI 팩트체크, cloudflared 삽질) 중 PM이 "세션 정책 4-Layer 동기화 삽질기"를 채택. Sprint 71의 SessionPolicyModule 도입 과정을 기술 블로그 7번째 포스트로 작성.

## Decisions

### D1: 블로그 주제로 Sprint 71 세션 정책 삽질기 선정
- **Context**: Sprint 68~76 작업 중 블로그 소재 후보 5건 도출. 실전 디버깅 + 설계 개선 스토리가 독자 공감대가 가장 넓고, 기존 6편(아키텍처/에이전트 소개)과 차별화됨.
- **Choice**: "세션 정책 4-Layer 동기화 삽질기" — JWT TTL·Cookie maxAge·sliding threshold·프론트 타이머 4계층 불일치 버그 → SessionPolicyModule SSoT 해결 과정을 기록.
- **Alternatives**: next-mdx-remote 6.0 마이그레이션, CI deprecation 대응, cloudflared 삽질기, AI 팩트체크 — 모두 유효하나 스토리 완결성과 공감대 측면에서 후순위.
- **Code Paths**: `blog/content/adr/session-policy-sync.mdx`

### D2: Sprint 76 ADR 동봉 커밋
- **Context**: Sprint 76 ADR(`docs/adr/sprints/sprint-76.md`)이 untracked 상태로 남아 있었음.
- **Choice**: 블로그 포스트 커밋에 함께 포함하여 단일 커밋으로 처리.
- **Alternatives**: 별도 커밋 분리 — 내용이 문서 전용이므로 단일 커밋이 효율적.
- **Code Paths**: `docs/adr/sprints/sprint-76.md`

## Patterns

### P1: 기존 시각 컴포넌트 조합으로 블로그 포스트 구성
- **Where**: `blog/content/adr/session-policy-sync.mdx`
- **When to Reuse**: 새 블로그 포스트 작성 시. MetricGrid(수치 비교), Mermaid(흐름도), PhaseTimeline(단계별 진행), Callout(체크리스트/경고) 4종 조합이 기술 삽질기 포맷에 적합.

## Gotchas

### G1: Callout 컴포넌트 type 값 불일치
- **Symptom**: `type="warning"` 사용 시 빌드 에러 (`Cannot read properties of undefined (reading 'wrap')`)
- **Root Cause**: Callout 컴포넌트가 `'info' | 'warn' | 'success' | 'danger'` 4종만 지원. `"warning"`은 유효하지 않은 type.
- **Fix**: `type="warn"`으로 수정. 향후 블로그 포스트 작성 시 `callout.tsx`의 `CalloutType` 정의를 먼저 확인.

## Metrics
- **Commits**: 1건 (`3133cb4`)
- **Files changed**: 2개 (+359줄)
  - 신규: `blog/content/adr/session-policy-sync.mdx` (295줄)
  - 신규: `docs/adr/sprints/sprint-76.md` (64줄)
- **빌드 검증**: Next.js 정적 빌드 성공, 7개 포스트 정상 export
