---
sprint: 87
title: "블로그 콘텐츠 리프레이밍 완료 — Post 6 + 빌드 검증"
date: "2026-04-14"
status: completed
agents: [Oracle, Scribe]
related_adrs: []
carryover_from: sprint-86
---

# Sprint 87: 블로그 콘텐츠 리프레이밍 완료

## Context

Sprint 86 이월 항목(Post 4/6 리프레이밍, 빌드 검증) + 카테고리 시스템 신규 도입을 목표로 시작.
결과적으로 Sprint 86의 핵심 이월인 Post 6 리프레이밍과 빌드 검증을 완료하고, Post 4 리프레이밍 및 카테고리 시스템은 Sprint 88로 이월.

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

- AI 맥락 추가: "에이전트 12명 분산 작업 구조에서 이런 상태 불일치는 전체를 한눈에 보지 않으면 잡기 어려운 버그" 문장 (KR/EN 공통)
- `tags`에 `"challenge"` 카테고리 추가 → Sprint 88 카테고리 시스템 선제 준비

### D2: 빌드 검증 — ✅ 통과

`cd blog && npm run build` 실행 결과:

```
✓ Compiled successfully in 2.3s
✓ Generating static pages (17/17)
✓ Exporting (2/2)
```

| 항목 | 결과 |
|------|------|
| TypeScript 컴파일 | ✅ 오류 없음 |
| Lint 검사 | ✅ 통과 |
| 정적 페이지 생성 | ✅ 17페이지 (KR 6 + EN 6 + 홈 2 + not-found 1 + 기타) |
| SSG 내보내기 | ✅ 2개 export 완료 |

- Post 4가 `<PhaseTimeline>` MDX 컴포넌트를 여전히 사용 중이나, `mdx-components.tsx`에 등록되어 있어 정상 빌드됨.
- 카테고리 시스템이 미구현인 상태에서도 기존 빌드 경로는 모두 정상.

### D3: 카테고리 시스템 — Sprint 88으로 이월

계획된 카테고리 시스템(`category-tabs.tsx`, `post-list-with-filter.tsx`, `PostMeta.category` 확장)은 이번 Sprint에 구현하지 않기로 결정.
이유: Sprint 86 이월 항목(Post 4) 미완료 상태에서 신규 기능 추가 시 리그레션 위험.
`sprint-87-plan.md`의 설계 결정은 Sprint 88에 그대로 인계.

## Outcome

- Post 6 (session-policy-sync) KR/EN 리프레이밍 — 완료 (commit `195c839`)
- 빌드 검증 통과 — 17 static pages, 오류 없음
- 총 변경: 2 파일, +100 / -118 줄

### 이월 항목

- Post 4 (cicd-ai-guardrails) 제목/결론 조정 + MDX→Markdown 전환 (`<PhaseTimeline>` 제거)
- 카테고리 시스템 구현 (design: `sprint-87-plan.md` 참조)

## 교훈

- **MDX 컴포넌트 등록이 양날의 검**: 이전 포스트에서 사용 중인 컴포넌트를 `mdx-components.tsx`에서 제거하면 빌드가 깨진다. Post별 순차 전환 후 컴포넌트 등록 해제 순서를 지켜야 한다.
- **Wave 단위 분할 유효**: Wave 1(Post 6) → Wave 2(빌드검증+ADR) 분할로 각 wave의 책임이 명확했다.
- **이월 적립**: Sprint 86→87→(88)로 Post 4와 카테고리 시스템이 이월 누적되고 있다. Sprint 88에서 이 두 항목을 반드시 우선 처리 필요.
