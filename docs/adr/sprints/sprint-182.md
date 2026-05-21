---
sprint: 182
title: "doc-refs bare-path 비대칭 보강"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-176", "sprint-177", "sprint-155", "sprint-154"]
related_memory: ["sprint-window"]
---
# Sprint 182 — doc-refs bare-path 비대칭 보강

## 목표

- `scripts/check-doc-refs.mjs`는 markdown cross-ref 무결성을 정적 검증한다(Sprint 154 도입). 세 함수가 협력한다: `validateRef`(경로 resolve + 존재 검증), `extractMarkdownLinks`(`[text](path)` 추출), `extractBareDocPaths`(평문 노출 bare 경로 추출).
- **비대칭**: `validateRef`의 repo-root resolve 분기는 8개 top-level prefix(`docs/`, `scripts/`, `blog/`, `frontend/`, `services/`, `infra/`, `.claude/`, `.github/`)를 지원하고 `extractMarkdownLinks`는 prefix 무관하게 모든 `.md` 링크를 추출한다. 그런데 `extractBareDocPaths`의 정규식은 `docs/`만 매칭 → **markdown link가 아닌 평문**으로 노출된 `frontend/README.md`·`services/gateway/X.md` 같은 bare 참조는 깨져도 미검출되는 갭이 있었다.
- 이 비대칭을 해소해 게이트의 검증 범위를 세 함수에서 일관되게 정렬하고, 비대칭 재발을 구조적으로 차단한다.

## 결정

### D1. prefix를 단일 SSOT로 통합

`validateRef`에 하드코딩돼 있던 prefix `||` 체인(8개)을 모듈 레벨 상수 `REPO_ROOT_PREFIXES`로 추출했다. `validateRef`의 resolve 분기(`some(p => decoded.startsWith(\`${p}/\`))`)와 `extractBareDocPaths`의 bare 매칭 정규식이 **동일 출처**를 공유한다. 신규 top-level 디렉토리 추가 시 본 배열만 갱신하면 양쪽 룰에 동시 반영되어, "한쪽만 docs/ 만 매칭하던" 비대칭이 구조적으로 재발 불가능해진다.

### D2. bare 정규식은 `.md` 확장자로 한정

`extractBareDocPaths` 정규식을 SSOT 배열에서 동적 생성하되(`.claude`/`.github`의 `.`은 정규식 이스케이프) 확장자는 `.md`로 한정했다. `validateRef`가 실제 검증하는 범위는 `.md` 경로(또는 `docs/` prefix)이므로, bare 추출을 `.md`로 맞춰 추출-검증 계약을 정렬한다. 부수 효과로 `services/` 레이어·`infra/` 디렉토리 같은 비-`.md` 평문 언급은 매칭되지 않아 false-positive를 차단한다.

### D3. 소비처 자동 일관 적용

`extractBareDocPaths`는 `check-staging-integrity.mjs`(staged/untracked .md 무결성 검사)에서도 재사용된다. 본 보강은 함수 한 곳을 고쳐 두 게이트(`check-doc-refs` + `check-staging-integrity`)에 동시 반영된다 — 별도 동기화 코드 없이 단일 SSOT 함수가 소비처 전반의 동작을 일관 갱신한다.

## 구현

### PR #317 (단일 작업 브랜치 `feat/sprint-182-doc-refs-bare-path`, 1 commit → squash)

- `f1286cb` fix — `REPO_ROOT_PREFIXES` SSOT 신설, `validateRef` 하드코딩 체인 → `some()` 치환, `extractBareDocPaths` 정규식 SSOT 동적 생성(8 prefix), JSDoc 정정. self-test fixture 5→8종(non-docs prefix dogfood). runbook §2.2/§6/§9 갱신.

