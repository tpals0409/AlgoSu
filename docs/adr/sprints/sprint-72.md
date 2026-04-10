---
sprint: 72
title: "블로그 화면 디자인 개선 — 보여지는 디자인 전용 (Palette·Scout 합동 평가)"
date: "2026-04-10"
status: completed
agents: [Oracle, Palette, Scout, Herald, Gatekeeper, Scribe]
related_adrs: []
---

# Sprint 72: 블로그 화면 디자인 개선 — 보여지는 디자인 전용

## Context

`blog.algo-su.com`(Next.js 15 SSG + Tailwind 3 + MDX)은 Sprint 68에서 주제 기반 6편으로 콘텐츠가 재편되었고, Sprint 70에서 본문의 ASCII 다이어그램(36개)이 React 시각 컴포넌트 11종으로 전환되어 **구조·콘텐츠·컴포넌트 측면에서는 안정**된 상태였다. 그러나 사용자 피드백("화면을 개선하자")을 받은 시점에 **시각적 깊이감(shadow·hover), 타이포 위계, 여백 리듬, 토큰 일관성**은 손대지 않은 채였다.

PM이 작업의 성격을 명확히 분리했다: **"내용 개선이 아닌 보여지는 디자인 개선"**. 즉, MDX 본문/카피, Hero 메트릭 추가, 코드블록 복사버튼, 다크모드 토글, 포스트 네비게이션 등 **내용 추가나 기능 신설은 범위 밖**이며, 오직 "이미 있는 마크업이 어떻게 보이는가"만 다룬다.

이에 Oracle은 단독 판단 대신 두 에이전트의 합동 평가를 수행:

- **Palette** — 디자인 토큰/스타일 관점의 Before→After 제안 (10 섹션)
- **Scout** — 첫 방문자 관점의 시각적 약점 정찰 (TOP 12+)

두 평가의 **교집합**을 핵심 우선순위로 채택하고, Scout가 발견했지만 "내용/기능 추가" 성격이 짙은 항목(Hero 섹션, Back 네비, 다크모드 토글, 코드블록 복사버튼)은 Oracle 권한으로 **이번 스프린트에서 배제**하여 차기 이월 처리. 결과적으로 6개 작업단위(72-1 ~ 72-6)와 ADR(72-D)로 정제되었으며, 모든 작업은 **로컬 커밋 6건**으로 처리되었다.

이번 스프린트는 "Sprint 71 같은 버그 수정"이 아니라 **순수 디자인 폴리싱**이며, AlgoSu 12-Agent 체계에서 **Palette·Scout 합동 평가가 디자인 작업의 표준 진입 흐름**이 될 수 있음을 검증한 첫 사례이기도 하다.

## Decisions

### D1: 디자인 작업의 진입 흐름 — Oracle → Palette + Scout 합동 평가

- **Context**: 디자인 작업은 단일 에이전트 판단으로 결정하기 어렵다. Palette는 토큰/스타일 SSoT를 알지만 사용자 체감을 모르고, Scout는 사용자 체감을 안다고 주장하지만 토큰 시스템을 모른다. 한쪽만 묻고 진행하면 (a) 토큰 무시한 임의 하드코딩 또는 (b) 사용자가 체감 못 하는 토큰 정리에 그칠 위험.
- **Choice**: 디자인 작업 트리거 시 Oracle 스킬을 호출하여 **Palette와 Scout를 병렬로** 위임. Palette는 코드 기반 평가(파일:라인 인용 + Before→After 서술), Scout는 빌드 산출물/마크업 기반 사용자 관점 평가(첫 방문자의 느낌). Oracle이 두 결과의 교집합과 차집합을 정리하여 우선순위 후보로 환원, 범위(내용/기능 추가) 위반 항목을 차단한 뒤 PM에게 제출.
- **Alternatives**:
  - PM이 직접 AskUserQuestion으로 범위를 좁히고 단일 작업단위 진행 — PM 인지 부하가 크고, 에이전트 체계 활용도 낮음. 실제로 본 스프린트 초기에 시도했다가 기각됨.
  - Palette 단독 평가 — 사용자 체감 검증 부재로 "토큰 정리는 됐지만 첫인상이 그대로"인 결과 위험.
