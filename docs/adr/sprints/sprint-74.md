---
sprint: 74
title: "블로그 UI 최적화 — 시각 컴포넌트 레이아웃 정정 · 본문 사실 검증 · 3-way 다크 테마"
date: "2026-04-10"
status: completed
agents: [Oracle, Palette, Scribe, Explore, Gatekeeper]
related_adrs: [sprint-73.md, sprint-72.md]
---

# Sprint 74: 블로그 UI 최적화

## Context

Sprint 73에서 블로그 시각 자산(shadow 11/11, 다크모드 토글, 포스트 네비)을 완결했으나, Scout 검증 과정에서 세 종류의 미해결 잔재가 드러났다: (1) HierarchyTree·ServiceCard 같은 일부 시각 컴포넌트에서 형제 rail 연결이 약하거나 긴 문구가 `truncate`로 잘리는 레이아웃 결함, (2) 본문 MDX에 하드코딩된 "Sprint 67 / 2,432 tests" 등의 **수치가 Sprint 73 완료 시점 실제 지표와 어긋남** (sprint-journey Phase 4 범위는 여전히 "56~67"로 표기), (3) Sprint 73 D5 Note로 이월된 **3-way 다크 테마 토글**(system 복귀 경로 부재).

Sprint 74는 이 세 축을 "블로그 UI 최적화"로 묶어 처리했다. 작업이 모두 `blog/` 하위 파일 경계에 머물고 서비스·인프라 영향이 없어, 각 작업을 Sprint 73 P2(구현 + 독립 검증 2단계)보다 가벼운 단일 세션 직렬 처리로 진행하되, 74-2의 본문 사실 검증은 4편의 포스트를 동시에 읽어야 해서 Explore 에이전트 4개를 **병렬로** 띄워 fact-check를 분할 처리했다. 74-3은 Sprint 73-6의 구현 기반(next-themes 0.4.6, `ThemeProvider` 래퍼, mounted 가드)을 **그대로 재활용**하여 `theme-toggle.tsx` 단일 파일 수정으로 완결했다.

결과적으로 본 스프린트는 Sprint 73 이월 항목 중 "3-way 토글"을 해결하면서, Sprint 72~73에 걸쳐 진행된 블로그 디자인 시리즈에 **사용자 실제 가독성 잔재(74-1)** 와 **콘텐츠 사실성(74-2)** 을 더해 완결지었다.

## Decisions

### D1: 시각 컴포넌트 레이아웃 정정 — truncate 제거 + flex-wrap 허용 (74-1)

- **Context**: `ArchService`/`ServiceCard`의 h4가 `truncate` 클래스로 고정되어 긴 서비스 이름(예: `github-worker`, `ai-analysis`)과 port가 동시에 렌더될 때 뒷부분이 말줄임표로 잘림. `HierarchyTree`는 형제 간 상단 rail이 `w-px` 1px 선으로만 그려져 다크모드에서 border 대비가 부족할 때 연결감이 약화. `HierarchyNode`는 Tier 섹션 라벨을 카드 위쪽에 별도 배치할 수단이 없어 11 에이전트를 Tier 1/2/3으로 그룹화할 때 섹션 헤더가 노드 사이에 어색하게 낀 상태.
- **Choice**:
  - `ServiceCard`/`ArchService`: `truncate` 제거 + `flex-wrap` + `leading-tight`로 긴 이름 + port를 같은 줄에 유지하되 공간 부족 시 자연스러운 줄바꿈 허용. 모바일에서도 잘림 방지.
  - `HierarchyTree`: 형제 rail과 hook 두께를 `w-0.5`/`h-0.5`로 **1px → 2px** 강화. border-on-border 대비 부족 환경에서도 가시성 확보.
  - `HierarchyNode`: `groupLabel` prop 신설 → Tier 섹션 라벨을 노드 위에 블록 요소로 렌더. `agent-orchestration-solo-dev.mdx`의 Conductor/Architect/Sensei 노드에 각각 Tier 1/2/3 라벨을 주입하여 11 에이전트를 3그룹으로 시각 분리.
  - `system-architecture-overview.mdx`의 ServiceCard port 표기는 `"9100 metrics"` → `"9100"`으로 정규화하고 metrics 맥락은 `role` 필드로 이관. port 필드의 의미론적 일관성(숫자 전용) 확보.
