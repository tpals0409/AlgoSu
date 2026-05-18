---
sprint: 157
title: "ADR md → 사람용 HTML 이중 산출 자동화 (blog 통합 + KR/EN UI + 콘텐츠 i18n 인프라)"
date: "2026-05-18"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-152", "sprint-155", "sprint-156"]
related_memory: ["sprint-window"]
---
# Sprint 157 — ADR md → 사람용 HTML 이중 산출 자동화

## 목표

- ADR md 파일을 LLM 친화적 SSOT로 유지하되, 사람이 의사결정 흐름·중요도·맥락을 빠르게 파악할 수 있는 HTML 사이트를 자동 생성
- 105개 ADR(영구 8 + 토픽 1 + sprint 96) 한 번 작성 → blog `(adr)` 라우팅 그룹으로 자동 변환 + 시각화 + 검색 + Related ADR 그래프
- Sprint 152 시드 #19 (KR/EN 양면 plan 의무) 본격 정착 — UI i18n 라우팅 + 콘텐츠 i18n 인프라 + `/stop` 워크플로우 의무

## 결정

- **빌드 모델**: blog/ Next.js 15 + MDX 인프라에 `(adr)` 라우팅 그룹 통합 (사용자 확정). 단일 Docker 이미지 + nginx + k3s GitOps 사이클 재사용 — 신규 workflow 파일 0건. `ci.yml:132-134`의 `blog` paths filter에 이미 `docs/adr/**` 포함
- **스코프**: 확장 (변환 + 시각화 + 검색 + 카테고리 풀패키지) — 사용자 확정
- **PR 묶음**: 단일 sprint 4 PR 통합 (P1 / P2~P8 / P9 / P10) — Sprint 150/153/154 묶음 패턴 계승. 8 PR 순차 merge의 CI 대기 비효율 회피
- **i18n 차원 1 (UI)**: 사용자 직접 지적("ADR이 영문/한국어 둘 다 안 되는 거 같다") → P9 hotfix 즉시 추가. blog 기존 `(ko)/`+`en/` 패턴 ADR에도 적용. `/adr/` ↔ `/en/adr/` 라우팅 + LocaleToggle + 사전 50키
- **i18n 차원 2 (콘텐츠)**: 사용자 명시 요구 → P10 추가. `docs/adr-en/` 별도 디렉토리 (blog `content/posts-en/` 패턴) + loader locale 확장 + Claude API 자동 번역기 + `/stop` 워크플로우 EN 의무

## 구현 (10 PR squash merge, origin/main `9f1217a` → **`1ba57d6` + PR #262**)