- **Code Paths**: `agents/commands/palette.md`, `agents/commands/scout.md`, `.claude/commands/algosu-oracle.md`
- **Note**: 본 결정은 [memory feedback_design_workflow.md](file:///root/.claude/projects/-root-AlgoSu/memory/feedback_design_workflow.md)에 영구 기록되어 차후 디자인 작업의 표준 워크플로우가 됨.

### D2: 색상·보더 하드코딩의 전수 토큰화 (72-1)

- **Context**: `text-gray-500/600/400`, `border-gray-200`, `dark:border-gray-800`, `text-brand-500/600/700`, `bg-brand-50` 등 Tailwind 팔레트 색을 직접 사용하는 클래스가 페이지/카드/시각 컴포넌트에 산재. 또한 11개 시각 컴포넌트 모두에 `style={{ borderColor: 'var(--border)' }}` 인라인 React style이 박혀 있어 토큰을 우회하는 이중 경로가 존재.
- **Choice**: 일대일 치환 규칙으로 전수 변환:
  ```
  text-gray-500/600     → text-text-muted
  text-gray-400         → text-text-subtle
  border-gray-200       → border-border
  dark:border-gray-800  → (제거, --border 가 .dark에서 자동 반전)
  text-brand-600        → text-brand
  text-brand-700        → text-brand-strong
  bg-brand-50           → bg-brand-soft
  hover:border-brand-500 → hover:border-brand
  ```
  인라인 `style={{ borderColor/backgroundColor: 'var(--...)' }}` 14건은 모두 제거하고 `border-border` / `bg-border-strong` Tailwind 토큰 클래스로 통일. body에 `bg-surface text-text` 명시.
- **Alternatives**: 점진적 치환 — 신규 작업단위에서 또 하드코딩이 재발할 우려. 한 번에 grep 0건 상태로 만들고 이후 작업단위가 그 위에서 출발하는 것이 안전.
- **Code Paths**: `blog/src/app/layout.tsx`, `blog/src/app/page.tsx`, `blog/src/app/posts/[slug]/page.tsx`, `blog/src/components/post-card.tsx`, `blog/src/components/blog/{architecture-map,hierarchy-tree,kv,mermaid,metric-grid,phase-timeline,pipeline,service-grid,tier-matrix,tier-stack}.tsx`

### D3: 여백·리듬 재분배 (72-1)

- **Context**: 헤더가 `py-4`로 갑갑하고, 홈 부제가 `mb-10`으로 과한 간격을 가져 본문(포스트 카드 목록) 진입까지 시각적 리듬이 끊어졌다.
- **Choice**: 헤더 `py-4 → py-6`, 홈 부제 `mb-10 → mb-8`. 본문 컨테이너 `max-w-3xl`, 포스트 목록 `space-y-6`은 이미 양호하므로 유지.
- **Alternatives**: 모든 페이지의 여백을 일괄 재정의 — 회귀 위험 큼. 가장 체감되는 두 지점만 손대고 나머지는 72-2/72-3에서 컴포넌트 단위로 재정렬.
- **Code Paths**: `blog/src/app/layout.tsx`, `blog/src/app/page.tsx`

### D4: 포스트 헤더의 시각 위계 강화 (72-3)

- **Context**: 포스트 상세 진입 시 첫 화면이 `text-3xl font-bold mb-2` 제목 + `text-sm text-gray-500` 날짜 + `text-xs bg-brand-50 py-0.5` 태그로, 시각 위계가 거의 평탄. 사용자가 "이 글이 무엇이고 언제 쓰였고 어떤 카테고리인지"를 한눈에 파악하기 어렵다.
- **Choice**: 단일 컴포넌트 변경으로 4가지 동시 개선:
  1. h1: `text-3xl mb-2` → `text-4xl mb-4 leading-tight tracking-tight` (한글 자간 + 줄높이 + 중량감)
  2. 태그 컨테이너: `mt-2 gap-2` → `mt-4 gap-3` (호흡감)
  3. 태그 칩: `py-0.5` → `py-1 font-medium` (가독성)
  4. 헤더 블록 하단에 `border-b border-border pb-8 mb-10` 추가 → 본문(prose)과 시각 구분선 확보
- **Alternatives**: hero 이미지 추가 — **내용/자산 추가 성격**으로 범위 밖. 시그니처 추가 — 동일 사유로 차기 이월.
- **Code Paths**: `blog/src/app/posts/[slug]/page.tsx`

### D5: 홈 PostCard 다축 인터랙션 (72-2)

- **Context**: 홈 카드는 `border-gray-200 p-5 hover:border-brand-500` 으로, 호버 시 색만 바뀌고 깊이감/움직임/그림자 변화가 전무. 첫 방문자가 "이게 클릭 가능한 카드"라고 느끼기 어렵고, 6개 카드가 모두 동일 톤으로 단조롭다.
- **Choice**: PostCard에 **3축 호버 피드백**(border + shadow + translate) + 내부 위계 재정렬:
  - 컨테이너: `shadow-sm` 기본 + `hover:shadow-md hover:border-brand hover:-translate-y-0.5 transition-all duration-200`
  - 패딩: `p-5 → p-6`
  - 날짜를 상단 `text-xs uppercase tracking-wide text-text-subtle` 메타로 승격
  - 제목: `text-lg font-semibold → text-xl font-bold leading-snug` + `group-hover:text-brand` (카드 전체가 `<a>`이므로 group 활용)
  - 발췌: `line-clamp-2 leading-relaxed` (영역 안정)
  - 태그는 72-3과 동일 토큰 재사용 (스프린트 내 일관성)
  - focus-visible ring으로 키보드 포커스 시각화
- **Alternatives**:
  - 카드별 accent 색 분산 — Palette가 권고했으나 "최신글 강조" 외엔 의미 부여 약함, 6편 모두 같은 날짜라 불필요. 보류.
  - 썸네일 이미지 도입 — public 디렉토리 비어있고 자산 제작 필요, 범위 밖.
- **Code Paths**: `blog/src/components/post-card.tsx`

### D6: prose 본문 요소의 토큰 기반 커스터마이즈 확장 (72-4)

- **Context**: `@tailwindcss/typography` 플러그인의 `.prose` 기본값에 거의 그대로 의존. globals.css에 table/inline code/blockquote 3종만 최소 보정되어 있고, h2/h3 위계, 링크 underline, strong/em 가중치, ul/ol marker, hr 여백 등은 전부 plugin 기본값. 결과적으로 본문이 "특별함 없는 표준 마크다운"으로 보임.
- **Choice**: globals.css `@layer components`에 **8종 요소** 토큰 기반 규칙 추가:
  - h2/h3/h4: 상하 여백·크기·자간·가중치 재정의 (섹션 경계 강조)
  - p: line-height 1.75 (한글 가독성)
  - a: `text-brand` + `underline-offset 2` + `decoration 2` + `transition`, hover `text-brand-strong`
  - strong/em: 가중치/색 명시
  - ul/ol/li: 여백·padding·marker 색 정렬
  - hr: 상하 2.5rem + `border-border`
  - 인라인 code: padding `0.375rem → 0.5rem`, radius/font-size 강화
  - blockquote: 좌측 bar `4px → 6px`, 배경 `surface-muted → brand-soft` (대비 강화)
- **Alternatives**:
  - shiki/Prism 전환으로 코드블록 신택스 강화 — 빌드 도구 교체, 범위 밖.
  - prose에 sans-serif 전용 한글 폰트 도입 — 웹폰트 로딩/성능, 범위 밖.
- **Code Paths**: `blog/src/app/globals.css` (`@layer components` 8종 추가, 기존 table/code/blockquote는 보강)
- **Note**: 모든 색상은 기존 CSS variable 재사용 — **신규 토큰 정의 0건**.

### D7: 대표 카드 4종에 shadow-sm 기본 적용 (72-5)

- **Context**: 시각 컴포넌트 11종 중 깊이감이 거의 없음. ArchService만 `hover:shadow-md`를 가지고 있고 default shadow는 부재. PostCard(72-2)에서 `shadow-sm`을 도입한 후 본문의 카드들이 상대적으로 평평하게 느껴지는 회귀 발생.
- **Choice**: 11종 전수 정규화는 범위가 과도(L 작업량) → **대표 4종**(Callout, MetricCard, ServiceCard, ArchService)에만 `shadow-sm` 기본 추가. ArchService는 기존 `hover:shadow-md` 유지로 인터랙티브 강도 그대로. 다크 모드에서 shadow는 약하지만 기존 `border-border` 토큰이 .dark에서 자동 반전되어 명도 차로 분리감 유지.
- **Alternatives**:
  - 11종 전수 적용 — 작업량 L + 다양한 컴포넌트(Pipeline 화살표, TierStack 매트릭스, HierarchyTree 트리 등) 각각의 시각 정합성 검증 필요. 차기 스프린트로 분리.
- **Code Paths**: `blog/src/components/blog/{callout,metric-grid,service-grid,architecture-map}.tsx`

### D8: 인터랙션 base layer (72-6)

- **Context**: 링크 트랜지션과 키보드 포커스 시각화가 전역 수준에서 정의되지 않음. 컴포넌트마다 `transition` 클래스가 산발적이거나 누락되어 있고, focus-visible 처리도 PostCard(72-2)에만 명시.
- **Choice**: globals.css `@layer base`에 `a` 전역 `transition: color 150ms ease` + `a/button:focus-visible` 시 `box-shadow` 2단(2px surface offset + 2px brand ring)으로 ring + offset 표현. Tailwind `ring-offset` 등가의 효과를 CSS만으로 구현하여 다크모드에서도 `--surface`가 자동 반전됨에 의해 자동 대응.
- **Alternatives**:
  - shadcn/ui 도입 — 블로그는 shadcn 미사용 환경이며, 단일 utility 추가에 framework 도입은 과잉.
  - utility-only Tailwind base config 확장 — `tailwind.config.ts`의 plugin 추가로 표현 가능하나, CSS variable 직접 활용이 더 직관적.
- **Code Paths**: `blog/src/app/globals.css` (`@layer base` 확장)
- **Note**: PostCard는 72-2에서 focus-visible ring을 이미 inline으로 명시했고, 전역 규칙과 표현이 동일하므로 중복 무해, 유지.

## Patterns

### P1: Oracle → Palette + Scout 합동 평가 워크플로우

- **Where**: 본 스프린트 전체. `agents/commands/palette.md` + `agents/commands/scout.md`의 역할 분담을 디자인 작업에서 병렬로 호출.
- **When to Reuse**: 디자인/UI/시각 개선 작업이 들어왔을 때. 특히 (a) 작업 범위가 복수 컴포넌트/페이지에 걸치고, (b) "어디서부터 손대야 할지" 명확하지 않으며, (c) 단순 typo/색상 1건 수정 같은 trivial 작업이 아닌 경우. Oracle 스킬을 호출하면서 두 에이전트에 각각 명확한 역할(Palette: 코드 기반 토큰 평가 / Scout: 사용자 관점 시각 약점)과 **공통 제약**(내용 변경 금지, 기능 추가 금지, 플랜모드 read-only)을 부여. Oracle이 두 결과의 교집합을 우선순위로, 차집합을 대안 후보로 정리한 후 범위 위반 항목은 차단하여 최종 작업 후보 리스트를 PM에게 환원. PM은 우선순위만 승인하면 즉시 작업단위 분할 가능.

### P2: 토큰 SSoT의 grep 0건 보증

- **Where**: `blog/src/**` 전수 치환 (D2)
- **When to Reuse**: 디자인 토큰을 도입한 프로젝트에서 "그래서 모든 색이 토큰을 경유하는가"는 grep으로만 검증 가능. 작업단위 종료 시 `rg "text-gray-|border-gray-|dark:border-gray-|brand-(50|500|600|700|900)" src/` 결과가 0건이어야 토큰 SSoT가 깨지지 않은 것으로 간주. inline `style={{ borderColor/backgroundColor: 'var(--...)' }}` 도 동일하게 grep으로 0건 보증해야 한다 (Tailwind 토큰을 우회하는 경로가 되기 때문). 본 스프린트는 작업단위 1번에 통합하여 이후 작업이 청정 상태에서 출발하도록 했다.

### P3: 다축 호버 피드백 (border + shadow + translate)

- **Where**: `blog/src/components/post-card.tsx` (D5)
- **When to Reuse**: 클릭 가능한 카드/패널/리스트 아이템에 hover 피드백을 줄 때, 단일 축(색만 변경)은 사용자가 "이게 인터랙티브"라고 인지하는 강도가 약하다. **3축 동시 변화**(border 색 + shadow 강도 + translate 위치)를 하나의 `transition-all duration-200`으로 묶으면 깊이감/움직임/하이라이트가 동시에 일어나 인터랙티브 강도가 극대화. 다크 모드에서 shadow 약화 시에도 나머지 2축이 피드백을 유지하므로 라이트/다크 모두에서 안정. focus-visible ring을 추가하면 키보드 사용자에게도 동일 강도 제공.

### P4: prose 커스터마이즈 — 토큰 재사용 우선

- **Where**: `blog/src/app/globals.css` `@layer components` (D6)
- **When to Reuse**: `@tailwindcss/typography`를 쓰면서 본문에 브랜드 색·다크모드·한글 가독성을 입히고 싶을 때, prose의 변수 시스템(`--tw-prose-*`)을 만지기보다 globals.css `@layer components`에서 `.prose 자식선택자`를 직접 정의하는 것이 더 직관적이고 토큰 재사용에 유리. 핵심 원칙: **신규 CSS variable 정의 금지**, 기존 토큰만 사용. 색은 `var(--brand)`/`var(--text-muted)` 식으로 직접 참조하여 다크모드 자동 대응. 한글 가독성을 위해 `line-height 1.75`, `letter-spacing -0.01em`을 적용. blockquote는 좌측 bar 두께(4px → 6px)와 배경(surface-muted → brand-soft)으로 대비를 강화.

## Gotchas

### G1: inline `style={{ var('--token') }}` 가 토큰 시스템을 우회

- **Symptom**: `tailwind.config.ts`에 `border-border` / `bg-border-strong` 토큰이 매핑되어 있는데도 11개 시각 컴포넌트가 `style={{ borderColor: 'var(--border)' }}` 인라인 React style로 직접 CSS variable을 참조. 결과: Tailwind 클래스 grep으로는 토큰 사용 여부가 보이지 않고, 디자인 토큰 변경 시 영향 범위 추적이 어려워짐.
- **Root Cause**: 컴포넌트 작성 초기에 Tailwind 토큰 매핑이 부족했거나, 작성자가 `tailwind.config.ts`를 모르고 CSS variable로 우회 처리. 한 번 박히면 grep 누락으로 영구화.
- **Fix**: 작업단위 1번에 14건 전수 제거. `border-border`/`bg-border-strong`은 이미 `tailwind.config.ts`에 매핑되어 있어 클래스 치환만으로 가능. 이후 `rg "style=\{\{" blog/src/components/blog` 가 0건임을 게이트로 사용.
- **Lesson**: 디자인 토큰 SSoT 정책이 있는 프로젝트에서는 **inline style 자체를 코드 리뷰에서 차단**하는 것이 가장 안전. ESLint `react/forbid-component-props` + `@typescript-eslint/no-restricted-syntax` 룰로 강제 가능. 본 스프린트에서는 룰 도입까지는 가지 않았으나 향후 검토 가치 있음.

### G2: 다크 모드에서 shadow 가 보이지 않음

- **Symptom**: PostCard / Callout / MetricCard 에 `shadow-sm` 을 적용해도 다크 모드에서는 어두운 surface 위에 어두운 shadow가 묻혀 거의 평평하게 보임. shadow에 의존한 깊이감은 라이트 모드 전용.
- **Root Cause**: shadow는 본질적으로 "배경보다 어두운 영역"으로 깊이를 표현하는데, 다크 배경에서는 추가로 어두워질 여지가 적음. `dark:shadow-*` variant를 따로 정의해도 명도 차가 크게 안 나옴.
- **Fix**: shadow는 라이트 모드 전용 깊이감으로 받아들이고, 다크 모드에서는 **border 명도 차**(`border-border`가 `.dark`에서 `gray-800`/`gray-900` 톤으로 자동 반전)와 **카드 배경의 surface-elevated** 로 분리감을 표현. shadow class 자체는 다크 variant를 추가하지 않고 그대로 둠 — 약하지만 무해.
- **Lesson**: 다크 모드 카드 디자인은 "shadow를 빼고도 분리되는가"를 기준으로 검증해야 한다. shadow가 깊이의 유일한 단서면 다크에서 평평해진다. border 토큰의 명도 차 또는 surface 계층(surface / surface-muted / surface-elevated) 차를 우선 활용.

### G3: prose 기본값 의존이 만드는 "특색 없는 본문"

- **Symptom**: `@tailwindcss/typography`의 `.prose` 클래스만 적용한 상태로 둘 경우, 본문은 깔끔하지만 **개성/브랜드 색이 전혀 안 묻은 표준 마크다운** 으로 보임. 특히 h2/h3 위계가 약하고 링크가 prose 내부 색만 사용하며, blockquote가 plugin 기본 회색 좌측 bar로 평탄.
- **Root Cause**: prose plugin은 "범용 안전망" 목적으로 디자인이 의도적으로 중립적. 브랜드 컬러나 강조 효과는 호스트 사이트가 별도로 입혀야 한다.
- **Fix**: globals.css `@layer components` 에서 `.prose 자식선택자` 8종을 직접 재정의 (D6 P4 참조). prose 기본값을 덮어쓰기보다 **누락된 위계와 강조를 보강**하는 방식으로 접근. 모든 색상은 기존 토큰을 재사용해 다크모드 자동 대응.
- **Lesson**: prose plugin을 도입했다고 해서 "본문 디자인 끝"이 아니다. plugin은 기초 안전망이고, 브랜드 특색은 host CSS에서 추가로 입혀야 한다. 첫 도입 시점에 "h2/h3, a, blockquote, code, hr 5종은 반드시 커스터마이즈한다"를 체크리스트로 두는 게 안전.

### G4: PM의 "내용 vs 디자인" 경계 인지

- **Symptom**: Scout가 발견한 "Hero/한눈 요약 부재", "다음 글 카드 부재", "코드블록 복사버튼 부재", "다크모드 토글 부재" 등은 모두 시각적 약점이지만, 해결하려면 **콘텐츠 추가** 또는 **Client Component 신설/기능 추가**가 필요. PM이 "내용이 아닌 보여지는 디자인"이라고 명시한 범위와 충돌.
- **Root Cause**: "보기 좋은 화면"이라는 목표가 (a) 기존 마크업 스타일링과 (b) 마크업 자체의 구조 변경/추가를 함께 함의함. 구분 없이 진행하면 범위가 무한 확장됨.
- **Fix**: Oracle이 평가 종합 단계에서 "**내용/기능 추가** vs **순수 스타일링**"을 이분법으로 분리. 전자는 전부 차기 스프린트로 이월하고 후자만 작업단위로 분할. PM 승인 시 명시적으로 "이월 항목 리스트"를 함께 전달하여 범위 합의를 문서화.
- **Lesson**: 디자인 작업 의뢰 시 "보여지는 디자인 = 마크업/콘텐츠는 그대로 두고 스타일링만"이라는 정의를 PM과 합의하고, Scout 같은 사용자 관점 에이전트의 제안이 범위를 넘으면 Oracle이 명시적으로 차단해야 한다. 이 경계 결정 자체를 ADR(D1, G4)에 남겨 차후 디자인 작업의 표준 분리선이 되게 한다.

## Metrics

- **Commits (AlgoSu)**: 6건 (`b272b7a..bdc4cd3`)
  - `b272b7a` chore(blog): 색·보더 토큰화 + 헤더·홈 여백 리듬 재조정 (72-1)
  - `cf120f1` style(blog): 포스트 헤더 타이포·여백 리디자인 (72-3)
  - `02907c2` style(blog): PostCard 시각적 위계·인터랙션 강화 (72-2)
  - `2c23302` style(blog): prose 본문 요소 스타일 확장 (72-4)
  - `24a4253` style(blog): 카드 컴포넌트 shadow 일관성 정리 (72-5)
  - `bdc4cd3` style(blog): 전역 transition·focus-visible 추가 (72-6)
  - (+ 본 ADR 커밋 1건 예정)
- **Files changed (AlgoSu)**: 16 files
  - 페이지 (3): `blog/src/app/layout.tsx`, `blog/src/app/page.tsx`, `blog/src/app/posts/[slug]/page.tsx`
  - 카드 (1): `blog/src/components/post-card.tsx`
  - 시각 컴포넌트 (11): `blog/src/components/blog/{architecture-map,callout,hierarchy-tree,kv,mermaid,metric-grid,phase-timeline,pipeline,service-grid,tier-matrix,tier-stack}.tsx`
  - 글로벌 CSS (1): `blog/src/app/globals.css`
  - 문서 (1): `docs/adr/sprints/sprint-72.md` (이 파일)
- **Files changed (aether-gitops)**: 0 (블로그 매니페스트 변경 없음 — 이미지 재빌드만 필요)
- **Lines**: 약 +153 / -84 (코드만; ADR 제외)
- **빌드**: `cd blog && npm run build` 모든 작업단위 종료 시 통과 (10 페이지 SSG, First Load JS 103-104 kB 유지)
- **신규 외부 의존**: 없음
- **신규 CSS variable / Tailwind 토큰**: 없음 (기존 토큰 재사용 100%)

## 후속 권장 (Sprint 72 범위 외)

MEMORY.md 후속 처리 섹션에 추가 권장:

- **다크모드 토글 UI 도입** — 다크모드는 기술적으로 구현되어 있으나 토글 진입점이 없어 사용자가 활성화 불가. `next-themes` 도입 + 헤더에 해/달 아이콘 토글 + localStorage 지속성. Client Component 신설 필요.
- **코드블록 언어 라벨 + 복사 버튼** — Client Component(`code-block.tsx`) 신설. shiki/Prism 전환과 함께 검토하면 신택스 하이라이팅도 풍부화 가능.
- **Hero / 한눈 요약 섹션** — 홈 첫 화면에 "67 sprints / 2,432 tests / 12 agents / 6 services" 메트릭 카드. **내용 추가**이므로 PM 별도 결정 필요. MetricGrid 컴포넌트 재사용 가능.
- **포스트 → 목록 back 네비, 다음/이전 글 카드** — 포스트 상세 페이지 상단 "← 블로그 홈" + 하단 "다음 글" 카드. 정보 아키텍처 변경이므로 별도 작업단위.
- **시각 컴포넌트 11종 전수 shadow 정규화** — 본 스프린트에서 4종(Callout/Metric/Service/ArchService)만 처리. 나머지 7종(Pipeline/TierStack/TierMatrix/PhaseTimeline/HierarchyTree/Mermaid/KV)은 차기 스프린트로 이월. 각 컴포넌트의 시각 정합성 검증 필요.
- **inline `style={{ }}` ESLint 룰 도입** — 토큰 시스템 우회 차단(G1 lesson). `react/forbid-component-props` 또는 커스텀 룰로 강제.
- **nginx trailing slash 패턴 보강** — `blog/nginx.conf` `try_files` 패턴을 `$uri $uri.html $uri/index.html =404`로 보강. Sprint 70 잔여 항목, MEMORY.md에 이미 등록되어 있음.
