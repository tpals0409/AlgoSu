---
sprint: 174
title: "Group analysis fallback partial field recovery (seed #new7)"
date: "2026-05-20"
status: completed
agents: [Oracle, Sensei, Critic, Scribe]
related_adrs: ["sprint-173", "sprint-164", "sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 174 — Group analysis fallback partial field recovery (seed #new7)

## Goal

- Recover the security-sensitive seed **#new7** that was separated and carried over from Sprint 173.
- In `_parse_group_response`'s Path B (the branch where JSON parsing fails completely) in `services/ai-analysis/src/claude_client.py`, safely recover **only the top-level fields the model fully terminated**.
- **Core constraint**: preserve the boundary of the Sprint 164 #new3 security fix (blocking raw_text exposure to prevent PII/secret leakage) exactly. The partial recovery must not re-expose echoed secrets/PII from a truncated response.

## Decisions

### D0. prefix-at-comma-boundary recovery strategy

Introduce a new staticmethod `_recover_partial_json_object(text)`. Within the root object, outside of any string, at depth 1, the position just before a comma is a fully terminated key:value pair and therefore a safe cut point. Trying from the last candidate backwards, strip the trailing comma, close the open containers, and return only the result that validates with `json.loads`. If no candidate validates, return `None`. Rationale: this is not regex span extraction but "close only a structurally completable prefix and parse it", so it maintains the same safety grade as the success path (Path A).

### D1. Security invariants

- ① Forbid returning `raw_text` (or any substring of it) without passing through `json.loads`.
- ② If at EOF there is an unterminated string (`in_string`) or an unterminated nested container (`len(stack) > 1`), produce no EOF candidate → discard the truncated last field (the spot most prone to exposing echoed secrets/PII).
- ③ Forbid `re.search` text span extraction. Single analysis is safe because it uses a score regex, but group fields are text, so regex span extraction is risky.

### D2. Do not introduce a new status enum

If `comparison` (a fully terminated, non-empty string) is recovered successfully, set status to `"completed"` (following the single-analysis fallback pattern); otherwise keep the existing `"failed"`. The frontend `analysisStatus` union (`pending|completed|delayed|failed`) and the downstream contract are left unchanged, isolating the security PR to the single ai-analysis service.

### D3. No log exposure

On successful partial recovery, log only `raw_length` and `recovered_fields` (the **count** of recovered fields). Forbid logging field values or raw content.

## Implementation (single PR, branch `feat/sprint-174-group-partial-recovery`, 3 commits)

### `b26d59f` — partial field recovery body

`feat(ai-analysis): group 분석 fallback 부분 필드 복구 (Sprint 174 #신규7)`

- New `_recover_partial_json_object` helper (staticmethod).
- Add a recovery-attempt branch to Path B's except block.
- 14 tests: truncation recovery→`completed`, discard of unterminated string, PII/secret non-exposure, trailing comma, `learningPoints` recovery/correction, missing/empty comparison→`failed`, truncation not included in raw, escape quote, nested container, helper direct `None` path.

### `b035dcb` — add unterminated-nested-container block to the EOF candidate guard (Critic R1 P1)

`fix(ai-analysis): EOF 후보 가드에 미종결 중첩 컨테이너 차단 추가 (Sprint 174 #신규7 P1)`

- Strengthen the EOF candidate condition from `not in_string and stack` → `not in_string and len(stack) == 1 and stack[0] == "{"`.
- Discard nested unterminated array/object fields.
- 2 regression tests.

### `c9c6bda` — guard the recovery helper against `_strip_markdown_block` ValueError (Critic R2 P2)

`fix(ai-analysis): 복구 헬퍼 _strip_markdown_block ValueError 방어 (Sprint 174 #신규7 P2)`

- On a newline-less unterminated fence (`` ``` ``, `` ```json ``), the `ValueError` thrown by `_strip_markdown_block` propagated outside the recovery helper, causing an exception instead of the safe envelope; block that regression with `try/except (ValueError, IndexError)` → `return None`.
- The root cause (`.index`) is left unchanged because it depends on Path A→B routing.
- 2 regression tests.

### Scribe (this commit) — ADR recording

- `docs/adr/sprints/sprint-174.md` (KR) + `docs/adr-en/sprints/sprint-174.md` (EN 1:1)
- `docs/adr/README.md` count 112→113, range 62~173→62~174

## Critic cycle

- **R1** (`codex review --base main`, codex-cli 0.130.0): **1 P1 finding** — the EOF candidate failed to block unterminated nested containers, so on input like `{"comparison":"ok","optimizedCode":["SECRET"` an unterminated array field was synthetically recovered → invariant violation. (0 P0/P2/P3)
- **R2** (session `019e43e8-c015-7361-99f8-e71831b7b8c7`): confirmed P1 resolved, **1 new P2 finding** — on a newline-less unterminated fence, the recovery helper re-propagated `ValueError` → safe-envelope regression.
- **R3** (session `019e43eb-ce31-76f1-b7fb-47c7c4c00061`): **0 regressions, mergeable** ✅ — "partial JSON recovery path is scoped to invalid group responses, validates with json.loads, preserves safe fallback. No discrete regression."

## Risk / regression guard

### Prediction 1: existing failed path unchanged
The existing failed-path tests (invalid_json / empty / backtick×2 / no-raw-exposure) all stay green without modification.

### Prediction 2: no truncated-content exposure
Both unterminated strings and nested containers are discarded, so truncated content is not exposed (locked down by tests).

### Prediction 3: no downstream impact
The status enum is invariant (`pending|completed|delayed|failed`), so there is no impact on the frontend/downstream contract.

## Verification

### Local
- Full pytest: **322 passed** (including 18 new cases).
- `claude_client.py` coverage: **maintained at 99%**.
- Overall gate: **98.92%** (≥97) PASS.
- ruff: CLEAN.
- (Note) The 4 `test_main` failures are a local Python 3.14 `asyncio.get_event_loop` environment issue unrelated to this change — green on CI 3.12.

### CI (expected)
- `check-adr-en-coverage --strict` / `check-doc-refs` expected PASS.

### New UAT (Sprint 174)
- Direct user UAT: visually confirm that when group analysis receives a truncated response, the partial-recovery result renders correctly on the frontend.

## Result

- **Merge**: origin/main `584a191` → `<TBD-MERGE-SHA>` (PR #<TBD>, squash merge)
- **Net change**: +~290 (`claude_client.py` helper + 18 tests)

## New patterns

- **structured-repair-only**: when doing partial recovery in a parse-failure fallback, return only the result of "close the prefix the model terminated and `json.loads` it" rather than regex span extraction → maintain the same safety grade as the success path (Path A) and preserve the raw-text exposure boundary.
- **An unterminated boundary is a security boundary**: the truncated last field (string/nested container) is the spot most prone to exposing echoed secrets/PII, so discard it wholesale with the `in_string`/`len(stack)` guards.

## Lessons

- **For security-sensitive fallback extensions, "recover less, safely" is the default over "recover more"**: only recover fully terminated fields, and discard anything suspicious.
- **An extraction/recovery helper must be a total function**: if the helper re-throws an exception the caller used to wrap in a try (the `ValueError` from `_strip_markdown_block`), the safety contract breaks (the P2 lesson).
- **The value of Critic cross-review**: both P1 and P2 were cases of "the tests are green but the invariant breaks on an edge input" — Codex caught blind spots the same model is prone to miss.

## Carryover (Sprint 175+)

### Inherited carryover seeds
- i18n/lint (Sprint 158 #30/#31), plan template (Sprint 157 #24/#18/#23), ADR/blog reinforcement (Sprint 157 #26/27/28)
- Direct user UAT: #5 Programmers resubmission grading / #9 English Grafana CB dashboard + Sprint 160~174 accumulated — new: visually confirm that when group analysis receives a truncated response, the partial-recovery result renders correctly on the frontend.
- Other follow-ups: remove coverage-gate skipped tolerance, etc. — inheriting sprint-173 §carryover.