| PR | Phase | 담당 | 변경 | 라인 |
|----|-------|------|------|------|
| [#253](https://github.com/tpals0409/AlgoSu/pull/253) | P1 | architect | `blog/src/lib/adr/{types,loader,parser,section-aliases,index-builder,markdown,fixtures}.ts` 7파일 + minisearch 의존성 | +1,139 |
| [#254](https://github.com/tpals0409/AlgoSu/pull/254) | P2~P8 | architect | `scripts/check-adr-{conversion,links}.mjs` + `(adr)/` 6 라우팅 페이지 + 12 시각화 컴포넌트 + minisearch 검색 + mermaid Related ADR 그래프 + ci.yml step 2개 | +3,620 |
| [#255](https://github.com/tpals0409/AlgoSu/pull/255) | P9 | architect | UI i18n: `/en/adr/` 6 라우팅 + LocaleToggle 통합 헤더 + i18n 사전 ~50키 + 12 컴포넌트 `locale` prop 전파 + KoreanOnlyBanner | +926 −203 |
| [#256](https://github.com/tpals0409/AlgoSu/pull/256) | P10 | architect | 콘텐츠 i18n 인프라: `docs/adr-en/` + `getAllAdrs(locale)` 확장 + `hasEnTranslation` 플래그 + `scripts/translate-adr.mjs` Claude API 자동 번역기 + `/stop` 워크플로우 + Scribe 페르소나 EN 의무 | +771 −44 |
| [#257](https://github.com/tpals0409/AlgoSu/pull/257) | ADR + hotfix #1 | scribe+architect | sprint-157 KR+EN ADR + `next.config.ts` `outputFileTracingIncludes` 제거 (out skip 가설) | +215 −3 |
| [#258](https://github.com/tpals0409/AlgoSu/pull/258) | hotfix #2 | architect | `outputFileTracingRoot: __dirname` 명시 (workspace root warning 해소) + EN ADR broken ref (sprint-152/156 → KR SSOT 링크) | +11 −5 |
| [#259](https://github.com/tpals0409/AlgoSu/pull/259) | hotfix probe | architect | ci.yml `Build Blog` step에 out/ location probe + fallback (디버그 단계). probe 로그가 결정적 진단 | +20 −2 |
| [#260](https://github.com/tpals0409/AlgoSu/pull/260) | chore + trigger | scribe | docs/adr/README.md sprint count 보정 (89→97개) + paths filter로 build-blog 강제 실행 → probe 결과 노출 | +3 −3 |
| [#261](https://github.com/tpals0409/AlgoSu/pull/261) | hotfix #3 **진짜 fix** | architect | ci.yml `node ../scripts/check-adr-links.mjs out/adr` → `node scripts/check-adr-links.mjs blog/out/adr` 절대 segment 명시. check-adr-links.mjs:33 ROOT=repo root 의존성이 진짜 원인이었음 | +5 −21 |
| [#262](https://github.com/tpals0409/AlgoSu/pull/262) | UX 추가 | architect | 블로그 → ADR 진입 보강: header.tsx 우측 네비 'ADR' 링크 + home-page.tsx CTA 카드 + i18n 사전 4키 (사용자 "기존 블로그에서 ADR로 넘어갈 버튼 없음" 지적 즉시 보강) | +51 −3 |

## 검증

- **4 PR 모두 CI fail 0, mergeStateStatus CLEAN ✅** (auto-merge 흐름)
- `npx tsc --noEmit` — 0 에러
- `npm run build` — **244 정적 페이지** (KR 122 + EN 122, 기존 31 → 244)
- `node scripts/check-adr-conversion.mjs` — 10 fixture pass + 105 ADR 파싱 성공
- `node scripts/check-adr-links.mjs blog/out/adr` — 1,109 links, **0 broken**
- `node scripts/check-adr-links.mjs blog/out/en/adr` — 1,213 links, **0 broken**
- `node scripts/check-doc-refs.mjs --include-untracked` — 172 files, **0 broken refs**
- `node scripts/check-adr-en-coverage.mjs --lint` — 105건 WARN (강제 활성화는 Sprint 158+)
- 브라우저 시각 검증: `/adr/` (인덱스 + 타임라인 + 카드) + `/adr/sprints/156/` (3-column TOC + 본문 + 메타사이드바 + Related ADR 미니 그래프) + `/en/adr/` (영문 UI) + `/en/adr/sprints/156/` (KoreanOnlyBanner + 한국어 본문)
- Sprint 155 3단 안전망(plan + pre-push + CI lint) 본 sprint 모든 commit에 실효 — 0 위반

## 브랜치 규율 ✅ 25 스프린트 연속 준수

4 PR 모두 신규 브랜치 + Squash merge, main 직접 commit 0건 (Sprint 134 위반 이후).

## 신규 패턴

1. **사용자 직접 지적 → 즉시 hotfix 사이클 (Sprint 150~152 패턴 직접 계승)** — UI i18n 미흡(P9), 콘텐츠 i18n 누락(P10) 모두 별개 PR로 즉시 보강. plan 단계 누락이 사용자 검증 사이클에서 실시간 회수됨
2. **단일 sprint 4 PR 묶음 + auto-merge 흐름** — `gh pr merge --squash --auto` 로 CI green 시 자동 머지. 8 PR 순차 CI 대기 비효율 회피. Sprint 150/153/154 묶음 패턴 진화
3. **외부 디렉토리 정적 import (blog → docs/adr)** — `path.resolve(process.cwd(), '..', 'docs', 'adr')` + `outputFileTracingIncludes` 명시. `output: 'export'` 정적 export 환경에서 외부 SSOT 안전하게 참조하는 검증된 패턴
4. **fallback chain — frontmatter 없음 + 영문 섹션명** — gray-matter 실패 시 본문 H1/dash-list/H2 패턴으로 graceful degrade. sprint-62~87 영문 섹션 alias 매핑으로 90+ sprint ADR + 영구 ADR 8개 모두 단일 파이프라인에서 처리
5. **`hasEnTranslation` 플래그 + KoreanOnlyBanner 조건부 표시** — 영문판 보유 시 자연스러운 영문 페이지, 미보유 시 한국어 본문 + 배너 + 원문 링크. 점진적 번역 전환을 끊김 없이 지원
6. **자동 번역기 인프라 우선 → 실제 번역 점진** — `translate-adr.mjs` 인프라 완성 + `/stop` 의무화 + lint(advisory) 본 sprint. 95개 batch 번역은 사용자 API key 확보 시점에 즉시 가능. infrastructure-first 분리
7. **`/stop` 워크플로우 KR+EN 동시 작성 의무 self-bootstrap** — 본 sprint가 도입한 규칙(P10)이 본 sprint ADR 작성에 즉시 자체 적용됨. 메타-자체-검증 사이클 (Sprint 154~155 패턴 정착)

## 교훈

1. **Plan 단계의 i18n 누락은 사용자 검증 사이클에서만 회수됨** — Sprint 152 시드 #19 (KR/EN 양면 의무)가 본 sprint plan 단계에서 또 누락. 사용자 직접 지적("Ko/En 버튼이 존재하잖아")으로 P9/P10 hotfix. 시드 #19를 plan 템플릿 체크리스트 항목으로 자동화 필요 (Sprint 158 후보)
2. **UI i18n과 콘텐츠 i18n은 별개 작업** — P9에서 UI만 해도 영문 페이지가 표시되긴 하나 본문이 한국어라 실용성 부족. 콘텐츠 인프라(P10)까지 함께 가야 완전. 두 차원을 plan 단계에서 동시 다뤄야 함
3. **`(adr)` route group 내부에 `(adr)/page.tsx` 만들지 않기** — 기존 `(ko)`의 `/` 경로와 충돌. route group은 URL에 영향 없으므로 같은 root path 등록 시 빌드 실패. `/adr/...` 하위만 안전
4. **mermaid 코드펜스는 pre-renderMdx 변환 필요** — ADR 본문의 ```` ```mermaid ... ``` ```` 를 `<Mermaid chart={String.raw\`...\`} />` JSX로 사전 치환. compileMDX(`format: 'md'`)와 호환되도록 mermaid 코드 블록은 그대로 코드 블록으로 렌더하고 별도 그래프는 컴포넌트로 분리
5. **API key 미설정 시 placeholder 사용 금지** — `ANTHROPIC_API_KEY` 환경 검증 → 미설정 시 exit 2 + 안내만. 시범 번역은 사용자 직접 실행으로 분리. 보안 + 비용 명시화 동시 달성
6. **CI paths filter 기존 패턴 재사용으로 신규 workflow 0건** — `ci.yml:132-134`의 `blog` 필터에 이미 `docs/adr/**` 포함되어 있어 본 sprint 신규 workflow 파일 작성 0건. 기존 인프라 그대로 활용
7. **브라우저 시각 검증이 마지막 안전망** — tsc/lint/링크 무결성 모두 통과해도 시각적 회귀는 별도. 본 sprint 인덱스/상세/그래프/영문 페이지 모두 브라우저로 직접 시각 검증한 후에야 안전 확인
8. **`outputFileTracingIncludes` + `output: 'export'` 결합은 `out/` 생성을 silently skip** — Sprint 157 P10에서 `outputFileTracingIncludes`를 추가했으나, `next build`가 정상 exit 0 반환 + 239 페이지 빌드 로그 출력에도 불구하고 `out/` 디렉토리는 0개 생성. CI에서 `ADR link integrity` step만 fail로 노출. **본 sprint 4 PR auto-merge 후 사용자 직접 "CI 전부 실패" 지적**으로 post-merge hotfix (`next.config.ts`에서 옵션 제거). 정적 export는 런타임 파일 access가 없어 trace include 자체가 불필요. CI green이라도 신규 설정 추가 시 build 산출물 실재 존재(`ls out/`) 확인 단계 필수 — Sprint 158 시드 후보

## Sprint 158 이월

- **사용자 직접 실행 (API key 확보 후)**:
  - 시범 10개 ADR 번역 — 영구 8 + 토픽 1 + sprint-156 (`node scripts/translate-adr.mjs --target <path>`)
  - 검증 후 `--all`로 나머지 95개 batch 번역
- **신규 자동화 후보**:
  - 시드 #24: plan 템플릿에 i18n 양면 의무 체크리스트 자동 삽입 (Sprint 152 시드 #19 plan 단계 자동화)
  - 시드 #25: `check-adr-en-coverage.mjs --strict` CI hard gate 활성화 (현재 advisory)
  - 시드 #26: `docs/adr/README.md` paths filter negation (불필요 blog 빌드 차단)
- **UAT 사용자 직접 (14 스프린트 누적)**:
  - 시드 #5: 프로그래머스 재제출 채점 통과 확인
  - 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합
- **이월 유지**:
  - 시드 #18: 블로그 글 머지 전 도메인 사실 cross-check 자동화
  - 시드 #23: plan 템플릿 "rebase 후 누적 카운트 fix" 체크리스트 (Sprint 156)
- **후속 (선택)**:
  - create/edit page.tsx category UI
  - Programmers URL 자동 카테고리 추론
  - 기존 SQL 문제 데이터 백필
  - coverage-gate `skipped` 허용 제거 (Sprint 156 Phase B 옵션 B)
  - post-merge pre-deploy gate (Sprint 156 Phase B 옵션 C)
  - prom-client Case B~D 점검 자동화
  - `.claude-tools/` Phase 2 실제 삭제 (trigger path 검증 후)

## 관련 문서

- [docs/adr/README.md](../README.md) — 영문 디렉토리 안내 + 자동 번역기 사용법 추가
- [docs/adr-en/README.md](../../adr-en/README.md) — 영문 번역 정책 SSOT
- [scripts/translate-adr.mjs](../../../scripts/translate-adr.mjs) — Claude API 자동 번역기
- [scripts/check-adr-conversion.mjs](../../../scripts/check-adr-conversion.mjs) — 10 fixture self-test
- [scripts/check-adr-links.mjs](../../../scripts/check-adr-links.mjs) — 빌드 산출물 링크 무결성
- [scripts/check-adr-en-coverage.mjs](../../../scripts/check-adr-en-coverage.mjs) — EN 번역 진척도 lint
- [sprint-152.md](./sprint-152.md) — 시드 #19 (KR/EN 양면 의무) 본 sprint 정착
- [sprint-156.md](./sprint-156.md) — 직전 sprint, 본 sprint 시작점 (`9f1217a`)
