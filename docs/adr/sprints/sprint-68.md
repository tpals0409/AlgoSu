---
sprint: 68
title: "blog 내용 점검 및 수정"
date: "2026-04-09"
status: completed
agents: [Oracle, Scribe, Architect]
related_adrs: []
---

# Sprint 68: blog 내용 점검 및 수정

## Decisions

### D1: Tier 분류 SSoT = `agents/commands/*.md`
- **Context**: `meet-the-agents.mdx`와 `orchestration-structure.mdx`가 Palette의 Tier와 Tier 3 명칭("Support" vs "Enhancement")에서 불일치. 블로그 포스트 간 상충을 해소하기 위해 기준점이 필요했음.
- **Choice**: `agents/commands/{name}.md` 첫 줄의 `[Tier N — Label]` 선언을 SSoT로 채택. 블로그·문서·기획 자료는 이 값을 따른다.
- **Alternatives**: orchestration-structure.mdx를 정본으로 채택(블로그 위주) / MEMORY.md에 별도 선언(메모리는 스냅샷이라 부적합) — 모두 기각.
- **Code Paths**: `agents/commands/palette.md`, `agents/commands/*.md`, `blog/content/adr/meet-the-agents.mdx`, `blog/content/adr/orchestration-structure.mdx`

### D2: 블로그 시리즈 재편 — ADR 번호 기반 → 주제 기반 6편
- **Context**: 기존 `adr-001~005.mdx`는 ADR 번호 나열형이라 독자 관점에서 서사 흐름이 약했음. Sprint 67에 이미 재편 중이었으나 상호 참조/Tier 정합성이 검증되지 않은 상태로 워킹트리에 방치.
- **Choice**: 6편 주제 기반 시리즈로 확정하고 Sprint 68에서 정합성까지 마무리 후 커밋.
  1. agent-orchestration-solo-dev (intro)
  2. system-architecture-overview
  3. orchestration-structure
  4. cicd-ai-guardrails
  5. meet-the-agents
  6. sprint-journey (회고)
- **Alternatives**: ADR 번호 체계 유지 — 독자 내비게이션 불편으로 기각.
- **Code Paths**: `blog/content/adr/*.mdx`

## Patterns

### P1: 문서 Tier/명칭 일관성 검증은 `agents/commands/` grep 기준
- **Where**: `agents/commands/*.md`의 `\[Tier \d` 선언
- **When to Reuse**: 블로그·README·ADR 등 에이전트 체계를 기술하는 문서를 작성/수정할 때는 먼저 `agents/commands/*.md`를 grep하여 SSoT를 확인하고, 문서 간 상충이 발생하면 SSoT를 기준으로 수정한다.

### P2: 블로그 시리즈 링크 텍스트는 각 포스트 frontmatter `title`과 일치
- **Where**: `blog/content/adr/*.mdx`의 "이전 글/다음 글" 링크
- **When to Reuse**: 링크 텍스트가 실제 포스트 제목과 크게 다르면 독자가 다음 글 내용을 오해한다(예: `system-architecture-overview.mdx`가 "Saga Orchestrator 구조 설계"로 다음 글을 예고했으나 실제 다음 글은 에이전트 오케스트레이션). 시리즈 포스트를 추가/수정할 때마다 frontmatter `title`과 링크 텍스트 정합성을 grep으로 확인한다.

## Gotchas

### G1: Subagent 보고는 보조 자료, 직접 Grep이 최종 권위
- **Symptom**: Explore subagent가 `meet-the-agents.mdx`의 Tier 오류를 "Palette가 Tier 2/3 불일치, 세 에이전트→네 에이전트 수정 필요"로 보고. 그러나 Oracle이 직접 Grep해보니 `meet-the-agents.mdx`는 Palette를 Tier 2로, "세 에이전트"로 일관되게 기술하고 있었음. 정작 틀린 건 Tier 2/3 전체 분류였음.
- **Root Cause**: Subagent의 요약 과정에서 관찰한 사실과 판단이 뒤섞였고, Oracle이 그 요약을 무비판적으로 전달하면 잘못된 수정 지시로 이어질 뻔했음.
- **Fix**: Subagent 리포트를 받은 후에도 Critical 판단은 Oracle이 직접 Read/Grep으로 재검증한다. 특히 "어느 파일이 정본인가" 같은 판단은 SSoT를 직접 확인해야 한다.

### G2: Cloudflare Tunnel 라우팅은 Ingress에 노출되지 않음
- **Symptom**: CD 검증 중 `kubectl get ingress`에서 blog 라우트가 없어 "blog는 외부에 노출되지 않았다"고 순간 오해. 실제로는 `https://blog.algo-su.com`이 정상 응답.
- **Root Cause**: blog 서비스는 `algosu/cloudflared` pod가 Cloudflare Tunnel로 직접 `blog` Service(ClusterIP)로 전달. Ingress를 우회하는 구조라 `kubectl get ingress`에는 흔적이 없음.
- **Fix**: 외부 도메인 라우팅을 확인할 때는 Ingress만 보지 말고 `cloudflared` pod 존재 여부 + 실제 HTTP 요청으로 검증. reference_domain.md에 blog 도메인 및 라우팅 메커니즘을 기록해 재발 방지.

## Metrics
- Commits: 2건 (cb86dec, 37ccf38)
- Files changed: 16개 (+2446/-571)
- 블로그 포스트 재편: 5편 삭제 + 6편 신규 + 3편 내용 보정
- Sprint ADR 아카이브 보강: Sprint 63~67
