---
sprint: 177
title: "블로그 cross-check 결정론적 게이트 (시드 #18)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-176", "sprint-175", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 177 — 블로그 cross-check 결정론적 게이트

## 목표

- Sprint 157 #18(블로그 글 머지 전 도메인 사실 cross-check 자동화)을 7스프린트 이월 끝에 회수. 이월 블로커가 "검증 대상 범위 모호"였으므로 **범위 확정이 1순위**.
- 정석 사이클 준수: 단일 작업 브랜치 + PR + Squash merge + Critic(Codex) 교차 리뷰. 시드 #18 단일 PR(#307).

## 결정

### D1. 범위 컷 — prose 도메인 사실은 제외, 구조적 cross-check만 (사용자 승인)

블로그 글의 상당수 "도메인 사실"(예: `sprint-journey.mdx`의 "67개 스프린트", "2,432개 테스트", "branches 99.51%")은 **회고록 시점에 고정된 과거 스냅샷**이다. 현재 코드베이스 상태로 자동 검증하면 false-positive 를 양산하고(프로젝트는 Sprint 95~176 동안 계속 성장), 전면 prose 사실 검증은 LLM 영역이라 결정론적 hard gate 로 부적합하다. 따라서 prose 도메인 사실을 명시적으로 제외하고, 기존 결정론적 게이트 패턴(`check-i18n-residue.mjs`, `check-adr-index-count.mjs`)에 맞춰 **구조적 cross-check 3축**만 게이트화한다.

### D2. 의존성 0 제약

CI `quality-docs` 잡은 `npm install` 없이 repo 루트에서 node 스크립트를 실행한다(`gray-matter` 는 `blog/node_modules` 에만 존재 → 루트 import 불가). 그래서 게이트는 node 내장 모듈만 쓰고 frontmatter 를 경량 자체 파서로 직접 파싱한다.

### D3. 게이트 3축 (`scripts/check-blog-crosscheck.mjs`, `--strict`/`--lint`/기본, exit 0/1/2)

1. **KR↔EN 정합**: `blog/content/posts/`(KR 10) ↔ `posts-en/`(EN 10) slug 양방향 짝(고아 차단) + 구조 필드(date/category/order/tags/series/seriesOrder) 일치. title/excerpt 는 번역 대상이라 제외.
2. **frontmatter 스키마**: 필수 필드(title/date/excerpt/tags/category) + category enum {journey, challenge}(SSOT `blog/src/lib/posts.ts` VALID_CATEGORIES) + date `YYYY-MM-DD`(비문자열도 거부) + order 동일 date 내 유일.
3. **내부 링크 무결성**: 코드펜스/인라인 코드 제외(stripCode) 후 — 파일시스템 이탈/OS 절대 경로 거부 + locale-aware post 라우트(글은 자기 locale 라우트로만; fragment/query 정규화 후 슬러그 존재 검증). `/adr/...` 등 비-post 루트절대는 통과.

### D4. CI 배선

`ci.yml` `docs:` paths-filter 에 스크립트 등록 + `quality-docs` 잡에 `--strict` 스텝 추가. `blog/content/**/*.mdx` 변경 시 자동 트리거.

## 구현

### PR #307 `adceabf` — 블로그 cross-check 결정론적 게이트 (#18)

- `scripts/check-blog-crosscheck.mjs` 신규 485줄: D3 의 3축(parity/schema/link)을 node 내장 모듈만으로 구현 + 경량 frontmatter 자체 파서(D2). entry guard + export 순수 함수(`stripCode`/`classifyLink`/`checkPostRoute` 등) 패턴 답습.
- `.github/workflows/ci.yml` +4: `docs:` paths-filter 에 스크립트 등록 + `quality-docs` 잡 `--strict` 스텝.
- `blog/content/posts-en/toward-model-agnostic-harness.mdx` 1줄: EN dogfood(실제 locale-leak 버그 1건 회수, 아래 Critic R2 참조).

## Critic 사이클

`codex review --base main` 4라운드 — false-positive·false-negative 양방향을 순차 노출.

- **R1** (session `019e44dd-4d16-7110-ab9e-038810ed3595`): **P2 2건(false-positive)** —
  ① `extractLinks` 가 코드펜스 내부 예시 링크까지 스캔. 초기 dogfood 대상이던 `sliding-window-agent-context.mdx` line 239 가 사실 ```` ```markdown ```` 펜스 내부의 MEMORY.md 인덱스 예시였음이 드러남 → **초기 dogfood 자체가 false-positive** 였다.
  ② order 유일성을 locale 전역으로 강제했으나 `getAllPosts`(posts.ts)는 date 우선 정렬 후 동일 date 내에서만 order 를 tiebreaker 로 사용 → 다른 date 의 같은 order 는 false-positive.
  **수정(commit `b981006`)**: `stripCode` 헬퍼 추가(펜스 ```` ``` ````/`~~~` + info string, 멀티/단일 백틱) + order 키를 `${date}::${order}` 로 변경. 코드펜스 내부였던 dogfood mdx 변경은 revert(stripCode 후 자동 무시되므로 불필요).

