# Sprint 150 — 이월 시드 정리 (시드 #16/#15/#14 묶음 처리)

- **기간**: 2026-05-13 (단일 일자)
- **상태**: 완료 ✅
- **origin/main**: `d1fe387` → **`2f68402`** (3 PR squash merge)
- **start_commit**: `d1fe387`
- **end_commit**: `2f68402`
- **머지된 PR**: 3건

## 목표

Sprint 149 이월 자동화 후보 3건(시드 #14/#15/#16)을 단일 스프린트로 묶어 해소. Sprint 144~149의 "단일 일자 2~3 PR 묶음" 패턴 계승. 각 시드는 독립적인 PR 단위로 분리하여 squash merge.

## 머지된 PR

| PR | 시드 | commit | 변경 규모 | Critic |
|----|------|--------|-----------|--------|
| [#226](https://github.com/tpals0409/AlgoSu/pull/226) | #16 `.claude/commands` tracked 정책 | `c08f5e4` | 21 files / +1161 -4 | 미호출 (정책/문서) |
| [#227](https://github.com/tpals0409/AlgoSu/pull/227) | #15 extractInlineBlock 6종 YAML modifier | `dcd2502` | 1 file / +29 -2 | R1+R2 P2 해소 → **R3 clean** |
| [#228](https://github.com/tpals0409/AlgoSu/pull/228) | #14 problem context coverage 보강 | `2f68402` | 3 files / +228 -1 | R1 clean + R2 clean |

## 작업 요약

### PR #226 (시드 #16) — `.claude/commands` tracked 정책 (`c08f5e4`)

**배경**: Sprint 147 회고에서 `.claude/commands/agents/{critic,architect}.md`에 추가한 RUNBOOK cross-ref가 gitignored 상태라 다른 머신에서 동기화 불가하다는 한계 드러남.

**변경**:
- `.gitignore`: `.claude/*` + `!.claude/commands/` negation 패턴 도입 (commands는 tracked, `settings.local.json`/`scheduled_tasks.lock`는 untracked)
- `.claude/commands/` 18개 파일 신규 tracked (5 root commands + 13 agents)
- `docs/runbook-claude-commands.md` 신설 6 섹션 — tracked/untracked 경계 정책, 신규 등록 의무, 보안 grep 체크리스트, 로컬/공유 경계 결정 기준
- `CLAUDE.md` "Agent 워크플로우" 섹션 확장
- `agents/` stale 라인 제거 (.gitignore L92 — 디렉토리 미존재)
- `.claude-tools/` 명시적 untracked (Oracle 디스패치 도구, 별도 정리 예정)

**보안 검증**: 18개 파일 전체 grep — 매치 14건 모두 정책 키워드 텍스트 (실제 시크릿 값 0건).

### PR #227 (시드 #15) — extractInlineBlock 6종 YAML modifier 인식 통일 (`dcd2502`)

**배경**: Sprint 148 PR #221 Critic R2 관찰 사항. `scripts/check-grafana-metrics.mjs:638` `extractInlineBlock()`는 `${key}: |` 단일 modifier만 인식, 같은 파일의 `validateRuleExprLabels`(L972 주변)는 6종 modifier(`|`, `|-`, `|+`, `>`, `>-`, `>+`) 전부 인식 — 비대칭. 현재 ConfigMap 모두 `|` 사용으로 회귀 없으나, 미래 작성자가 `|-`/`>` 사용 시 silent skip → dashboard 검증 자체가 동작 안 함.

**변경 (R1→R2→R3 점진 정밀화)**:
- R1 (`8741aea`): `[|>][-+]?\s*$` regex + `escapeRegExpLiteral` 헬퍼 — over-narrow (inline comment + indentation indicator 거부)
- R2 (`ce12c91`): `[|>](?:[-+]?[1-9]?|[1-9]?[-+]?)\s*(?:#.*)?$` — indentation indicator 허용했으나 body indent hardcoded 4-space와 충돌
- R3 (`09ec31b`): `[|>][-+]?\s*(?:#.*)?$` — explicit indentation indicator 의도적 reject + inline comment 유지. 운영 정책 명문화 (silent skip 회피)

**검증 매트릭스**:
- POSITIVE 9종: 6 modifier + inline comment 3변종 → EXTRACT ok
- INTENTIONAL REJECT 5종: `|1`, `|2`, `|-2`, `|2-`, `|+3` → NULL ok (의도적)
- INVALID YAML 5종: `|*`, `|abc`, `|--`, `||`, `|>` → NULL ok
- baseline 동일: 204 metrics / 32 strict / 15 wildcard / 124 labels / 41 panel pairs / 2 vars / 15 rule pairs / 0 violations

### PR #228 (시드 #14) — problem context 회귀 차단 + coverage 보강 (`2f68402`)

**배경**: Sprint 143 Critic R2 P2에서 결정된 `submission.service.ts` L89~90 `problemTitle ?? ''` 폴백 정책의 회귀 차단 테스트 부재. 추가로 CI Test Submission이 paths filter로 SKIPPED 처리되어 main에서 functions 95.53% threshold 미달이 우회되던 부채 노출.

**변경 단계**:
1. **`de08975`** (`submission.service.spec.ts` +72): `?? ''` 폴백 회귀 차단 테스트 3건
   - null title/description → entity에 `''` 저장
   - undefined title/description → entity에 `''` 저장
   - 정상 title/description → entity에 실제 값 저장
2. **`f98ff19`** (`problem-service-client.spec.ts` +156 + `jest.config.ts` +1):
   - `getProblemInfo()` 5건 (정상 / userId 미전달 / CB throw fallback / Error resolve 방어 / config 미설정 즉시 fallback)
   - `_doGetProblemInfo()` 3건 (200 정상 / 200 누락 빈 문자열 / 404 throw)
   - `jest.config.ts`: `collectCoverageFrom`에 `!**/*.spec.ts` 명시 (정책 명확화)

**검증**:
- jest 354 tests passed (이전 346 + 신규 8), success=true
- threshold 전체 통과
- `problem-service-client.ts` coverage: stmt 78.9 → 97.77 / br 72.7 → 93.93 / fns 83.3 → 100 / lines 78 → 98.8

## Critic 호출 (3건 × 라운드)

| PR | 라운드 | 세션 ID | 결과 |
|----|--------|---------|------|
| #226 | — | — | 미호출 (정책/문서) |
| #227 | R1 | `019e1ebb-8a05-7543-ba4f-0ccfee5cb1cc` | P2 1건 (anchored regex over-narrow) |
| #227 | R2 | `019e1ebe-45a2-7161-a603-9e303156fbec` | P2 1건 (indentation indicator + body indent) |
| #227 | R3 | `019e1ec0-f336-74e3-926b-67d8559b7f4f` | **clean** ✅ |
| #228 | R1 | — | clean (focused regression tests) |
| #228 | R2 | — | clean (coverage 보강 + spec 제외 정책) |

## 검증 결과

| PR | CI | Test Submission | mergeStateStatus |
|----|----|-----------------|------------------|
| #226 | 38 SUCCESS / 11 SKIPPED | n/a (paths SKIPPED) | CLEAN |
| #227 | 27 SUCCESS / 12 SKIPPED | n/a (paths SKIPPED) | CLEAN |
| #228 | 28 SUCCESS / 11 SKIPPED | **pass** (354 tests, threshold 통과) | CLEAN |

## 브랜치 규율

- **3 PR 모두 신규 브랜치 + Squash merge** — **16 스프린트 연속 준수** (Sprint 134 위반 이후)
- main 직접 commit 0건
- 브랜치 명: `chore/sprint-150-claude-tracked`, `refactor/sprint-150-extract-inline-block-symmetric`, `test/sprint-150-problem-context-coverage`

## 신규 패턴

### 1. `.claude/commands/` tracked SSOT 전환

12 에이전트 페르소나 + 5 root 명령 파일이 `.gitignore` negation 패턴(`!.claude/commands/`)으로 tracked 전환. 다중 머신/팀원 간 동기화 가능. 로컬 전용(`settings.local.json`, `scheduled_tasks.lock`)은 `.claude/*`로 untracked 유지하여 경계 명시.

### 2. 회귀 차단 본질 누적 차원 확장 7차원째

Sprint 145~149 monitoring 검증 누적(metric → label → panel-title+variable → rule-label+dashboard-structure → regex-robustness)에 이어 **submission service problem context 폴백 SSOT 검증 닫힘**. 4 레이어 누적 검증:
- submission.entity (nullable)
- submission.service.ts L89~90 (`?? ''` 폴백)
- worker.py L220~227 (null 분기, Sprint 143)
- submission.service.spec.ts (회귀 차단 테스트, **본 PR**)

### 3. paths filter 우회 부채 노출 메커니즘

CI Test Submission이 paths filter(`services/submission/**`)로 SKIPPED 처리되면 main의 coverage threshold 미달이 우회됨. submission/** 변경이 발생하는 PR에서 실제 실행되어 미달 노출 → 즉시 보강 의무. 이번에는 `problem-service-client.ts`의 `getProblemInfo` 함수 자체가 단위 테스트에서 미호출 상태였음.

### 4. Critic 3 라운드 P2 해소 → R3 clean 패턴 (PR #227)

- R1 over-narrow → R2 over-permissive (indentation indicator 허용 → body indent 가정 깨짐) → R3 정확 (의도적 reject)
- R3 결론: "운영 ConfigMap에서 explicit indentation indicator(`|1`/`|2`)는 미사용 정책 → 명시적 reject가 silent skip 회피"
- Sprint 142(5라운드) / Sprint 148(3라운드) / Sprint 149(4라운드)와 동일 패턴 — 단일 조건 점진 정밀화

### 5. 시드 묶음 단일 스프린트 처리 효과

이월 시드 3건을 단일 일자 3 PR로 묶음 처리 — Sprint 144(2 PR / 21분) 패턴 계승. 컨텍스트 fresh + 부수 부채(coverage threshold) 함께 노출 + 회고 시드 즉시 처리.

## 교훈

### 1. paths filter는 양날의 검 — 누적 부채 우회 위험

`detect-changes` paths filter는 CI 시간 단축에 효과적이나, **변경 없는 서비스의 coverage threshold 미달이 우회**될 수 있음. main에서 통과로 보이는 metric이 실제 실행 시 미달일 수 있음. → 정기 점검(예: 분기 1회 full CI 실행) 또는 별도 weekly job 후보로 식별.

### 2. spec 추가 만으로는 coverage 보강 불가

submission.service.spec.ts에 회귀 차단 테스트 3건 추가만으로는 `problem-service-client.ts` production 함수 자체가 미커버. **회귀 차단의 본질은 production 분기 실행**이므로 mock factory 추가 외에 production 메서드 단위 테스트가 필요.

### 3. 단일 함수 내 modifier 지원 범위 비대칭은 시간 폭탄

`extractInlineBlock` 단일 modifier vs `validateRuleExprLabels` 6종 modifier 비대칭은 Sprint 148에서 인지됐으나 점진적 개선 후보로 분류. 6 스프린트 후 본 PR에서 해소. **인지 시점부터 누적되는 silent skip 위험**.

### 4. Critic이 자주 적발하는 결함 패턴은 CI 자동화 후보

PR #227 R1+R2 P2 적발 모두 RUNBOOK §2.4 prefix anchoring 체크리스트에 명시된 패턴. Sprint 149 PR #224에서 lint 자동화(`check-regex-robustness.mjs`) 완료. **향후 동종 패턴은 Critic 호출 전 lint 단계에서 차단**.

### 5. 운영 정책 명문화는 silent skip 회피의 핵심

YAML 1.2 명세상 `|1`/`|2` indentation indicator는 valid이나 본 codebase에서는 미사용. R2 fix가 이를 허용했더니 body indent hardcoded와 충돌. **R3에서 정책 명문화(미지원) + 미래 누군가 사용 시 NULL 반환으로 명시적 실패** → 의도된 안전망.

## Sprint 151 이월 시드

### UAT 사용자 직접 (Oracle 작업 외)
- 시드 #5: 프로그래머스 재제출 채점 통과 확인 (7 스프린트 누적)
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합

### 자동화 / 인프라
- 본 스프린트 신규 이월: **0건** (Sprint 149 이월 자동화 후보 3건 모두 해소)

### 후보 (별도 결정 필요)
- `.claude-tools/` Oracle 디스패치 도구 정리 (PR #226에서 untracked 명시, 별도 시드)
- CI paths filter 우회 부채 점검 자동화 (본 PR 교훈 #1)
- prom-client default metric stale 점검 (Sprint 145 시드 #10)
