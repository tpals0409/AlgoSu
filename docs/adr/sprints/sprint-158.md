---
sprint: 158
title: "ADR KR/EN 번역 누락분 일괄 보강 (블로그 게시 ADR 양면 완전화)"
date: "2026-05-19"
status: completed
agents: [Oracle, Scribe, Architect]
related_adrs: ["sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 158 — ADR KR/EN 번역 누락분 일괄 보강

## 목표

- Sprint 157 P10 (콘텐츠 i18n 인프라)에서 도입한 `docs/adr-en/` 구조에 실제 영문판 콘텐츠를 채워 EN coverage 1/106 (0.9%) → 106/106 (100%) 달성
- Scribe 직접 번역 방식으로 API key 의존 제거 (`scripts/translate-adr.mjs` 미사용)
- Sprint 157 시드 #25 (`check-adr-en-coverage --strict` CI hard gate) 정착으로 회귀 자동 차단
- 사용자 직접 지적 → 즉시 hotfix 사이클(Sprint 157 패턴 계승)로 UI i18n 매칭 누락 4건 보강

## 결정

- **번역 방식**: 사용자 옵션 확정 — `translate-adr.mjs` (Claude API, ANTHROPIC_API_KEY 필요) 미사용, **Scribe Agent 직접 번역**. Claude 세션 자체가 번역 능력을 가지므로 API key 우회 + 비용 0
- **batch 분할 (Phase B 95개)**: 3 병렬 Agent로 분할 (B-1: sprint-40~87-plan 30개 / B-2: sprint-91~127 37개 / B-3: sprint-128~155 28개) — 단일 Agent 컨텍스트 부담 분산 + 시간 단축
- **Phase 분리**: Phase A (시범 10개 — 영구 8 + sprint-156 + topics/sprint-95) → 검증 → Phase B (전체 95개) → Phase C (CI gate). 시범 단계의 품질 확인 후 전체 batch 진행으로 위험 최소화
- **CI hard gate 동시 활성화 (시드 #25 정착)**: Phase B에서 100% 도달 후 즉시 `--strict` step을 `quality-docs` job에 추가 → 신규 ADR EN 누락 시 CI fail로 회귀 자동 차단
- **번역 정책**: `docs/adr-en/README.md` 정책 준수 — frontmatter 보존(title만 영문화), 기술 용어(Outbox/Saga/MSA/Gateway 등) 영문 유지, 코드블록/PR 링크/파일 경로/sprint 슬러그 100% 보존, mermaid 노드 라벨만 번역
- **의도적 한국어 보존 허용**: i18n bilingual reference 테이블, KR 블로그 원문 인용(sprint-100), regex 패턴(`주차`/`월`), accessibility 라벨 예시(`일요일`), 코드 리터럴(`'알림'`/`'분류'` 등), API 쿼리 예시(`query=입문`)는 의도적 보존 — 9 EN sprint pages에 잔존

## 구현 (2 PR squash merge, origin/main `1ba57d6` → **`a73c596`**)

| PR | Phase | Owner | 변경 내용 | Lines |
|----|-------|-------|----------|-------|
| [#269](https://github.com/tpals0409/AlgoSu/pull/269) | Phase A/B/C (3 commit) | scribe×4 + architect | 105 ADR EN 번역 + CI hard gate | +14,939 |
| [#270](https://github.com/tpals0409/AlgoSu/pull/270) | hotfix UI i18n | architect | EN 페이지 한국어 노출 4지점 보강 | +20 −6 |

### PR #269 세부 (Phase A/B/C)

**Phase A — 영구 8 + 토픽 1 + sprint-156 = 10개** (commit 22b7cc5, +1,292):
- 영구 ADR 8개: ADR-001 (Gateway → Identity DB Separation), ADR-002 (Outbox Pattern), ADR-003 (Redis/RabbitMQ ACL), ADR-024 (Admin Server-side Guard), ADR-025 (Gateway OAuth Error Normalization), ADR-026 (Stuck Rollouts & Sealed Secrets Debt), ADR-027 (Aether GitOps Branch Discipline), ADR-028 (Dev Cluster Separation)
- 스프린트 1개: sprint-156 (Sprint 150 미해소 자동화 부채 3건 묶음)
- 토픽 1개: topics/sprint-95-programmers-dataset
- 2 병렬 Agent (영구 8 / 스프린트+토픽 2)

**Phase B — 스프린트 95개** (commit 86734c9, +13,643):
- B-1 (30): sprint-40, 48, 51, 62~71, 72~87, 87-plan
- B-2 (37): sprint-91~99 (프로그래머스 이전), 100~127 (CI 리팩토링)
- B-3 (28): sprint-128~155 (안전망 + 최근)
- 3 병렬 Agent 동시 실행 — 단일 세션 컨텍스트 부담 분산

**Phase C — CI hard gate** (commit 0509d91, +4 −1):
- `.github/workflows/ci.yml` `quality-docs` job에 step 추가:
  ```yaml
  - name: Check ADR EN coverage (strict)
    run: node scripts/check-adr-en-coverage.mjs --strict
  ```
- `detect-changes` paths filter에 `scripts/check-adr-en-coverage.mjs` 추가
- `docs/adr-en/README.md` coverage tracking 섹션 갱신 (advisory → hard gate)

### PR #270 세부 (hotfix UI i18n)

**사용자 직접 지적**: "영문번역본이 매칭이 안되어있는거같은데?" → 빌드 산출물 분석으로 4지점 발견:

1. **`blog/src/app/(adr)/layout.tsx`** — 메타 description 하드코딩 한국어 → 영문 단일화
   - `"AlgoSu 프로젝트의 아키텍처 결정 기록"` → `"architecture decisions and sprint retrospectives"`
2. **`blog/src/components/locale-toggle.tsx`** — aria-label/title 비대칭 (EN 페이지에서 KR 노출, KR 페이지에서 EN 노출)
   - 수정: `isEn ? 'Switch to Korean' : '영어로 전환'` (각 locale에서 자국어)
3. **`blog/src/components/blog/code-block.tsx`** — copy 버튼 "코드 복사"/"복사"/"복사됨" 한국어 하드코딩
   - 수정: `usePathname()` 기반 locale 감지 → `t(locale, ...)` 적용
4. **`blog/src/lib/i18n.ts`** — codeBlockCopy/Copied/CopyAriaLabel keys 추가 (KR/EN)

**효과**: EN sprint pages 한국어 잔재 **96 → 9** (남은 9건 모두 ADR 본문의 의도적 보존)

## 검증

- 4 PR (#269 Phase A/B/C + #270 hotfix) 모두 CI fail 0, mergeStateStatus CLEAN ✅
- `node scripts/check-adr-en-coverage.mjs --strict` → **106/106 (100.0%)** exit 0 ✅
- `node scripts/check-adr-links.mjs blog/out/adr` → 108 HTML, 1,125 links, 0 broken ✅
- `node scripts/check-adr-links.mjs blog/out/en/adr` → 108 HTML, 1,125 links, 0 broken ✅
- `node scripts/check-doc-refs.mjs` → 279 files, 0 broken refs ✅
- `npm run build` (blog) → 240 정적 페이지 (KR 108 + EN 108 ADR pages + 24 posts) ✅
- 한국어 잔재 grep: 이전 96 EN sprint pages → 9 (모두 의도적 보존)
- 의도적 보존 9 페이지 1건씩 정밀 검증: 블로그 KR 원문 인용 / i18n bilingual 매핑 / regex 패턴 / accessibility 라벨 / 코드 리터럴 / API 쿼리 예시 — 번역 누락 0건

## 브랜치 규율 ✅

- 3 PR 모두 신규 브랜치 + Squash merge — **26 스프린트 연속 준수** (Sprint 134 위반 이후)
- main 직접 commit 0건
- 작업 브랜치: `feat/sprint-158-adr-en-batch` (#269), `fix/sprint-158-ui-i18n-hotfix` (#270)

## 신규 패턴

1. **Scribe 직접 번역 + 병렬 batch 분할 패턴** — API key 의존 제거. 105개 ADR을 5개 Scribe Agent (영구 8 / 스프린트+토픽 2 / sprint-40~87 30 / sprint-91~127 37 / sprint-128~155 28)로 병렬 처리. `translate-adr.mjs` 인프라 미사용으로 비용 0, Sprint 157 시드 #19 콘텐츠 정착 단계의 대규모 batch 모델
2. **사용자 지적 → 즉시 빌드 산출물 분석 → 정확 진단 → hotfix 사이클** — "영문번역본이 매칭 안 됨" 지적에서 빌드된 EN HTML grep으로 한국어 잔재 위치 정확 파악(코드 line 단위). description/LocaleToggle/code-block 3개 컴포넌트 정확히 식별 → 4 commit 단일 PR. 추측 사이클 회피(Sprint 157 probe 패턴 직접 계승)
3. **CI hard gate 동시 활성화 (Phase B 100% 도달 직후)** — 인프라 정착 → 콘텐츠 채움 → 회귀 차단을 단일 sprint 내 완결. Sprint 157의 advisory(WARN) → Sprint 158의 strict(FAIL) 전환을 콘텐츠 100% 시점에 안전하게 진행. "측정 → 강화" 순서 패턴(Sprint 156 옵션 A 패턴 계승)
4. **본문 잔존 한국어를 9건 페이지별 1건씩 정밀 검증** — 일괄 "한국어 잔재 = 결함" 분류 회피. i18n 코드 리터럴/블로그 원문 인용/regex 설명/accessibility 라벨은 의도적 보존이므로 별도 분류. 정밀 검증 결과 번역 누락 0건 확인
5. **메타 description vs UI 텍스트 vs 본문 텍스트 — 3계층 i18n 누락 분리** — Phase C로 본문(`docs/adr-en/*.md`) 100% 매칭 완료 후, UI 매칭(description/LocaleToggle/code-block)이 별개 결함으로 노출. 사용자 검증 사이클에서만 회수됨. Sprint 159 시드 #30 후보: "i18n 매칭 체크리스트 3계층 (메타/UI/본문) 분리"

## 교훈

1. **번역 인프라 ≠ 실제 매칭 완전화** — Sprint 157에서 `translate-adr.mjs` + `getAllAdrs(locale)` + KoreanOnlyBanner를 완비했지만, 본문 매칭 외 description/UI 텍스트는 별도 누락. UI i18n과 콘텐츠 i18n과 메타 i18n은 모두 분리해서 점검 필요
2. **PR 머지 후 사용자 직접 지적이 마지막 안전망** — `--strict` CI gate, link integrity, doc-ref-lint, 브라우저 빌드 검증 모두 통과해도 "EN 페이지에 한국어가 보인다"는 사용자 시각 검증만 잡아냄. Sprint 157 hotfix 사이클 패턴이 본 sprint에 즉시 재현
3. **빌드 산출물 grep이 정확 진단 도구** — 코드 소스가 아닌 빌드된 HTML에서 한국어 grep으로 정확한 잔재 위치 파악 가능. `(adr)/layout.tsx`, `locale-toggle.tsx`, `code-block.tsx` 3개 컴포넌트를 단번에 식별. 사용자 추측 사이클 없이 4 commit hotfix로 완결
4. **Scribe 병렬 batch 분할로 단일 세션 토큰 부담 회피** — 105 ADR을 한 Agent에 위임 시 컨텍스트 한계. 3개 병렬 Agent (30+37+28) + 2 Agent (8+2) = 5 Agent 분산이 안전. 각 Agent 110K~166K tokens 사용 (단일 Agent였다면 ~400K+ 위험)
5. **commit 메시지 scope 사전 확인 필수** — commitlint scope-enum에 `adr-en`은 없음 → 첫 commit fail → `docs(adr)` scope로 재시도. 본 sprint scope-enum: `[adr, ai-analysis, blog, ci, deps, docs, e2e, frontend, gateway, github-worker, identity, infra, problem, runbook, security, submission]`. 신규 scope 추가는 CLAUDE.md 의식적 결정 사항
6. **`(adr)` layout이 KR+EN 공용 → 메타 description i18n 불가능 (정적 export 환경)** — `headers()` API는 static export에서 동작 안 함. layout 분할(`(adr)/layout.tsx` KR + `(adr)/en/adr/layout.tsx` EN override) 또는 description 영문 단일화. 본 sprint는 후자 선택 (가장 단순). 추후 layout 분할은 Sprint 159+ 이월
7. **본문 한국어 잔재 9건은 모두 의도적 — 일괄 "결함" 분류 회피** — i18n bilingual reference (sprint-122), 코드 리터럴 (sprint-87/125), 블로그 원문 인용 (sprint-100), regex 패턴 (sprint-123/126), accessibility 라벨 (sprint-146), 톤 변경 예시 (sprint-86), API 쿼리 예시 (sprint-98) 모두 보존 정당. 정밀 분류가 사용자 안내의 핵심

## Sprint 159 이월

### 사용자 직접 실행 (선택)
- 시드 #30 후보 (신규): blog `header.tsx` / `footer.tsx` / `(en)/layout.tsx` 등 다른 UI 컴포넌트의 한국어 잔재 추가 점검

### 신규 자동화 후보
- 시드 #30: 빌드 산출물 한국어 잔재 자동 검증 CI step — `grep -lE "[가-힣]" blog/out/en/**/*.html` 화이트리스트 기반 (의도적 보존만 통과). Sprint 158 hotfix 사이클 자동화
- 시드 #31: i18n 매칭 체크리스트 3계층 분리 (메타 description / UI 텍스트 / 본문) — plan 템플릿 자동 적용

### Sprint 157 이월 시드 (계속)
- 시드 #24: plan 템플릿 i18n 양면 의무 체크리스트 자동
- 시드 #25: ✅ **본 sprint 정착** (CI hard gate 활성화 완료)
- 시드 #26: `docs/adr/README.md` paths filter negation (불필요 blog 빌드 차단)
- 시드 #27: CI build-blog job `ls out/` 산출물 실재 검증 step
- 시드 #28: `check-adr-links.mjs` ROOT 자동 감지
- 시드 #29: plan 템플릿 "신규 CI step 추가 시 probe step 동반 의무"

### UAT 사용자 직접 (15 스프린트 누적)
- 시드 #5: 프로그래머스 재제출 채점 통과 확인
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합

### 이월 유지
- 시드 #18: 블로그 글 머지 전 도메인 사실 cross-check 자동화
- 시드 #23: plan 템플릿 "rebase 후 누적 카운트 fix" 체크리스트

### 후속 (선택)
- create/edit page.tsx category UI
- Programmers URL 자동 카테고리 추론
- 기존 SQL 문제 데이터 백필
- coverage-gate `skipped` 허용 제거 (Sprint 156 Phase B 옵션 B)
- post-merge pre-deploy gate (Sprint 156 Phase B 옵션 C)
- prom-client Case B~D 점검 자동화
- `.claude-tools/` Phase 2 실제 삭제 (trigger path 검증 후)
- `(adr)` layout 분할 (KR + EN override) — Sprint 158 description 단일화의 대안