- **Alternatives**:
  - (A) 카드 가로폭 확장으로 truncate 허용 범위 늘리기 — 모바일에서 여전히 잘림, 반응형 한계 미해결
  - (B) HierarchyTree rail을 CSS `outline` 기반으로 전환 — 브라우저별 렌더링 차이 위험
  - (C) groupLabel 대신 `<HierarchySection>` 래퍼 컴포넌트 신설 — API 표면 확장 비용이 prop 추가보다 큼
- **Code Paths**: `blog/src/components/blog/hierarchy-tree.tsx` (+79/-37), `blog/src/components/blog/service-grid.tsx`, `blog/src/components/blog/architecture-map.tsx`, `blog/content/adr/agent-orchestration-solo-dev.mdx`, `blog/content/adr/system-architecture-overview.mdx`

### D2: 본문 사실 검증 — Explore 4 병렬 fact-check + 수치 일괄 정정 (74-2)

- **Context**: Sprint 72~73에서 블로그 디자인·시각 자산에 집중하는 동안, MDX 본문에 하드코딩된 스프린트/테스트 수치가 Sprint 67 완료 시점 기준으로 고정되어 있었음. 현재 Sprint 73 완료 시점(71개 스프린트, ~2,453 테스트)과 최대 6 스프린트 격차. 특히 `sprint-journey.mdx` Phase 4 범위가 `56~67`로 남아 최신 이정표(Sprint 70 시각자료, 71 세션 수명, 73 보안 핫픽스) 누락.
- **Choice**: 4편의 주요 포스트(agent-orchestration-solo-dev, meet-the-agents, orchestration-structure, sprint-journey)를 **Explore 에이전트 4개에 동시 위임**하여 fact-check 분할 처리. 각 Explore는 할당받은 포스트 1편의 모든 수치·스프린트 참조·이정표를 실제 자산(`docs/adr/sprints/`, MEMORY.md, sprint-window.md)과 대조. fact-check 결과는 Oracle이 수렴:
  - **system-architecture-overview** (100% 통과) + **cicd-ai-guardrails** ("CI 15 jobs"는 push-on-main 기준으로 정확) → **변경 없음**
  - **4편 정정**: "Sprint 3~67 / 65개 / 67개 / 67번" → "Sprint 3~73 / 71개 / 73개 / 73번" 통일, "2,432 tests" → "**약** 2,453" (`약` 접두사로 변동 방어)
  - `agent-orchestration-solo-dev`: Sprint 70대 이정표 1줄 추가 (시각자료·세션 4-layer·디자인 토큰화·보안 핫픽스)
  - `sprint-journey`: Phase 4 범위 `56~67` → `56~73` + PhaseMilestone 3건 추가 (Sprint 70/71/73), 말미 "Sprint 68은 비어있다" → "Sprint 74"
  - Sprint 67/63/64 등 역사적 사건 언급은 실제 ADR과 일치 확인 후 유지
- **Alternatives**:
  - (A) 단일 세션으로 4편 순차 fact-check — 한 세션이 4개 포스트의 맥락을 모두 잡고 있어야 해서 확증 편향 + 교차 대조 누락 위험. 병렬화로 각 Explore가 자기 포스트 1편에만 집중.
  - (B) MDX에 수치 대신 변수 참조(`<Metric name="sprintCount" />`) 도입 — 런타임 데이터 소스 설계 비용이 일회성 정정보다 큼. Sprint 72 이월 "Hero/MetricGrid" 작업에서 별도 다룰 것.
- **Code Paths**: `blog/content/adr/agent-orchestration-solo-dev.mdx`, `blog/content/adr/meet-the-agents.mdx`, `blog/content/adr/orchestration-structure.mdx`, `blog/content/adr/sprint-journey.mdx`
- **Note**: "약" 접두사 도입은 단순 오타 수정이 아니라 **변동 방어 표기** 전략. Sprint마다 테스트 수가 수십 건 단위로 변동하는 특성상 정확한 수치 표기는 매 스프린트 ADR 갱신과 함께 재정정 필요. `약 2,453`은 ±1% 내 변동을 허용.

### D3: 3-way 다크 테마 토글 — theme vs resolvedTheme 구분 (74-3)

