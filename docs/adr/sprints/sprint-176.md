---
sprint: 176
title: "adr-en blog 트리거 갭 회수 + README 카운트 자동 게이트 (시드 #1/#3)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-175", "sprint-171", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 176 — adr-en blog 트리거 갭 회수 + README 카운트 자동 게이트

## 목표

- Sprint 175 #26 에서 발견·이월된 두 건의 **CI/문서 게이트 강화**를 시드별 독립 PR 로 회수.
  - #1: `docs/adr-en/**` 가 blog 재빌드 트리거에 없어 EN 단독 재번역 시 blog `/en` 미재빌드.
  - #3: README ADR 누적 카운트 드리프트(Sprint 157 #23)를 수동 체크리스트에서 CI hard gate 로 자동화.
- **회귀 격리**: 시드별 독립 PR + Critic(Codex) 교차 리뷰 + Squash merge.
- #2(블로그 cross-check)는 검증 대상 범위 모호 → Sprint 177 이월(스코프 외 확정).

## 결정

### D1. #1 — EN 트리거도 소비처 일치(consumer-aligned trigger) 계승

Sprint 175 #26 에서 KR blog 트리거를 소비처 일치 positive glob 으로 narrowing 했으나, 소비처 `blog/src/lib/adr/loader.ts:28`(`ADR_EN_BASE = path.resolve(cwd, '..', 'docs', 'adr-en')`)는 EN ADR 도 KR 과 동일 구조(루트 `ADR-*.md` + `sprints/` + `topics/`)로 read 한다(`readLocalized`). 원본 blog 필터부터 `docs/adr-en/**` 가 없어 EN 단독 재번역 시 build-blog 가 트리거되지 않는 갭이 있었다.

