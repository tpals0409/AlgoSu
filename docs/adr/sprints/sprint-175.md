---
sprint: 175
title: "이월 시드 회수 — PR 템플릿 · blog 트리거 · i18n 잔재 게이트 (시드 #24/#23/#171/#26/#27/#30/#31)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Herald, Critic, Scribe]
related_adrs: ["sprint-174", "sprint-171", "sprint-158", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 175 — 이월 시드 회수 (PR 템플릿 · blog 트리거 · i18n 잔재 게이트)

## 목표

- Sprint 174 에서 보안 민감 단건(#신규7) 회수 후 남은 **계승 이월 시드**를 시드별 독립 PR 로 회수.
- 우선순위 3종: ① plan/PR 템플릿 보강(#24/#23/#171), ② ADR/blog CI 보강(#26/#27/#28), ③ i18n/lint(#30/#31).
- **회귀 격리**: 시드별 독립 PR + Critic(Codex) 교차 리뷰 + Squash merge.

## 결정

### D0. #28 은 이미 구현됨 → 작업 제외

`check-adr-links.mjs` 의 ROOT 자동 감지는 `scripts/check-adr-links.mjs:33`(`resolve(import.meta.dirname, '..')`) + `deriveOutRoot()` 로 이미 구현되어 있어 추가 작업 불요로 판정. ADR/blog 보강은 #26/#27 두 건으로 축소.

### D1. #26 — 부정 패턴이 아닌 positive glob narrowing

dorny/paths-filter 소스(`src/filter.ts`)를 직접 검증한 결과, 각 패턴을 개별 `picomatch` 로 컴파일한 뒤 기본 `predicate-quantifier: some`(OR) 로 결합한다. 따라서 blog 필터에 `!docs/adr/README.md` 부정 패턴을 추가해도 `docs/adr/**` 가 OR 로 먼저 매치되어 **README 제외가 무력화**된다(부정은 `every` 콴티파이어에서만 동작하나, `every` 는 단일 dorny step 의 모든 필터를 파괴). 그러므로 부정 대신 **blog SSG 가 실제 소비하는 소스와 일치하는 positive glob** 으로 좁힌다.

- 소비처: `blog/src/lib/adr/loader.ts`(`DIR_KIND_MAP = [sprints, topics]`) + `blog/scripts/generate-search-index.mjs` → 루트 `ADR-*.md` + `sprints/` + `topics/` 만 읽고 `README.md` 는 명시적 제외(`loader.ts:62`, `generate-search-index.mjs:86`).
- `'docs/adr/**'` → `'docs/adr/ADR-*.md'` + `'docs/adr/sprints/**'` + `'docs/adr/topics/**'`.
- picomatch 시뮬레이션으로 `docs/adr/README.md` skip / 실 ADR 콘텐츠 trigger 확인.

### D2. #27 — out/ fail-fast 가드

`next build`(output:export) 가 무음 실패하면 빈 `out/` 가 그대로 Docker COPY 되어 빈 사이트가 배포될 수 있다. 링크 검사 이전에 `out/` 존재·비어있지 않음을 검증하는 step 을 둔다.

### D3. #30/#31 — 빌드 산출물 대신 번역 소스 게이트(shift-left)

빌드 산출물(`out/en/**`) 직접 Hangul grep 은 정당한 KR-fallback 배너 페이지(`hasEnTranslation=false`)를 false-positive 로 차단한다. 대신 번역 **소스**(`docs/adr-en/**/*.md`)의 prose Hangul 밀도를 게이트한다. blog `/en` ADR 본문은 `docs/adr-en` 를 그대로 렌더(`loader.ts readLocalized`)하므로 소스 게이트가 빌드 산출물 한국어 잔재를 shift-left 로 차단하면서 배너 false-positive 를 회피한다.

- **i18n 3계층**: 계층1 KR SSOT 존재 → 계층2 EN 파일 존재(`check-adr-en-coverage --strict`, 기존) → 계층3 EN 실제 번역(`check-i18n-residue --strict`, 신규).
- 코드펜스/인라인 코드 제외(한국어 로그·커밋 예시는 정당) + 비율 임계(기본 8%) AND 절대 하한(10자) 동시 충족 시에만 위반. 현재 코퍼스 최대 prose Hangul 2.19% 대비 3.6x 여유.

## 구현 (시드별 독립 PR)

### PR #300 `9b8f964` — PR 템플릿 보강 (#24/#23/#171)

`docs(ci): PR 템플릿에 문서 양면/소비처/누적카운트 체크리스트 추가`

- `.github/pull_request_template.md` 에 「문서/ADR 변경」(KR+EN 양면 #24, rebase 후 README 누적 카운트 #23) + 「신규 산출물 — 채택 ≠ 소비」(#171) 섹션 추가. 기존 섹션 스타일(`>` 근거 블록쿼트) 답습.

### PR #301 `43fe210` — blog 트리거 + out/ 검증 (#26/#27)

`ci(blog): blog 트리거 소비처 일치 + SSG out/ 산출물 검증`

- `ci.yml` detect-changes blog 필터를 소비처 일치 positive glob 으로 narrowing(README 제외).
- build-blog 잡에 `Verify SSG output (out/)` fail-fast step 추가.

### PR #302 `966fa56` — i18n 잔재 게이트 (#30/#31)

`feat(ci): EN ADR 한국어 잔재 게이트 (i18n 계층 3)`

- `scripts/check-i18n-residue.mjs` 신규 — en-coverage 구조 답습(ROOT 자동감지/`--strict`/exit 0·1·2/entry guard/export), `collectAdrFiles` 재사용(DRY). 모드: 통계/`--lint`/`--strict`/`--max-ratio=N`.
- `ci.yml` quality-docs 잡에 residue `--strict` step + docs paths-filter 등록.
- `docs/adr-en/README.md` 에 i18n 3계층 모델 문서화.

## Critic 사이클

- **PR1** (`codex review --base main`, 세션 `019e442b-eaa7-7483-bbcc-9d61f8097889`): 0건 — "PR 템플릿 체크리스트 가이드만, 런타임 무영향".
- **PR2** (세션 `019e4432-db17-7d62-a5a6-5bccdd71e8fa`): 0건 — "path-filter narrowing + SSG output 검증 일관, 기존 워크플로우 미파손".
- **PR3** (세션 `019e443b-ef00-7f81-b493-b6edd046ce0e`): 0건 — "신규 CI 체크/스크립트 정상 동작, docs 품질 게이트 통합".

세 PR 모두 P0~P3 0건으로 1회 리뷰 통과.

## 검증

### 로컬
- `check-i18n-residue --strict`: 122개 EN 파일 PASS(max prose Hangul 2.19% < 8%).
- export 함수 단위 9/9(영문/stub 94.1%/코드펜스 제외/인라인 제외/절대하한/옵션파싱), 에러 경로 exit 2, import 무부작용.
- `check-doc-refs`(311 files, 0 broken) / `check-adr-en-coverage --strict`(122/122) / `check-regex-robustness` clean.
- ci.yml 외부 YAML + dorny 내부 filters YAML 파싱 검증, picomatch 매칭 시뮬레이션 전 케이스 통과.

### CI
- PR #300/#301/#302 각각 CI green(mergeStateStatus CLEAN) 후 Squash merge.

### UAT 신규 (Sprint 175)
- 실 사용자 직접: group 분석 절단 응답 시 부분 복구 결과 프론트 렌더(Sprint 174 계승), 영문 blog `/en` ADR 한국어 잔재 시각 확인.

## 결과

- **머지**: origin/main `3f938fe` → `966fa56` (PR #300 `9b8f964` / #301 `43fe210` / #302 `966fa56`, 모두 squash merge)
- **순변경**: +약250 (PR 템플릿 15줄, ci.yml 24줄, check-i18n-residue.mjs 197줄, README 17줄)

## 신규 패턴

- **트리거 = 소비처 일치(consumer-aligned trigger)**: CI 경로 필터는 산출물을 실제 소비하는 코드가 읽는 경로 집합과 일치시킨다. 부정 패턴이 막히는 OR-콴티파이어 환경에서는 positive glob narrowing 으로 불필요 트리거를 제거한다.
- **i18n 3계층 게이트**: 존재(en-coverage)와 품질(i18n-residue)을 분리해 "파일은 있는데 미번역 stub" 갭을 닫는다. 소스 게이트로 빌드 산출물 잔재를 shift-left 차단.

## 교훈

- **추상화 도입 전 외부 라이브러리 실제 동작 검증**: dorny/paths-filter 부정 패턴이 `some` 콴티파이어에서 무력화됨을 소스에서 확인하지 않았다면 README 제외가 조용히 실패했을 것. CI 변경은 picomatch 시뮬레이션으로 사전 검증.
- **false-positive 회피가 게이트 설계의 1순위**: 빌드 산출물 직접 검사의 배너 false-positive 를 피해 소스 게이트로 전환. CI 게이트는 정당한 PR 을 막으면 신뢰를 잃는다.
- **소비처 동시 명시(Sprint 171 교훈)의 실천**: PR1 에서 추가한 체크리스트(#171)를 PR2(#26)가 그대로 구현 — 트리거를 소비처와 일치시키는 것이 "채택 ≠ 소비"의 CI 판본.

## 이월 항목 (Sprint 176+)

### 신규 발견
- **adr-en blog 트리거 갭**: `docs/adr-en/**` 이 blog 재빌드 트리거에 없음(원본 필터부터 누락). EN 단독 재번역 시 blog `/en` 페이지가 재빌드되지 않음 → Sprint 176 #26 후속 회수 후보.

### 계승 이월 시드
- plan 템플릿 잔여: 블로그 글 머지 전 cross-check 자동화(#18, 검증 대상 모호 → 범위 확정 필요).
- UAT 사용자 직접: #5 프로그래머스 재제출 채점 / #9 영문 Grafana CB dashboard + Sprint 160~175 누적.
- 기타 후속: coverage-gate skipped 허용 제거, post-merge pre-deploy gate, prom-client 점검 자동화, `.claude-tools/` Phase 2 삭제, `(adr)` layout 분할 등 sprint-174 §이월 계승.
