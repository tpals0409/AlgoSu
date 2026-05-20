---
sprint: 174
title: "그룹 분석 fallback 부분 필드 복구 (시드 #신규7)"
date: "2026-05-20"
status: completed
agents: [Oracle, Sensei, Critic, Scribe]
related_adrs: ["sprint-173", "sprint-164", "sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 174 — 그룹 분석 fallback 부분 필드 복구 (시드 #신규7)

## 목표

- Sprint 173 에서 분리 이월된 보안 민감 시드 **#신규7** 회수.
- `_parse_group_response`(`services/ai-analysis/src/claude_client.py`)의 Path B(JSON 파싱이 완전히 실패한 분기)에서, 모델이 **완전히 종결한 top-level 필드만** 안전하게 부분 복구.
- **핵심 제약**: Sprint 164 #신규3 보안 fix(raw_text 노출 차단으로 PII/secret 누출 방지)의 경계를 그대로 보존. 부분 복구가 절단된 응답에서 echoed secret/PII 를 다시 노출시켜선 안 됨.

## 결정

### D0. prefix-at-comma-boundary 복구 전략

신규 staticmethod `_recover_partial_json_object(text)` 를 도입한다. root object 내부·문자열 밖·depth 1 에서 만난 콤마 직전까지는 완전히 종결된 key:value 쌍이므로 안전한 cut point 다. 가장 뒤 후보부터 거꾸로 시도하며 trailing comma 를 제거하고 열린 컨테이너를 닫은 뒤 `json.loads` 로 검증한 결과만 반환한다. 어떤 후보도 검증에 실패하면 `None` 을 반환한다. 근거: 정규식 span 추출이 아닌 "구조적으로 완성 가능한 prefix 만 닫아서 파싱" 하므로 성공 경로(Path A)와 동일한 안전 등급을 유지한다.

### D1. 보안 불변식

- ① `raw_text`(또는 그 substring)를 `json.loads` 를 거치지 않고 반환 금지.
- ② EOF 시점에 미종결 문자열(`in_string`) 또는 미종결 중첩 컨테이너(`len(stack) > 1`)가 있으면 EOF 후보를 생성하지 않는다 → 절단된 마지막 필드(echoed secret/PII 가 가장 노출되기 쉬운 지점)를 폐기.
- ③ `re.search` 텍스트 span 추출 금지. single 분석은 score 정규식이라 안전하지만, group 은 텍스트 필드라 정규식 span 추출이 위험.

### D2. status 신규 enum 도입 안 함

`comparison`(완전히 종결된 비어있지 않은 문자열) 복구에 성공하면 status 를 `"completed"`(single 분석 fallback 패턴 답습), 아니면 기존 `"failed"` 를 유지한다. 프론트 `analysisStatus` 유니온(`pending|completed|delayed|failed`) 및 다운스트림 계약을 무변경으로 두어, 보안 PR 을 ai-analysis 단일 서비스에 격리한다.

### D3. 로그 무노출

부분 복구 성공 시 `raw_length` 와 `recovered_fields`(복구된 필드 **개수**)만 로깅한다. 필드 값이나 raw 내용은 로깅 금지.

## 구현 (단일 PR, 브랜치 `feat/sprint-174-group-partial-recovery`, 3 commit)

### `b26d59f` — 부분 필드 복구 본체

`feat(ai-analysis): group 분석 fallback 부분 필드 복구 (Sprint 174 #신규7)`

- `_recover_partial_json_object` 헬퍼(staticmethod) 신규.
- Path B 의 except 블록에 복구 시도 분기 추가.
- 테스트 14건: 절단 회수→`completed`, 미종결 문자열 폐기, PII/secret 비노출, trailing comma, `learningPoints` 복구·보정, comparison 없음/빈값→`failed`, raw 에 절단 미포함, escape quote, 중첩 컨테이너, 헬퍼 직접 `None` 경로.

### `b035dcb` — EOF 후보 가드에 미종결 중첩 컨테이너 차단 (Critic R1 P1)

`fix(ai-analysis): EOF 후보 가드에 미종결 중첩 컨테이너 차단 추가 (Sprint 174 #신규7 P1)`

- EOF 후보 조건을 `not in_string and stack` → `not in_string and len(stack) == 1 and stack[0] == "{"` 로 강화.
- 중첩 미종결 array/object 필드를 폐기.
- 회귀 테스트 2건.

### `c9c6bda` — 복구 헬퍼 `_strip_markdown_block` ValueError 방어 (Critic R2 P2)

`fix(ai-analysis): 복구 헬퍼 _strip_markdown_block ValueError 방어 (Sprint 174 #신규7 P2)`

- 개행 없는 미종결 펜스(`` ``` ``, `` ```json ``)에서 `_strip_markdown_block` 이 던지는 `ValueError` 가 복구 헬퍼 밖으로 전파되어 안전 envelope 대신 예외가 터지던 회귀를 `try/except (ValueError, IndexError)` → `return None` 으로 차단.
- 루트 원인(`.index`)은 Path A→B 라우팅 의존이라 미변경.
- 회귀 테스트 2건.

### Scribe (본 commit) — ADR 기록

- `docs/adr/sprints/sprint-174.md` (KR) + `docs/adr-en/sprints/sprint-174.md` (EN 1:1)
- `docs/adr/README.md` count 112→113, range 62~173→62~174

## Critic 사이클

- **R1** (`codex review --base main`, codex-cli 0.130.0): **P1 1건** — EOF 후보가 미종결 중첩 컨테이너를 못 막아 `{"comparison":"ok","optimizedCode":["SECRET"` 같은 입력에서 미종결 array 필드가 합성 복구됨 → 불변식 위반. (P0/P2/P3 0건)
- **R2** (세션 `019e43e8-c015-7361-99f8-e71831b7b8c7`): P1 해소 확인, **신규 P2 1건** — 개행 없는 미종결 펜스에서 복구 헬퍼가 `ValueError` 를 재전파 → 안전 envelope 회귀.
- **R3** (세션 `019e43eb-ce31-76f1-b7fb-47c7c4c00061`): **회귀 0건, 머지 가능** ✅ — "partial JSON recovery path is scoped to invalid group responses, validates with json.loads, preserves safe fallback. No discrete regression."

## 위험/회귀 차단

### 예측 1: 기존 failed 경로 불변
기존 failed 경로 테스트(invalid_json / empty / backtick×2 / no-raw-exposure)가 전부 수정 없이 green 유지된다.

### 예측 2: 절단 콘텐츠 미노출
미종결 문자열·중첩 컨테이너가 모두 폐기되어 절단된 콘텐츠가 노출되지 않는다(테스트로 고정).

### 예측 3: 다운스트림 무영향
status enum 이 불변(`pending|completed|delayed|failed`)이라 프론트/다운스트림 계약에 영향이 없다.

## 검증

### 로컬
- 전체 pytest: **322 passed**(신규 18 케이스 포함).
- `claude_client.py` coverage: **99% 유지**.
- 전체 게이트: **98.92%**(≥97) PASS.
- ruff: CLEAN.
- (참고) `test_main` 4건 실패는 로컬 Python 3.14 `asyncio.get_event_loop` 환경 이슈로 본 변경과 무관 — CI 3.12 에서 green.

### CI (예상)
- `check-adr-en-coverage --strict` / `check-doc-refs` PASS 예상.

### UAT 신규 (Sprint 174)
- 실 사용자 직접: group 분석이 절단 응답을 받았을 때 부분 복구 결과가 프론트에 정상 렌더되는지 시각 확인.

## 결과

- **머지**: origin/main `584a191` → `<TBD-MERGE-SHA>` (PR #<TBD>, squash merge)
- **순변경**: +약290 (`claude_client.py` 헬퍼 + 테스트 18건)

## 신규 패턴

- **구조적 복구만 허용(structured-repair-only)**: 파싱 실패 fallback 에서 부분 복구 시 정규식 span 추출이 아니라 "모델이 종결한 prefix 를 닫아 `json.loads`" 한 결과만 반환한다 → 성공 경로(Path A)와 동일 안전 등급을 유지하고 raw 텍스트 노출 경계를 보존한다.
- **미종결 경계 = 보안 경계**: 절단된 마지막 필드(문자열/중첩 컨테이너)는 echoed secret/PII 가 가장 노출되기 쉬운 지점이므로 `in_string`·`len(stack)` 가드로 일괄 폐기한다.

## 교훈

- **보안 민감 fallback 확장은 "더 살리기"보다 "안전하게 덜 살리기"가 기본값**: 완전히 종결된 필드만 회수하고, 의심스러우면 버린다.
- **추출/복구 헬퍼는 total 함수여야 한다**: 호출부가 try 로 감싸던 예외(`_strip_markdown_block` 의 `ValueError`)를 헬퍼가 다시 던지면 안전 계약이 깨진다(P2 교훈).
- **Critic 교차 리뷰의 가치**: P1·P2 모두 "테스트는 green 인데 엣지 입력에서 불변식이 깨지는" 케이스 — 동일 모델이 놓치기 쉬운 맹점을 Codex 가 포착했다.

## 이월 항목 (Sprint 175+)

### 계승 이월 시드
- i18n/lint (Sprint 158 #30/#31), plan 템플릿 (Sprint 157 #24/#18/#23), ADR/blog 보강 (Sprint 157 #26/27/28)
- UAT 사용자 직접: #5 프로그래머스 재제출 채점 / #9 영문 Grafana CB dashboard + Sprint 160~174 누적 — 신규: group 분석이 절단 응답을 받았을 때 부분 복구 결과가 프론트에 정상 렌더되는지 시각 확인.
- 기타 후속: coverage-gate skipped 허용 제거 등 sprint-173 §이월 계승.
