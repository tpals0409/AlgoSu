---
sprint: 201
title: "블로그 ADR 검색(SearchBox/MiniSearch) 기능 제거"
date: "2026-05-22"
status: completed
agents: [Oracle, Herald, Critic]
related_adrs: ["sprint-193"]
related_memory: ["sprint-window"]
topics: ["blog", "frontend", "cleanup"]
tldr: "블로그 ADR 사이트 헤더의 MiniSearch 기반 클라이언트 사이드 전문 검색(SearchBox) 기능을 완전히 제거. Sprint 157에서 도입(minisearch 의존성 + 빌드 시 search-index.json 생성)된 검색은 ADR 렌더링(목록·상세·아카이브·토픽)과 독립적이라 삭제해도 다른 ADR 표시 기능에 영향이 없음. 착수 전 grep으로 검색 전용 자산과 공유 자산을 분리 — 검색 전용(minisearch 의존성·search* i18n 키·SearchDoc 타입·AdrIndex.searchDocs 죽은 필드·toSearchDoc/toPlainText)만 제거하고 공유 자산(kind*/metaSprint i18n 키, buildUrl/groupByKind/mapBySprint/filterAdrsByTopic 함수)은 보존. 1차 PR #355(d4660b0)로 blog/ 내부를 정리했으나, grep 범위를 blog/로 한정한 탓에 루트 scripts/check-adr-links.mjs가 삭제된 search-index.json 존재를 검증(exit 2)하는 것을 놓침 → CI #355의 Build Blog (SSG) 잡이 실제로 failure였으나 해당 잡이 branch-protection required check가 아니라 squash merge가 진행되어 main이 깨진 채 머지됨. /stop 게이트의 로컬 check-adr-links 실행이 이를 포착 → 후속 PR로 check-adr-links.mjs의 search-index 검증 로직 제거 + ci.yml paths-filter 주석 정리. tsc 0·next lint 0/0·build 329 pages(search-index.json 미재생성)·check-adr-links KR/EN exit 0·doc-refs 363 0broken·grep 잔존 0·Critic(Codex) Critical/High 0건."
---
# Sprint 201 — 블로그 ADR 검색(SearchBox/MiniSearch) 기능 제거

## 목표

- 블로그(`blog/`) ADR 사이트 헤더의 **MiniSearch 기반 클라이언트 사이드 전문 검색(SearchBox)** 기능을 완전히 제거한다.
- 검색 관련 코드·생성물·의존성·번역 키 + **검색 산출물을 검증하던 CI 게이트**까지 깔끔하게 제거하면서, ADR 사이트의 나머지 기능(목록·상세·아카이브·토픽 렌더)과 빌드·타입·lint·링크 무결성 게이트 정합성을 유지한다.

## 배경

- ADR 검색은 Sprint 157에서 도입됐다(`minisearch` 의존성 + `scripts/generate-search-index.mjs`로 빌드 시 `public/adr/search-index.json` 생성 → 런타임에 `fetch` + `MiniSearch`로 fuzzy 검색). 키보드 단축키 `/`로 열리고 ADR 제목·에이전트명·본문을 대상으로 검색하는 드롭다운 UI였다.
- 검색은 ADR 렌더링 파이프라인(loader/parser → `buildAdrIndex` → 목록·상세·아카이브·토픽 뷰)과 **독립적**이다. SearchBox는 `AdrHeader`에만 마운트되고 검색 인덱스(`search-index.json`)를 직접 fetch하므로, 삭제해도 다른 ADR 표시 기능에는 영향이 없다.
- 기술적 핵심: `AdrIndex.searchDocs` 필드는 `index-builder.ts`의 `buildAdrIndex`가 생성하지만, 그 사용처(`adr/page.tsx`·`archive/page.tsx`·`post-page.tsx`)는 모두 `.all`/`.byKind`/`.bySprint`만 읽고 `.searchDocs`는 한 번도 읽지 않는 **사실상 죽은 필드**였다. 따라서 제거 시 런타임 영향이 0이다.

## 결정

### D0. 검색 전용 vs 공유 자산 — 착수 전 grep으로 사전 분리

- 삭제 범위를 잘못 잡으면 ADR 렌더가 깨지므로, 착수 전 grep으로 **검색에서만 쓰는 자산**과 **검색 외 컴포넌트도 쓰는 공유 자산**을 분리했다.
  - **검색 전용 (삭제 안전)**: `minisearch` 의존성, `searchPlaceholder`/`searchAriaLabel`/`searchEmpty` i18n 키(SearchBox에서만 참조), `SearchDoc` 타입, `AdrIndex.searchDocs` 필드, `toSearchDoc`/`toPlainText` 함수.
  - **공유 (유지 필수)**: `kindPermanent`/`kindTopic`/`kindSprint`/`metaSprint` i18n 키 — `adr-card`·`adr-category-tabs`·`sprint-timeline`·`adr-meta-sidebar`에서도 사용. `buildUrl`/`groupByKind`/`mapBySprint`/`filterAdrsByTopic` — ADR 렌더에 계속 사용.