- `'docs/adr-en/ADR-*.md'` + `'docs/adr-en/sprints/**'` + `'docs/adr-en/topics/**'` 3개 positive glob 추가(KR 글롭과 대칭).
- dorny/paths-filter `predicate-quantifier: some`(OR) 환경(Sprint 175 #26 소스 검증)이므로 부정 패턴 금지 — `README.md` 는 `ADR-*.md` 미매칭으로 자연 제외.
- picomatch 시뮬레이션 5케이스로 EN sprint/topic/ADR trigger / `README.md` skip 확인.

### D2. #3 — 비파괴적 드리프트 탐지기로서의 카운트 게이트

`docs/adr/README.md` 의 "(N개)" 선언이 rebase/머지 중 실제 파일 수와 어긋나는 사례(Sprint 157 #23)를 자동 차단한다. 카운트 기준은 README 현행 선언과 일치시켜(영구 `ADR-*.md`=8 / 토픽 `topics/*.md`=1 / sprint `sprints/*.md`=114, README.md 제외) 비파괴적으로 도입한다. sprint 카운트 114 는 표준 `sprint-NN.md` 113 + 비표준 `sprint-87-plan.md` 1 = 전체 .md 기준이며, README 현행 표기와 일치하므로 명명 정책을 강제하지 않고 순수 드리프트만 탐지한다.

- 컨벤션은 `scripts/check-i18n-residue.mjs` 답습: entry guard(`process.argv[1] === __selfPath`) + export 순수 함수(`countActualAdrs`/`parseDeclaredCounts`/`diffCounts`) + `--strict` exit 1 / 옵션·I/O 오류 exit 2.
- sprint 선언 `(114개, Sprint 62~175)` 처럼 trailing 텍스트가 붙을 수 있어 sprint 정규식만 닫는 괄호를 요구하지 않는다.

### D3. Critic P2 — 선언 등장 횟수 강제(부분 드리프트 차단)

초기 `diffCounts` 는 카테고리별 선언이 **0건일 때만** missing 으로 차단해, 6곳 중 일부만 삭제되는 부분 드리프트(예: 섹션 헤더 카운트만 제거하고 ASCII 트리 카운트는 유지)를 통과시켰다(Critic R1 P2). `EXPECTED_OCCURRENCES`(카테고리별 2곳 = ASCII 트리 + 섹션 헤더)를 도입해 등장 횟수 자체를 강제 → 부분 삭제·0곳·초과를 모두 `occurrences` 불일치로 차단한다.

## 구현 (시드별 독립 PR)

### PR #304 `97277ab` — adr-en blog 트리거 갭 (#1)

`ci(blog): adr-en 단독 재번역 시 blog /en 재빌드 트리거`

- `ci.yml` detect-changes blog 필터에 `docs/adr-en/` positive glob 3개 추가(KR 글롭 바로 뒤, 소비처 `loader.ts` ADR_EN_BASE 주석 명시).
- picomatch 시뮬레이션 5케이스 PASS: EN `sprints/`·`topics/`·`ADR-*.md` = true, `README.md` = false, 비표준 `sprint-87-plan.md` = true.

### PR #305 `297a04a` — README 카운트 자동 게이트 (#3)

`ci(docs): README ADR 인덱스 카운트 정합 게이트`

- `scripts/check-adr-index-count.mjs` 신규(235→257줄, P2 보강 포함). 카테고리별 실제 .md 카운트 vs README 선언 6곳 대조 + 등장 횟수 강제.
- `ci.yml` quality-docs 잡에 `--strict` step 배선 + `docs` paths-filter 에 스크립트 등록.
- `docs/adr/README.md` 에 카운트 정합 게이트 안내 1줄(분류 기준 섹션 위 블록쿼트).

## Critic 사이클

- **PR #304** (`codex review --base main`): 0건 — "EN ADR 소스 경로를 소비처에 맞게 확장, 기존 동작 영향 없음". 1회 통과.
- **PR #305 R1**: **P2 1건** — `diffCounts` 가 선언 0건일 때만 차단해 부분 삭제 드리프트 미차단 → 등장 횟수 검사 권고.
- **PR #305 R2** (P2 수정 후): 0건 — "docs 변경 스코프, README/카운팅 컨벤션 일치, 레포 상태 통과, 신규 결함 없음".

### 위임 처리(P2)
Critic → Architect 재위임 → `EXPECTED_OCCURRENCES` 도입 + `occurrences` 불일치 종류 추가 → R2 0건 확인 후 머지.

## 검증

### 로컬
- `check-adr-index-count --strict`: 현행 114/8/1 PASS.
- export 단위: counter(8/1/114) + parser(6곳 + sprint trailing) + diffCounts 정합/부분삭제(1곳)/0곳/초과(3곳)/값 불일치 전부 탐지(11+5 케이스 PASS).
- e2e: README sprint 카운트 임시 변조 → exit 1, `git checkout` 복원 → exit 0.
- 회귀 게이트: `check-doc-refs`(313 files 0 broken) / `check-adr-en-coverage --strict`(123/123) / `check-i18n-residue --strict`(max 2.19% < 8%) / ci.yml YAML 파싱 모두 clean.

### CI
- PR #304 CI green(36 checks pass) → squash merge. PR #305 CI green(37 checks pass, `Quality — docs` SUCCESS 로 신규 게이트 dogfood, `Build Blog` SKIPPED 로 #1 narrowing 실증) → squash merge.

### UAT 신규 (Sprint 176)
- 실 사용자 직접: 영문 blog `/en` ADR 한국어 잔재 시각 확인(Sprint 175 계승), adr-en 재번역 시 blog `/en` 재빌드 트리거 동작 확인.

## 결과

- **머지**: origin/main `966fa56` → `297a04a` (PR #304 `97277ab` / #305 `297a04a`, 모두 squash merge)
- **순변경**: +약271 (ci.yml +12, check-adr-index-count.mjs 257, README +2)

## 신규 패턴

- **소비처 일치 트리거의 EN 대칭 확장**: KR 에 적용한 consumer-aligned trigger(Sprint 175 #26)를 EN 소비 경로(`ADR_EN_BASE`)에 대칭으로 확장. locale 별 소비처가 분리된 경우 트리거도 locale 대칭으로 유지해야 갭이 생기지 않는다.
- **인덱스 카운트 정합 게이트**: 문서 인덱스의 선언 수치를 실제 파일 수와 대조하는 드리프트 탐지기. 값뿐 아니라 **선언 등장 횟수**까지 강제해 부분 삭제를 차단한다.

## 교훈

- **소비처 일치 원칙은 locale 차원에서도 대칭이어야 한다**: KR 만 narrowing 하면 EN 갭이 그대로 남는다. 트리거-소비처 일치를 적용할 때 모든 소비 경로(locale 포함)를 동시에 점검.
- **불변식은 "값"뿐 아니라 "구조"까지 게이트해야 한다(Critic P2)**: 카운트 값만 비교하면 선언 자체가 사라지는 드리프트를 놓친다. 게이트가 보장하려는 불변식(6곳 동기화)을 그대로 강제(등장 횟수)해야 우회가 막힌다.
- **신규 게이트는 머지 시점에 dogfood 된다**: PR #305 의 `Quality — docs` SUCCESS 가 게이트 자체의 정상 동작을, `Build Blog` SKIPPED 가 #1 narrowing 을 동시에 실증.

## 이월 항목 (Sprint 177+)

### 계승 이월 시드
- **블로그 cross-check 자동화(#18)**: blog 글 머지 전 검증 — 검증 대상 범위 모호 → 범위 확정 필요.
- plan 템플릿 잔여: sprint-157 잔재.
- UAT 사용자 직접: #5 프로그래머스 재제출 채점 / #9 영문 Grafana CB dashboard + Sprint 160~176 누적.
- 기타 후속: coverage-gate skipped 허용 제거, post-merge pre-deploy gate, prom-client 점검 자동화, `.claude-tools/` Phase 2 삭제, `(adr)` layout 분할 등 sprint-175 §이월 계승.
