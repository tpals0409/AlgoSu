---
sprint: 87
title: "블로그 카테고리 시스템 + Post 6 리프레이밍 완료"
date: "2026-04-14"
status: completed
agents: [Oracle, Scribe, Herald, Palette]
related_adrs: []
carryover_from: sprint-86
---

# Sprint 87: 블로그 카테고리 시스템 + 콘텐츠 리프레이밍 완료

## Context

Sprint 86 이월 항목(Post 6 리프레이밍) + 카테고리 시스템 신규 도입을 목표로 시작.
3-Wave 디스패치(Scribe → Herald/Palette → Scribe)로 병렬 에이전트 오케스트레이션 수행.

## Decisions

### D1: Post 6 (session-policy-sync) KR/EN 리프레이밍 완료

**변경 커밋**: `195c839`

- 시리즈 footer blockquote 제거 (7편 링크 + 이전글 링크)
- MDX 커스텀 컴포넌트 5종 → 표준 Markdown 전환:

| 컴포넌트 | 전환 방식 |
|---------|----------|
| `<MetricGrid>/<MetricCard>` | Markdown 표 (label/value/hint 컬럼) |
| `<Mermaid caption="...">` | ` ```mermaid ``` ` 코드블록 + **bold** caption |
| `<PhaseTimeline>/<PhaseMilestone>` | 번호 목록 (phase title — period) |
| `<Callout type="warn">` | `> **⚠️ 제목**` 블록쿼트 |

- AI 맥락 추가: "에이전트 12명 분산 작업 구조에서 이런 상태 불일치는 전체를 한눈에 보지 않으면 잡기 어려운 버그"

### D2: 카테고리 데이터 레이어

**변경 커밋**: `12c14cd`

- `Category = 'journey' | 'challenge'` union type + `parseCategory()` 함수 (fallback: journey)
- `PostMeta`에 `category: Category` 필드 추가
- i18n: `categoryAll`, `categoryJourney`, `categoryChallenge` (ko/en)
- 12개 MDX frontmatter에 `category` 필드 삽입 (Post 1~5: journey, Post 6: challenge)

### D3: CategoryTabs 컴포넌트

**변경 커밋**: `82abecd`

- 토스 스타일 수평 탭 Client Component (`category-tabs.tsx`)
- 활성 탭 하단 2px brand bar 인디케이터
- 접근성: `role="tablist"`, `role="tab"`, `aria-selected`, roving tabindex

### D4: 카테고리 필터 UI + HomePage 연결

**변경 커밋**: `6464497`

- `PostListWithFilter` Client Component: `useState<Category|'all'>('all')` 필터 상태
- `PostCard`: 날짜 옆 카테고리 뱃지 (journey → `bg-brand-soft text-brand`, challenge → `bg-amber-50 text-amber-700`)
- `HomePage`: Server Component 유지, `<ul>` → `<PostListWithFilter>` 교체

### D5: 빌드 검증 — ✅ 통과

`cd blog && npm run build` — 17 static pages, SSG 정상.

## Outcome

| 항목 | 커밋 | 에이전트 |
|------|------|---------|
| Post 6 KR/EN 리프레이밍 | `195c839` | Scribe |
| 카테고리 데이터 레이어 | `12c14cd` | Herald |
| CategoryTabs 컴포넌트 | `82abecd` | Palette |
| 필터 UI + HomePage 연결 | `6464497` | Herald |
| Sprint 87 ADR | `4467788` → 갱신 | Scribe → Oracle |

### 이월 항목

- Post 4 (cicd-ai-guardrails) 제목/결론 조정 + MDX→Markdown 전환 (`<PhaseTimeline>` 제거)

## 교훈

- **체인 디스패치에서 동일 에이전트 중복 금지**: `herald,palette,herald` 체인은 jq `select(.name)` 충돌 발생. 동일 에이전트가 여러 단계에 필요하면 개별 task로 분리 필요.
- **Wave 간 의존성 명시 필요**: Wave 3(ADR)가 Wave 2(카테고리)보다 먼저 실행되어 "이월" 오판. task 간 의존성 선언 메커니즘 필요.
- **4-에이전트 협업 성공**: Scribe(콘텐츠) → Herald(데이터/통합) → Palette(UI) → Herald(통합) 파이프라인으로 6편 블로그 카테고리 체계 완성.