핵심 변경 (extractBareDocPaths):
```js
const alt = REPO_ROOT_PREFIXES.map((p) => p.replace(/\./g, '\\.')).join('|');
const re = new RegExp(`(?<![[(\\w/.-])((?:${alt})\\/[\\w./-]+\\.md(?:#[\\w-]+)?)`, 'g');
```

부정 lookbehind `(?<![[(\w/.-])`로 markdown link 경로(앞에 `(`)와의 중복 매칭을 차단하고, prefix 앞 word-char(`v2.github/...` 같은 비-경로)를 배제한다.

## Critic 사이클

`codex review --base main` 1라운드.

- **R1** (session `019e47f0`): **0건** 통과 — "repo-root prefix를 중앙화하고 bare markdown path 검출을 기존 resolver와 일관되게 확장한다. 갱신된 self-test가 통과하며 조치 가능한 회귀는 식별되지 않았다." 머지 가능.

## 검증

### 로컬
- `node scripts/check-doc-refs.mjs`: self-test **8/8** broken 검출(5종 docs 슬러그 회귀 기준선 + 3종 non-docs prefix dogfood) + 325 files **0 broken**.
- `node scripts/check-staging-integrity.mjs`: self-test 2/2 무회귀. `node scripts/check-regex-robustness.mjs`: 통과.
- 엣지 케이스 검증(인라인 import): 유효 bare 참조(`frontend/README.md`) 추출·통과 / markdown link `[x](.github/foo.md)` 중복 미매칭 / standalone `.github/...md` 매칭 / nested `services/gateway/src/x.md` 매칭 / 비-`.md` 평문(`services/`·`infra/`) 미매칭 / word-char 앞(`v2.github/x.md`) 미매칭.

### dry-run (보강 영향 측정)
- 넓힌 정규식을 전체 tracked .md corpus에 dry-run한 결과 **신규 매칭 0건 / 신규 깨진 참조 0건**. 즉 보강 시점 corpus에는 고칠 평문 bare 비-docs 참조가 없어 본 작업은 **예방적·구조적 정합**(latent 게이트 불일치 차단 + future 참조 자동 커버)이다. self-test fixture가 새 커버리지의 증명 역할을 한다.

### CI
- 작업 PR #317 전체 37 checks green. ADR PR은 `sprints/**` 트리거로 Build Blog 포함 green.

## 결과

- **머지**: origin/main `e3d0983` → `6c92415` (PR #317 squash merge, 작업 브랜치 삭제).
- **순변경**: `scripts/check-doc-refs.mjs`(+34/-17), `docs/runbook/doc-ref-lint.md`(+14/-5). 신규 파일 없음.
- ADR sprint-182(KR+EN) + README sprint ADR count 120→121·범위 62~182 (별도 ADR PR).

## 신규 패턴

- **추출-검증 계약 정렬(extractor↔validator symmetry)**: 정적 검증 게이트가 "추출(무엇을 검사 후보로 볼 것인가)"과 "검증(후보가 유효한가)"을 분리하면, 둘의 커버 범위가 어긋날 때 **검증기는 넓은데 추출기가 좁아 일부 결함이 후보에서 누락**되는 silent gap이 생긴다. validator가 지원하는 입력 범위를 extractor도 동일하게 커버하도록 SSOT로 묶어야 게이트가 의도대로 동작한다.
- **하드코딩 목록의 SSOT화로 비대칭을 구조적 차단**: 동일한 prefix 목록이 두 함수에 따로 존재하면 한쪽만 확장돼 비대칭이 생긴다(본 사례). 단일 배열로 추출하면 비대칭이 "갱신을 잊는 실수"가 아니라 "애초에 표현 불가능한 상태"가 된다.

## 교훈

- **0건 적발도 가치 있는 보강일 수 있다(예방적·구조적)**: dry-run에서 신규 적발 0건이라는 사실은 본 작업이 버그 픽스가 아니라 latent 불일치를 닫는 예방적 보강임을 명확히 했다. 가치는 (1) 미래 평문 bare 참조의 자동 커버 (2) extractor↔validator 비대칭의 구조적 재발 차단 (3) self-test fixture로 새 커버리지를 dogfood 증명하는 데 있다. Sprint 181이 이 항목을 "가치 marginal"로 평가했던 것과 일치하나, SSOT 리팩토링으로 구조적 가치를 더했다.
- **소비처 재사용 함수의 SSOT 수정은 1:N 일관 갱신**: `extractBareDocPaths`가 두 게이트에서 공유되므로, 함수 한 곳의 SSOT 보강이 별도 동기화 없이 소비처 전반에 일관 적용된다 — 공유 헬퍼 패턴(Sprint 180/181 계승)의 게이트 영역 실증.

## 이월 항목 (Sprint 183+)

- **UAT 사용자 직접**: Sprint 160~181 누적 UAT 계승(레거시 Programmers SQL 상세 에디터 자동 sql 선택, 프로그래머스 재제출 채점, 영문 환경 Grafana CB dashboard).
- 후속: coverage-gate skipped 허용 제거(실제 skipped 0건이라 보류 가능), `(adr)` layout 분할, prom-client Case B~D 점검 자동화, `.claude-tools/` Phase 2 실제 삭제(trigger path 검증 후), Sprint 162 R1 P3(깊은 상대 경로 `.md` 링크 미커버), Sprint 163(H3-only PR 표 추출).
