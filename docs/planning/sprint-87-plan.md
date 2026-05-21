---
sprint: 87
title: "블로그 카테고리 시스템 도입"
date: "2026-04-14"
status: planned
agents: [Oracle, Herald, Palette]
related_adrs: []
prerequisite: "Sprint 86 블로그 리프레이밍 완료"
---

# Sprint 87 Plan: 블로그 카테고리 시스템 도입

## Context

AlgoSu 블로그 포스트가 두 가지 성격으로 분리됨:
- **Post 1~5**: 프로젝트 전체를 조감하는 여정/구조/회고 글
- **Post 6+**: 특정 기술 문제를 깊이 파는 챌린지 글

레퍼런스 조사 (채널톡, 토스, 우아한형제들, 카카오, LINE) 결과,
**토스 스타일**(상단 수평 탭 + 1열 리스트 + 카테고리 뱃지)이 현재 규모(6편)에 가장 적합.

## 설계 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 카테고리 수 | 2개 (`journey`, `challenge`) | 현재 글 성격이 명확히 2분류 |
| 필터 UI | 상단 수평 탭 (전체/여정/챌린지) | 토스 레퍼런스, 6편에 사이드바는 과함 |
| 탭 상태 관리 | `useState` | SSG 환경, URL persistence 불필요 |
| Server/Client 경계 | HomePage(Server) → PostListWithFilter(Client) | fs 의존 getAllPosts는 서버, 필터 상태는 클라이언트 |
| 카테고리 뱃지 색상 | journey: brand(인디고), challenge: accent-4(앰버) | 기존 디자인 토큰 재활용, 시각적 구분 |
| 레이아웃 | 1열 리스트 유지 | 6편에 그리드는 과함 |

## 카테고리 매핑

| slug | category |
|------|----------|
| agent-orchestration-solo-dev | journey |
| system-architecture-overview | journey |
| orchestration-structure | journey |
| cicd-ai-guardrails | journey |
| sprint-journey | journey |
| session-policy-sync | challenge |

## 변경 파일 목록

### 1. `blog/src/lib/posts.ts` — Category 타입 + PostMeta 확장

- `Category` union type export: `'journey' | 'challenge'`
- `PostMeta`에 `category: Category` 추가
- `getAllPosts()` 매핑에 `category` 파싱 (fallback: `'journey'`)
- `getPostBySlug()` 반환값에도 `category` 명시 포함

### 2. `blog/src/lib/i18n.ts` — 카테고리 번역 키 추가

```
categoryAll: '전체' / 'All'
categoryJourney: '프로젝트 여정' / 'Project Journey'
categoryChallenge: '기술 챌린지' / 'Tech Challenge'
```

### 3. MDX frontmatter — 12개 파일 (KR 6 + EN 6)

각 포스트 frontmatter에 `category: "journey"` 또는 `category: "challenge"` 추가.

### 4. `blog/src/components/category-tabs.tsx` — 신규 Client Component

- 수평 탭 3개: 전체 / 프로젝트 여정 / 기술 챌린지
- 토스 스타일: 활성 탭 하단 인디케이터 (`after:` pseudo-element)
- 활성: `text-brand` + 하단 바, 비활성: `text-text-muted`
- `role="tablist"` / `role="tab"` / `aria-selected` 접근성

### 5. `blog/src/components/post-list-with-filter.tsx` — 신규 Client Component

- props: `posts: PostMeta[]`, `basePath: string`, `locale: Locale`
- `useState<Category | 'all'>('all')` 로 탭 상태 관리
- `filteredPosts = activeCategory === 'all' ? posts : posts.filter(...)`
- CategoryTabs + PostCard 리스트 렌더링

### 6. `blog/src/components/post-card.tsx` — 카테고리 뱃지 추가

- props에 `category: Category`, `locale: Locale` 추가
- 날짜 옆에 카테고리 뱃지 표시
- journey: `bg-brand-soft text-brand`, challenge: `bg-amber-50 text-amber-700`

### 7. `blog/src/components/home-page.tsx` — PostListWithFilter 연결

- `<ul>` 직접 렌더링 → `<PostListWithFilter>` 교체
- HomePage는 Server Component 유지

## 컴포넌트 트리 (변경 후)

```
HomePage (Server) — getAllPosts() 호출
  ├── <h1> siteTitle
  ├── <p> siteDescription
  └── PostListWithFilter (Client) — posts[] props
       ├── CategoryTabs (Client) — useState
       └── <ul> PostCard × N
            ├── date + category badge ← 신규
            ├── title
            ├── excerpt
            └── tags
```

## 구현 순서

| # | 작업 | 파일 |
|---|------|------|
| 1 | Category 타입 + PostMeta 확장 | `posts.ts` |
| 2 | i18n 딕셔너리 키 추가 | `i18n.ts` |
| 3 | MDX frontmatter에 category 추가 | 12개 .mdx |
| 4 | CategoryTabs 컴포넌트 생성 | `category-tabs.tsx` (신규) |
| 5 | PostListWithFilter 컴포넌트 생성 | `post-list-with-filter.tsx` (신규) |
| 6 | PostCard에 카테고리 뱃지 + locale prop | `post-card.tsx` |
| 7 | HomePage에서 PostListWithFilter 연결 | `home-page.tsx` |

## 검증

1. `cd blog && npm run build` — SSG 빌드 성공 확인
2. Docker build → k3d import → rollout restart
3. localhost:8099 메인 페이지:
   - "전체" 탭: 6개 포스트 모두 표시
   - "프로젝트 여정" 탭: 5개 포스트
   - "기술 챌린지" 탭: 1개 포스트
4. 각 카드에 카테고리 뱃지 정상 표시
5. EN 페이지 동일 동작 확인
6. 상세 페이지 → 다른 포스트 정상 렌더링 확인