### D1. 완전 삭제 vs 수정 분류

- **완전 삭제 (3파일)**: `search-box.tsx`(검색 UI), `generate-search-index.mjs`(빌드 스크립트), `search-index.json`(생성물, `.gitignore` 대상이라 디스크에서만 제거).
- **수정 (5파일)**: `package.json`(prebuild 훅 + minisearch 의존성), `adr-header.tsx`(SearchBox 마운트), `i18n.ts`(search* 키), `types.ts`(SearchDoc 타입 + searchDocs 필드), `index-builder.ts`(검색 헬퍼 + searchDocs 반환).

### D2. minisearch 의존성·prebuild 훅 동반 제거

- 검색이 유일한 minisearch 소비처이므로 `dependencies.minisearch`를 제거하고 `npm install`로 lockfile을 동기화한다. `scripts.prebuild`(인덱스 생성 훅)도 함께 제거 → 빌드 시 `search-index.json`이 더 이상 재생성되지 않는다.

### D3. (후속) 검색 산출물을 검증하던 CI 게이트도 제거 — grep 범위 누락 교정

- 1차 작업의 grep 범위가 `blog/` 내부(src·scripts·package.json)로 한정돼, **루트 `scripts/check-adr-links.mjs`** 가 빌드 산출물의 `search-index.json` 존재 + entry count를 sanity check(누락 시 exit 2)하는 로직을 놓쳤다.
- search-index.json이 더 이상 생성되지 않으므로 이 게이트는 항상 실패한다. 따라서 `check-adr-links.mjs`의 search-index 검증 블록(헤더 주석·runMain의 3단계 체크·`checkSearchIndex` 함수·export)을 제거하고, **내부 링크 무결성 검사만** 남긴다(exit 0/1). `ci.yml` paths-filter 주석의 `generate-search-index.mjs` 언급도 정리한다.

## 구현

### 1차 — 검색 기능 제거 (1커밋, PR #355 squash → `d4660b0`)

- `689d0d6` chore(blog): ADR 검색(SearchBox/MiniSearch) 기능 제거 (8 files, +4/-520)
  - **삭제**: `blog/src/components/adr/search-box.tsx`(-265), `blog/scripts/generate-search-index.mjs`(-176), `blog/public/adr/search-index.json`(생성물, `git rm` 대상 아님 → `rm`).
  - **`package.json` / `package-lock.json`**: `prebuild` 훅 + `minisearch` 의존성 제거, `npm install`로 lockfile 동기화.
  - **`adr-header.tsx`**: `SearchBox` import + `<SearchBox />` 렌더 제거, `@related` 주석 정리(Blog 링크·LocaleToggle만 잔존).
  - **`i18n.ts`**: ko+en `searchPlaceholder`/`searchAriaLabel`/`searchEmpty` 제거. 키 타입은 `DictKey = keyof typeof DICTIONARY['ko']`로 자동 파생 → 별도 유니온 수정 불요. `kind*`/`metaSprint` 보존.
  - **`types.ts`**: `SearchDoc` 인터페이스 + `AdrIndex.searchDocs` 필드 제거.
  - **`index-builder.ts`**: `SearchDoc` import·`toSearchDoc`·`toPlainText`·`CODE_FENCE_RE`/`MD_SYMBOL_RE` 제거, `buildAdrIndex` 반환에서 `searchDocs` 제거. `buildUrl`/`groupByKind`/`mapBySprint`/`filterAdrsByTopic` 보존.

### 2차 — CI 게이트 정리 (후속 PR, /stop 게이트가 포착)

- `fix(ci): check-adr-links.mjs search-index 검증 제거 (Sprint 201 검색 삭제 후속)`
  - **`scripts/check-adr-links.mjs`**: search-index sanity check 블록 + `checkSearchIndex` 함수 + export + 관련 헤더 주석/exit 2 제거. 내부 링크 무결성 검사만 수행(exit 0/1). import는 모두 잔존 함수에서 계속 사용되어 유지.
  - **`.github/workflows/ci.yml`**: blog paths-filter 주석의 `generate-search-index.mjs` 언급 정리(`loader.ts(DIR_KIND_MAP)`만 남김 + Sprint 201 제거 메모).

## 검증