- **Context**: Sprint 73-6(`0c250bf`)에서 next-themes 0.4.6 기반 다크모드 토글을 도입했지만 **light↔dark 2-way**만 지원. `resolvedTheme`만 읽어서 바이너리 판정을 하는 구조라 `theme === 'system'` 상태를 감지할 방법이 없었고, 한 번이라도 토글을 누르면 localStorage에 `theme=light|dark`가 고정되어 OS 다크모드 변화를 더 이상 추적하지 못함. 복귀 수단은 localStorage 수동 삭제뿐이라 Sprint 73 ADR D5 Note에 정식 이월.
- **Choice**: **구현 기반 재활용, 단일 파일 수정**. `theme-provider.tsx`는 이미 `defaultTheme="system"` + `enableSystem`으로 system을 지원하고 있어 변경 없음. `theme-toggle.tsx`에서 `resolvedTheme` → `theme`(사용자 선택) 기준으로 전환하여 `system → light → dark → system` 3-way 순환 구현:
  - `NEXT_MODE: Record<ThemeMode, ThemeMode>` 맵으로 순환 함수 정의
  - `MODE_LABEL: Record<ThemeMode, string>`으로 한국어 라벨 중앙화 ("시스템 추적" / "라이트 모드" / "다크 모드")
  - 아이콘 3종: `Monitor`(system) / `Sun`(light) / `Moon`(dark) — `lucide-react`는 Sprint 73-6에서 이미 번들에 포함되어 **의존성 추가 0건**
  - `aria-label` 포맷: `"현재: {상태}, 클릭하면 {다음}로 전환"` — 스크린리더가 3상태를 모두 구분 가능
  - `mounted` 가드 + placeholder는 Sprint 73-6 패턴 그대로 유지하여 SSR hydration mismatch 방지
  - `theme === undefined`(SSR) 또는 `'system'`인 경우 current를 `'system'`으로 폴백 처리
- **Alternatives**:
  - (A) 드롭다운 메뉴 + 3 라디오 옵션 — 명시적 선택 UX는 우수하나 Popover/DropdownMenu 구현 비용 + blog 패키지에 shadcn/ui 없어 의존성 추가 불가피. 블로그 주변 기능에 과투자.
  - (B) 별도 "시스템 추적" 체크박스 + 기존 2-way 유지 — 버튼이 2개로 늘어나 헤더 레이아웃 부담 + 체크박스 상태 동기화 복잡도
  - (C) localStorage `theme-mode` 커스텀 key로 3상태 자체 관리 — next-themes 의존을 우회해 기존 `theme-provider` 재구성 비용 초과
- **Code Paths**: `blog/src/components/theme-toggle.tsx` (+40/-13, 단일 파일)
- **Note**: 순환 방향 `system → light → dark → system`의 근거: 사용자가 `system`에 머물 때 `resolvedTheme`이 OS 선호를 이미 반영하고 있으므로 토글 의도는 **오버라이드**. `light`부터 시작해 `dark`를 거친 뒤 `system`으로 한 바퀴 완결하는 것이 의도 흐름과 일치. Sprint 73 D5 Note의 이월을 해결.

## Patterns

### P1: 다건 본문 사실 검증 병렬화 — Explore N 분할 (74-2)

- **Where**: `blog/content/adr/*.mdx` 본문 수치/이정표 정정
- **When to Reuse**: 기존 콘텐츠(문서·블로그·README)의 사실성을 검증해야 하고, (a) 검증 대상이 3건 이상이며 (b) 각 대상의 맥락이 독립적일 때. 단일 세션이 여러 포스트를 한 번에 잡으면 **맥락 간 교차 오염**(포스트 A의 수치를 무의식중에 포스트 B에 투영)과 **확증 편향**(이미 본 포스트의 "맞다"라는 기억이 다음 포스트 판단에 영향)이 발생. Explore 에이전트를 N개 띄워 각각 1편씩 할당하면 서로의 결론을 모르는 상태로 fact-check를 수행하여 교차 대조가 강제된다. 수렴은 Oracle이 결과 취합 후 정정 패치 단일 커밋으로 처리. 본 스프린트에서 4 Explore가 독립적으로 작업한 결과 2편(system-architecture-overview, cicd-ai-guardrails)은 "변경 없음" 판정 + 4편은 정정 필요로 명확히 분할됨. Sprint 73 P2의 "구현 + 독립 검증" 패턴을 **검증 전용 작업**으로 일반화한 형태.