- **R2** (session `019e44e2-0782-7b23-b5be-56d56bcf7c92`): **P2 2건(false-negative)** —
  ① `classifyLink` 가 locale 을 무시 → EN 글이 bare `/posts/foo` 링크해도 KO 파일만 있으면 통과(locale 누수). 실제 사례 `posts-en/toward-model-agnostic-harness.mdx`.
  ② date 가 문자열일 때만 형식 검증 → `date: 20260409`(숫자)면 우회.
  **수정(commit `da3e43c`)**: locale-aware `checkPostRoute`(자기 locale 라우트만 유효, 교차-locale 은 누수 위반) + **EN dogfood**(`posts-en/toward-model-agnostic-harness.mdx` 의 `/posts/baekjoon-gone` → `/en/posts/baekjoon-gone`, 실제 버그 1건) + date present 시 비문자열도 위반.

- **R3** (session `019e44e6-1000-7630-acae-fa71480b3264`): **P2 1건(false-negative)** — `checkPostRoute` 가 fragment/query suffix(`/posts/missing#section`, `?ref=foo`)를 `$` 앵커로 미매칭 → 통과. **수정(commit `771b954`)**: `href.split(/[#?]/)[0]` 정규화 후 슬러그 존재 검증.

- **R4** (session `019e44e8-edb2-7ad2-bf1a-be76f5ffaa45`): **0건** — "introduced issue 없음, 기존 동작·CI 안전". 머지 가능.

## 검증

### 로컬
- 게이트 `--strict` 현행 콘텐츠 0위반 exit 0.
- tamper 회귀 — parity(고아)/schema(category enum·order 동일 date 중복·비문자열 date)/link(코드펜스 밖 이탈→차단, 펜스 안→무시, locale 누수, fragment+미존재 슬러그) 각 위반 → exit 1, 원복 → exit 0.
- export 함수 인라인 assertion 전부 PASS.

### CI
- PR #307 38 checks green, `Quality — docs` SUCCESS 로 신규 게이트 dogfood 실증.

## 결과

- **머지**: origin/main `5e931e2` → `adceabf` (PR #307 squash merge).
- **순변경**: `scripts/check-blog-crosscheck.mjs` 485줄(신규) + `.github/workflows/ci.yml` +4 + `blog/content/posts-en/toward-model-agnostic-harness.mdx` 1줄(EN dogfood).

## 신규 패턴

- **결정론적 cross-check 의 범위 컷**: prose 도메인 사실(시점 고정 스냅샷)은 LLM 영역이라 게이트에서 제외하고, 구조적 불변식(parity/schema/link)만 결정론적으로 게이트한다. "검증 가능성"이 아니라 "결정론적 검증 가능성"으로 범위를 자른다.
- **코드펜스 인지 링크 검사**: 코드 블록/인라인 코드 내용은 렌더되는 앵커가 아니라 예시 텍스트라 배포 404 를 만들 수 없으므로 링크 검사에서 제외(false-positive 회피).
- **locale-aware 내부 링크**: i18n 콘텐츠는 자기 locale 의 라우트로만 링크해야 함 — 교차-locale 은 누수 위반.

## 교훈

- **Critic 교차 리뷰가 dogfood 전제 자체의 오류를 잡아냈다**: 초기 "깨진 링크" dogfood 가 사실 코드펜스 내부 예시였음을 R1 이 드러냄 → false-positive 회피가 게이트의 1순위 품질 기준(Sprint 175 계승)임을 실증.
- **false-positive(R1)와 false-negative(R2/R3)는 양방향 모두 게이트 정확도를 해친다**: adversarial 교차 리뷰가 양쪽을 순차 노출. 라운드별 적발 심각도는 콘텐츠 차단(R1) → 실제 버그(R2) → 이론적 엣지(R3)로 체감 감소.
- **미뤘던 후속이 구현 중 실제 인스턴스 발견으로 dogfood 전환**: locale-leak 은 플랜에서 후속으로 미뤘으나, 게이트 구현이 실제 버그(`/posts/baekjoon-gone` in EN)를 드러내 그 PR 에서 회수.

## 이월 항목 (Sprint 178+)

- 블로그 cross-check 추가 차원(향후 필요 시): reference-style 링크, 더 넓은 frontmatter 검증 등.
- plan 템플릿 잔여: sprint-157 잔재.
- UAT 사용자 직접 누적: #5 프로그래머스 재제출 채점 / #9 영문 Grafana CB dashboard + Sprint 160~177 누적.
- 기타 후속(sprint-176 §이월 계승): coverage-gate skipped 허용 제거, post-merge pre-deploy gate, prom-client 점검 자동화, `.claude-tools/` Phase 2 삭제, `(adr)` layout 분할 등.