- **타입/빌드**: `tsc --noEmit` 0. `next lint` 0 errors / 0 warnings. `npm run build` — 329 static pages, ADR 라우트(KR/EN) 정상, prebuild 제거로 `search-index.json` 미재생성.
- **링크 무결성 게이트**: 수정된 `check-adr-links.mjs`로 KR(`blog/out/adr`)·EN(`blog/out/en/adr`) 모두 **exit 0**(151 HTML, ~1200 internal links all resolved, sprint-201 ADR 포함). 1차 직후엔 `[FAIL] search-index.json not found`(exit 2)였다.
- **기타 게이트**: `check-doc-refs.mjs` 363 files 0 broken. `check-adr-index-count.mjs --strict` sprint 139 일치. `check-adr-en-coverage.mjs --lint` 148/148.
- **grep 잔존**: `SearchBox`/`minisearch`/`searchDocs`/`SearchDoc`/`search-index`/`checkSearchIndex`/search* i18n → 전역 **0**(blog/ + 루트 scripts/).
- **Critic (1차)**: `codex review --base main`(Codex, 세션 `019e4eec-c0d8-7df3-becd-a9230ebb3156`) — Critical/High/Medium/Low **0건**("the deletion appears internally consistent"). 단, codex 리뷰 범위는 1차 diff(blog/ + package.json)였고 루트 게이트 스크립트는 범위 밖이라 search-index 게이트 누락은 미포착 → /stop 로컬 게이트가 보완 포착.
- **CI**: #355 Build Blog (SSG) 잡은 실제 **failure**(search-index 게이트)였으나 required check 미지정으로 머지됨. 후속 PR이 `docs/adr/sprints/**`·`docs/adr-en/sprints/**` 변경으로 Build Blog (SSG)를 재트리거 → 수정된 게이트로 통과.

## 교훈 / 패턴

- ① **기능 삭제 grep 범위는 "소비처 전체"로 확장 — blog/ 내부만 보면 루트 게이트 스크립트를 놓친다** — 삭제된 산출물(`search-index.json`)을 검증하던 게이트는 `blog/`가 아니라 루트 `scripts/`에 있었다. 1차 grep을 `blog/`로 한정해 이를 놓쳤고 main이 깨진 채 머지됐다. 산출물/심볼을 지울 땐 **레포 전역**(루트 scripts·CI 워크플로우 포함)에서 참조를 추적해야 한다.
- ② **CI 결과는 잡 단위 conclusion으로 확인 — `gh pr checks --watch | tail`의 `$?`는 tail의 exit이라 신뢰 불가** — 파이프 끝 `tail`의 exit(0)을 전체 CI 통과로 오판했다. 실제로는 `gh run view --json jobs -q '.jobs[]|{conclusion}'`로 잡별 conclusion을 봐야 하고, **required check가 아닌 잡은 failure여도 머지를 차단하지 않는다**(branch protection 설정에 의존).
- ③ **게이트 스크립트도 기능의 일부 — 삭제된 산출물을 검증하던 게이트는 함께 정리** — 검색을 지우면 검색 산출물을 검증하던 `check-adr-links.mjs`의 sanity check도 무효가 된다. 기능 삭제 시 그 산출물의 생산자(prebuild)뿐 아니라 **소비자(검증 게이트)** 도 동반 제거해야 파이프라인이 일관된다.
- ④ **죽은 필드는 함께 정리 / i18n 키 타입 자동 파생** — `AdrIndex.searchDocs`는 아무도 읽지 않던 빌드 부산물이라 함께 제거. `DictKey = keyof typeof DICTIONARY['ko']` 구조라 ko 사전에서 키만 빼도 타입 유니온이 자동으로 좁혀져 tsc가 잔존 참조를 검출한다.

## 신규 패턴

- **기능 제거 사전 grep — 레포 전역 분류** — 삭제 대상 기능의 심볼/산출물(컴포넌트·타입·필드·i18n 키·의존성·**빌드 산출물 + 그 산출물을 검증하는 루트 게이트/CI step**)을 레포 전역 grep으로 전수 추적해 "전용(삭제) / 공유(유지)"로 분류한 뒤 착수. blog/ 같은 하위 디렉토리로 grep을 한정하면 루트 게이트 누락 → CI 회귀를 부른다.

## 이월 항목

- **운영측 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영): problem_db에 `npm run migration:run`(jsonb 전환 + GIN, 런북 `SET statement_timeout=0`).
- (선택) **CI PYTHON_VERSION 3.12 → 3.13** 상향 (별도 스프린트).
- (선택) **Build Blog (SSG) 잡을 branch-protection required check로 승격** 검토 — 이번처럼 blog 게이트 failure가 머지를 차단하지 못한 사례 재발 방지.
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