### P2: `theme` vs `resolvedTheme` 구분 — next-themes 3상태 UI 기본기 (74-3)

- **Where**: `blog/src/components/theme-toggle.tsx` (next-themes 기반 테마 토글 UI)
- **When to Reuse**: next-themes로 `system` 모드를 포함한 3상태 UI를 구현할 때 **반드시** 두 값을 구분해서 사용. `theme`은 **사용자가 선택한 값**(`'system' | 'light' | 'dark' | undefined`)이고 `resolvedTheme`은 **실제 화면에 적용된 값**(`'light' | 'dark'`, system 선택 시 OS 선호가 매핑된 결과). 아이콘/라벨/`aria-label`처럼 "사용자의 의도"를 표현하는 UI는 `theme`을 읽어야 `system` 상태를 인지할 수 있고, 반대로 "실제 다크 여부"를 조건으로 하는 스타일 분기(예: 특정 이미지 경로 변경)는 `resolvedTheme`을 써야 system 모드에서도 OS 반영이 된다. `theme`은 SSR 시 `undefined`이므로 mount 가드 + 폴백(`'system'`) 로직 필수. Sprint 73-6이 `resolvedTheme`만 읽어 3상태 지원이 불가능했던 근본 원인이 바로 이 구분을 놓친 데 있었다.

## Gotchas

### G1: `truncate` 클래스는 flex 자식의 의미론적 "잘림"을 가린다 (74-1)

- **Symptom**: `ServiceCard`/`ArchService`의 h4에 `truncate`(= `overflow-hidden text-ellipsis whitespace-nowrap`)가 걸려 있어 `github-worker` 같은 긴 서비스 이름 + port 조합에서 이름 뒷부분이 `...`로 잘렸다. Sprint 70~72 시각자료 풍부화 기간 내내 이 잘림이 "디자인 의도"처럼 잔존했다.
- **Root Cause**: 카드 가로폭이 고정된 상황에서 긴 문구를 "깨끗하게" 처리하려고 `truncate`를 기본 적용한 초기 설계 결정이 고정관념으로 굳어졌다. 모바일 반응형 + 긴 이름 조합에서는 정보 손실로 귀결되는데, 검증 시점에는 주로 데스크톱에서 짧은 이름으로만 확인되어 체감 불가.
- **Fix**: `truncate` 제거 + `flex-wrap` + `leading-tight`. 공간이 충분할 때는 한 줄 유지, 부족할 때는 자연스러운 줄바꿈 허용. 줄바꿈 시 `leading-tight`이 두 줄 카드의 수직 리듬을 유지.
- **Lesson**: `truncate`는 "반드시 한 줄"이라는 강한 제약이 있을 때만 사용. 정보 자체가 잘려도 되는가를 먼저 질문할 것. 카드 컴포넌트의 문구 필드는 기본값을 **wrap 허용**으로 잡고, 특수한 경우에만 `truncate`를 명시적으로 추가하는 방향이 안전.

### G2: `resolvedTheme`만 읽으면 `system` 상태를 영원히 감지할 수 없다 (74-3 배경)

- **Symptom**: Sprint 73-6의 2-way 토글이 `const isDark = resolvedTheme === 'dark'` 한 줄로 상태를 판정. `system` 상태에서 OS가 dark면 `resolvedTheme === 'dark'`가 되어 토글이 `'light'`로 `setTheme`를 호출 → localStorage에 `theme=light`가 고정되고, 이후 아무리 OS 모드를 바꿔도 블로그는 `light`에 머무른다. 복귀 수단은 localStorage 수동 삭제뿐.
- **Root Cause**: `theme`(사용자 선택)과 `resolvedTheme`(적용 결과)의 차이를 모른 채 "다크 여부만 알면 토글 충분"이라는 가정으로 구현. next-themes 문서를 3상태 관점으로 읽지 않은 탓.
- **Fix**: 74-3에서 `theme`을 읽어 `'system' | 'light' | 'dark'` 3상태로 분기. `resolvedTheme`은 제거 (아이콘/라벨 판정에 불필요). mounted 가드는 그대로 유지하여 hydration mismatch 없음을 보장.
- **Lesson**: **next-themes를 쓸 때는 `theme`과 `resolvedTheme` 중 "어느 값을 읽을지"를 의식적으로 결정해야 한다**. 사용자의 의도를 표현하는 UI는 `theme`, 실제 적용 상태를 조건으로 하는 분기는 `resolvedTheme`. 둘 중 아무거나 써도 일단 돌아가는 것처럼 보이지만, `system` 모드가 관련되면 즉시 차이가 드러난다. P2에 일반화된 가이드로 기록.

