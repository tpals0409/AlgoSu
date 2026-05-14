---
sprint: 155
title: "시드 #22 pre-push hook staging 자동 검증 (3단 안전망 완성)"
date: "2026-05-14"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-153", "sprint-154"]
related_memory: ["sprint-window"]
---
# Sprint 155 — 시드 #22 pre-push hook staging 자동 검증 (3단 안전망 완성)

## 목표

- Sprint 153 Phase A/E 사고 (PR #241 hotfix) + Sprint 154 §6 명시 + Sprint 154 교훈 #4 (untracked 검증 불가) 직접 보강
- **plan 단계 (Sprint 154 A)** + **pre-push 단계 (본 sprint)** + **CI lint 단계 (Sprint 154 B)** 3단 안전망 완성
- untracked .md broken ref 사각지대 제거 — push 직전 로컬에서 최초 검출

## 결정

- **Phase 1 (architect)**: `.husky/pre-push` shim + `scripts/check-staging-integrity.mjs` 신규. `check-doc-refs.mjs` 에 `--include-untracked` 옵션 + ESM export 추가
- **Phase 3+4 (scribe)**: `docs/runbook/pre-push-check.md` 신설 + `git-hooks.md` §2 확장 + 기존 RUNBOOK 3건 cross-ref + ADR
- **단일 sprint 2 PR 묶음** — Phase 1 코드 (architect) → Phase 3+4 문서 (scribe) 순차 머지. Sprint 150~154 패턴 계승
- **regression fixture 2종**: Sprint 153 Phase E (old runbook slug) / Sprint 154 PR #246 (home 경로 참조) — 직전 사고를 self-test 기준선으로 고정

## 구현 (2 PR squash merge, origin/main `1e51e24` → TBD)

| PR | Phase | 담당 | 변경 | 라인 |
|----|-------|------|------|------|
| [#247](https://github.com/tpals0409/AlgoSu/pull/247) | 1+2 (코드) | architect | `.husky/pre-push` + `scripts/check-staging-integrity.mjs`(341라인) + `check-doc-refs.mjs` export/옵션 확장 | +484 −43 |
| [#248](https://github.com/tpals0409/AlgoSu/pull/248) | 3+4 (문서) | scribe | `docs/runbook/pre-push-check.md` 신규 + `git-hooks.md` §2 + `git-staging-checklist.md` §6 + `doc-ref-lint.md` §8 + `README.md` + sprint-155 ADR | +300 |

### Phase 1+2 상세 — 코드 구현 (PR #247)

**`.husky/pre-push`** (2라인):
```sh
#!/usr/bin/env sh
npx --no -- node scripts/check-staging-integrity.mjs
```

**`scripts/check-staging-integrity.mjs`** (341라인):
- 검증 1: `git ls-files --others --exclude-standard "*.md"` → untracked .md broken ref
  - `check-doc-refs.mjs` 의 `validateRef` / `extractMarkdownLinks` / `extractBareDocPaths` / `stripInlineCode` 재사용
  - 면제: `<!-- staging-check: ignore -->` 또는 `<!-- doc-ref-lint: ignore -->` (양쪽 호환)
  - exit 2 (broken ref 존재 시 push 차단)
- 검증 2: `git status --porcelain` Y=M 라인 → staged 안 된 수정 파일 검출
  - `[WARN]` 메시지 + exit 1 (push 차단 — 의도적 unstaged 는 `git push --no-verify` 우회)
- **regression fixture** `runRegressionFixtures()`:
  - 시나리오 1 — Sprint 153 Phase E: old slug `docs/runbook-monitoring-log-rules.md` 참조 → 1 violation 검출
  - 시나리오 2 — Sprint 154 PR #246: home 경로 `~/.claude/projects/.../sprint-999.md` → 1 violation 검출
  - self-test 미통과 시 exit 2 (fail-safe)

**`scripts/check-doc-refs.mjs` 확장**:
- `validateRef` / `extractMarkdownLinks` / `extractBareDocPaths` / `stripInlineCode` / `collectUntrackedMarkdown` export
- entry point guard (`process.argv[1] === __selfPath`) — import 시 main 로직 비실행
- `--include-untracked` 플래그: tracked + untracked .md 합산 스캔 (166 파일, broken ref 0건)

### Phase 3+4 상세 — 문서 (PR #248, 본 PR)

**신규 `docs/runbook/pre-push-check.md`** (7 섹션):
- §1 개요 — Sprint 153 Phase E / Sprint 154 PR #246 사고 2건 직접 인용. 3단 안전망 도식
- §2 검증 항목 2종 — exit code 행동 + 면제 패턴 상세
- §3 면제 정책 — 자동 면제 패턴 + 명시 디렉티브 (`<!-- staging-check: ignore -->`)
- §4 운영 절차 — Husky 활성화 / push 시 자동 실행 / 수동 실행
- §5 우회 — `git push --no-verify` 허용 케이스 명시
- §6 FAQ — false positive / 의도적 unstaged / self-test 실패 대응
- §7 이력

**`docs/runbook/git-hooks.md` §2 신설**:
- §2.1 도입 배경 — Sprint 153 Phase E / Sprint 154 PR #246 사고 요약 표
- §2.2 검증 항목 요약 + `pre-push-check.md` cross-ref
- §2.3 우회 절차 (`--no-verify`)

**기존 RUNBOOK cross-ref 갱신 (3건)**:
- `git-staging-checklist.md` §6: "향후 확장 후보" → "Sprint 155 완료" + 3단 안전망 표 + ADR cross-ref
- `doc-ref-lint.md` §8: untracked 한계 명시 + `--include-untracked` 옵션 + `pre-push-check.md` cross-ref
- `README.md` 로컬 개발 환경 (4) → (5): `pre-push-check` 항목 추가

## 검증

- **Phase 1 PR #247 CI**: CI SUCCESS, mergeStateStatus CLEAN ✅
- **self-test 2/2**: Sprint 153 Phase E 시나리오 + Sprint 154 PR #246 시나리오 수동 재현 → exit 2 각각 확인
- **`--include-untracked` 검증**: `node scripts/check-doc-refs.mjs --include-untracked` → 166 files, broken ref 0건
- **로컬 doc-ref-lint**: 본 sprint 신규 RUNBOOK 2건(pre-push-check.md, sprint-155.md) 자체 lint 통과 (Sprint 154 메타-자체-검증 패턴 계승)
- **Auto-Critic R1 P2 1건 → R2 clean** (Phase 1 architect): `[WARN]` 메시지 + `exit(1)` 모순 적발 → 메시지/심볼/exit code 3요소 일관성 정책 확립

## 브랜치 규율

- 2 PR 모두 신규 브랜치 + Squash merge — **22 스프린트 연속 준수** (Sprint 134 위반 이후)
- main 직접 commit 0건

## 신규 패턴

1. **3단 안전망 패턴 완성 (Sprint 154 2단 → 본 sprint 3단)** — plan(체크리스트) + pre-push(hook) + CI(lint). 각 단계가 서로 다른 시점에 서로 다른 사각지대를 차단. 한 단계 우회 시 다음 단계가 방어
2. **untracked 보강 우회 모드 (`--include-untracked`)** — `check-doc-refs.mjs` 의 `git ls-files` 기반 스캔에 untracked 파일 추가 지원. pre-push hook 은 자동 실행, 수동 검증은 `--include-untracked` 옵션
3. **entry point guard 로 ESM 함수 export 안전성** — `process.argv[1] === __selfPath` 조건으로 import 시 main 로직 비실행. `check-staging-integrity.mjs` 가 `check-doc-refs.mjs` 함수를 import 할 때 CI 진입점 중복 실행 방지
4. **regression fixture 직전 사고 시나리오 직접 매핑** — Sprint 153 Phase E (old slug) + Sprint 154 PR #246 (home 경로) 를 self-test 기준선으로 고정. Sprint 154 패턴 (5종 슬러그 fixture) 과 동일 원칙

## 교훈

1. **`[WARN]` vs `exit(1)` 모순은 Auto-Critic R1 로 즉시 적발 (사용자/팀 혼란 사전 차단)** — exit(1) 은 push 를 실제로 차단하나 `[WARN]` 접두어는 "계속해도 됨" 으로 오해받기 쉽다. 메시지 심볼(`[OK]`/`[WARN]`/`[FAIL]`) + exit code 3요소가 일관되어야 hook 의 신뢰성이 유지된다
2. **`<!-- staging-check: ignore -->` 와 `<!-- doc-ref-lint: ignore -->` 호환 정책** — 두 lint 가 동일 파일을 검사하므로 면제 디렉티브 1개로 양쪽 모두 면제되어야 한다. 운영 부담 최소화
3. **메시지/심볼/exit code 3요소 일관성이 hook 신뢰성의 핵심** — `[OK]` = exit 0 / `[WARN]` = exit 1 (soft block) / `[FAIL]` = exit 2 (hard block). 불일치 시 팀원이 출력을 무시하거나 잘못 판단할 위험
4. **신규 RUNBOOK 자체 doc-ref-lint 통과 검증 (Sprint 154 메타-자체-검증 패턴 계승)** — 본 sprint 도입 pre-push-check.md 자체도 commit 전 lint 통과. 3단 안전망 RUNBOOK 이 자체 망에서 검증됨

## Sprint 156 이월

### UAT 사용자 직접 (12 스프린트 누적)

- 시드 #5: 프로그래머스 재제출 채점 통과 확인
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합

### Sprint 152~153 신규 자동화 후보 (이월 유지)

- 시드 #18: 블로그 글 머지 전 도메인 사실 cross-check 자동화
- 시드 #19: KR/EN 양면 동시 작성 plan 의무 + CI 룰

### 후속 (선택, Sprint 151 그대로)

- create/edit page.tsx category UI 추가
- Programmers URL 자동 카테고리 추론
- 기존 SQL 문제 데이터 백필
- Sprint 150 미해소 3건 (`.claude-tools/` 정리 / CI paths filter 우회 부채 점검 자동화 / prom-client default metric stale 점검)

## 관련 메모리

- [sprint-window.md](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/sprint-window.md) <!-- doc-ref-lint: ignore -->