## Metrics

- **작업 수**: 3건 (74-1 레이아웃 · 74-2 사실 검증 · 74-3 3-way 토글) + 1건 ADR
- **Commits (AlgoSu)**: 3건 (`86dcde9..5416168`)
  - `2450d6f` feat(blog): Sprint 74-1 블로그 시각 컴포넌트 레이아웃 정정 (5 files, +60/-37)
  - `54ee420` docs(blog): Sprint 74-2 게시물 본문 사실 검증 및 최신 지표 반영 (4 files, +33/-29)
  - `5416168` feat(blog): Sprint 74-3 블로그 3-way 다크 테마 토글 (system 복귀 경로 복원) (1 file, +40/-13)
  - (+ 본 ADR 커밋 1건 예정)
- **Commits (aether-gitops)**: 0건 (GitOps 반영은 자동 — `2d504fa` `2b374ed` `cd4151f` 3건의 이미지 태그 bump만)
- **Files changed (AlgoSu)**: 블로그 10개
  - 시각 컴포넌트 (3): `blog/src/components/blog/{hierarchy-tree,service-grid,architecture-map}.tsx`
  - 테마 토글 (1): `blog/src/components/theme-toggle.tsx`
  - MDX 본문 (6): `blog/content/adr/{agent-orchestration-solo-dev,meet-the-agents,orchestration-structure,sprint-journey,system-architecture-overview}.mdx` (system-architecture-overview는 74-1에서 port 정규화)
- **의존성 추가**: **0건** (74-3은 기존 `lucide-react`의 `Monitor` 아이콘 재활용)
- **빌드**: `cd blog && npm run build` 성공 (74-1/74-2/74-3 각 1회 + 빌드 후 검증)
  - Compiled 7.9s (74-3 최종), ✓ Generating static pages (10/10), ✓ Exporting (2/2)
  - First Load JS: 103 kB shared (변동 없음)
- **CI 연속 성공**: 3회 (`24222343109` 71 retrofit · `24223843443` 74-2 · `24224155079` 74-3, 각 2~3분)
- **CD 롤아웃**: 3회 (blog pod: `-9lrgd` → `-rj5c8` → `-h8xf6`)
- **ArgoCD**: `Synced / Healthy`, 최종 revision `cd4151f`
- **Sprint 73 이월 해결**: 1건 (D5 3-way 다크 테마 토글)
- **신규 토큰 정의**: 0건 (기존 `border-border`, `text-text-muted`, `text-brand` 재사용)

## Related

- **Sprint 73 ADR** — D5 Note(3-way 토글 이월)의 직접 해결, D6 Note(포스트 네비 레이블 재검토)는 본 스프린트 범위 밖으로 유지. 74-3은 Sprint 73-6의 구현 기반(next-themes 0.4.6, ThemeProvider, mounted 가드)을 **무수정 재활용**하여 단일 파일로 완결 — 최소 침습 원칙의 모범 사례.
- **Sprint 72 ADR** — D6(prose 커스터마이즈), D7(shadow 11/11) 등 블로그 시각 시리즈의 연속. 74-1은 Sprint 72에서 커버되지 않은 **내용 표시 레이어**(h4 truncate, HierarchyTree rail)의 잔재를 정리. 74-2의 "Hero/MetricGrid" 이월은 여전히 Sprint 72 이월 항목으로 유지.
- **Sprint 70 ADR** — 블로그 시각자료 풍부화의 기원. 74-2 sprint-journey Phase 4 범위 확장(56~73)은 Sprint 70~73의 이정표를 블로그 본문에 반영한 결과.
- **P2 (theme vs resolvedTheme)** — next-themes를 쓰는 모든 향후 블로그/프론트엔드 작업의 기본 가이드로 진입. Palette가 차기 작업 시 읽어야 할 체크포인트.
