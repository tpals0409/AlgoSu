---
sprint: 154
title: "Sprint 153 자동화 후속 — git staging plan 명시화 + broken ref 정기 점검 lint"
date: "2026-05-14"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-151", "sprint-152", "sprint-153"]
related_memory: ["sprint-window"]
---
# Sprint 154 — Sprint 153 자동화 후속: git staging plan 명시화 + broken ref 정기 점검 lint

## 목표

- Sprint 153 회고에서 도출된 자동화 후보 2건(시드 #20 / #21)을 묶음 처리
- **사후 적발 (Phase B / 시드 #21)**: Sprint 153 Phase G 5종 슬러그 23회 broken ref 사례를 정기 lint 로 자동화
- **사전 차단 (Phase A / 시드 #20)**: Sprint 153 Phase A/E 두 차례 재발한 `git mv` + sed staging 누락 사고 plan 단계 체크리스트화

## 결정

- **Phase B 먼저 / Phase A 나중**: Phase A 페르소나 cross-ref 가 Phase B 산출물(`docs/runbook/doc-ref-lint.md`) 을 인용하므로 순서 의존성 존재
- **Phase B**: `scripts/check-doc-refs.mjs` 신규 + `quality-docs` job 신설 — 기존 `check-grafana-metrics.mjs` / `check-regex-robustness.mjs` 와 동일 패턴 (`runRegressionFixtures()` self-test + paths filter + exit code 0/1/2)
- **Phase A**: 신규 RUNBOOK `docs/runbook/git-staging-checklist.md` + `architect.md` / `scribe.md` 페르소나 cross-ref — Sprint 153 사고 3건(commit 누락 / main 노출 / stash drop 손실) 모두 복구 절차 §3 에 직접 반영
- **사고-대 RUNBOOK 1:1 매핑 원칙**: 본 sprint 두 RUNBOOK 모두 직전 sprint 사고를 fixture/사례로 등록 — 회귀 차단 본질을 "정성 룰" 이 아닌 "구체 사례" 로 고정
- 각 phase 독립 PR + Squash merge — 변경 범위/위험도 분리 (Sprint 150/152/153 패턴 직접 계승)

## 구현 (2 PR squash merge, origin/main `661cd59` → `cc26411`)

| PR | Phase | 변경 | 라인 |
|----|-------|------|------|
| [#244](https://github.com/tpals0409/AlgoSu/pull/244) | B | `scripts/check-doc-refs.mjs` 신규 + CI `quality-docs` job + `docs/runbook/doc-ref-lint.md` + 인덱스 2건 + sprint-102.md 면제 디렉티브 2건 | +415 −5 |
| [#245](https://github.com/tpals0409/AlgoSu/pull/245) | A | `docs/runbook/git-staging-checklist.md` 신규 + `architect.md` / `scribe.md` 페르소나 cross-ref + 인덱스 2건 | +156 −3 |

### Phase B 상세 — broken ref lint

**`scripts/check-doc-refs.mjs`** (255라인):
- `git ls-files '*.md'` → tracked .md 159 파일 (Phase A 머지 후 기준)
- 두 추출 룰: (1) markdown link `[text](path)` (2) bare doc path `docs/.../*.md`
- 자동 면제: 외부 URL (`http://` / `https://` / `mailto:` / `file:`) / anchor-only / 템플릿 변수 / 코드 펜스 / 인라인 코드
- 명시 면제: 라인 끝 `<!-- doc-ref-lint: ignore -->` 디렉티브
- **self-test fixture**: Sprint 153 Phase G 5종 슬러그(`docs/runbook-monitoring-log-rules.md` / `-ci-cd-rules.md` / `-annotation-dictionary.md` / `-migration-rules.md` / `-work-progress-guide.md`) inline 검증 — 검출 수 불일치 시 **exit 2 self-test fail**
- exit code: 0 (통과) / 1 (broken ref) / 2 (self-test fail)

**CI 통합** (`.github/workflows/ci.yml`):
- `detect-changes` 에 `docs` paths filter 추가 (`docs/**/*.md`, `*.md`, `.claude/commands/**/*.md`, `blog/content/**/*.mdx`, `scripts/check-doc-refs.mjs`)
- `quality-monitoring` 옆 `quality-docs` job 신설 — `needs: detect-changes`, `if: docs == 'true'`
- `rebuild_all` override 분기에 `docs=true` 추가

**즉시 적발 + 해소**:
- sprint-102.md:76, sprint-102.md:85 — 사용자 home `~/.claude/projects/.../memory/...` 절대 경로 (repo 외부, 머신마다 다름) → **면제 디렉티브** 적용
- sprint-72.md:37 — `file:///root/.claude/...` 스킴 → `validateRef()` 외부 URL 면제 패턴에 `file:` 스킴 추가로 자동 처리

### Phase A 상세 — staging 체크리스트

**`docs/runbook/git-staging-checklist.md`** (142라인, 7 섹션):
- §1 개요 — Sprint 153 Phase A (단일 PR 내 자체 발견) / Phase E (main 노출 → PR #241 hotfix) 사고 2건 직접 인용
- §2 plan 작성 시 체크리스트 — 작업 분류 4종(Edit/Write 만 / `git mv` 만 / sed 다중 / 결합) × staging 명령 매트릭스 + commit 직전 `git status --short` + `git diff --cached --stat` 검증
- §3 복구 절차 — 3종 사고(commit 누락 / main broken link / `git stash push -u` + `drop` 후 untracked 손실) 모두 Sprint 153 사고 1:1 매핑
- §4 plan 템플릿 예시 — `**staging 절차**:` 섹션 필수 항목
- §5 에이전트 책임 분장 — architect / scribe / conductor / critic
- §6 운영 절차 — 로컬 + CI 자동화 향후 확장 후보 (pre-push hook / PR check)
- §7 이력

**페르소나 cross-ref**:
- `architect.md`: monitoring 정규식 체크리스트 옆에 staging 체크리스트 의무 항목 추가 (3 라인)
- `scribe.md`: 문서 이동/리네이밍 plan 시 §2 명시 + broken ref 사후 lint 의무(`node scripts/check-doc-refs.mjs`) — Phase B 산출물과 직접 연계

## 검증

- **Phase B PR #244 CI**: 29 success / 0 fail / 11 skipped, mergeStateStatus **CLEAN** ✅
- **Phase A PR #245 CI**: 28 success / 0 fail / 12 skipped, mergeStateStatus **CLEAN** ✅
- **로컬 lint**: 본 sprint 진행 중 매 phase 후 `node scripts/check-doc-refs.mjs` 실행 — broken ref 0건 / fixture 5/5 일관 유지
- **자동 면제 검증**: `file:` 스킴 추가 + sprint-102.md 디렉티브 2건으로 적발 3건 모두 정상 처리 (false positive 0건)
- **신규 RUNBOOK 2건의 doc-ref-lint 자체 검증**: 본 sprint 진행 중 추가된 `doc-ref-lint.md` / `git-staging-checklist.md` 도 lint 통과

## 브랜치 규율

- 2 PR 모두 신규 브랜치 + Squash merge — **20 스프린트 연속 준수** (Sprint 134 위반 이후)
- main 직접 commit 0건

## 신규 패턴

1. **사후 적발 + 사전 차단 쌍(pair) 패턴** — Phase B(lint, 사후 적발) + Phase A(체크리스트, 사전 차단) 짝맞춤. 단일 결함 도메인에 두 단계 안전망 동시 도입
2. **직전 sprint 사고를 fixture/사례로 1:1 매핑** — Phase B self-test 5종(=Phase G 슬러그 5종) + Phase A 복구 절차 3종(=Phase A/E + stash drop 부수 사고). 회귀 차단을 "정성 룰" 이 아닌 "구체 사례" 로 고정
3. **신규 RUNBOOK 자체 lint 통과 검증** — Phase B 도입 lint 가 Phase A 산출물도 즉시 검증. 메타-자체-검증 사이클 완결
4. **paths filter 신규 항목 추가 시 SSOT 5종 동시 갱신 의무** — (1) filters 블록 (2) outputs (3) rebuild_all 분기 (4) job needs (5) job if. Sprint 154 phase B 에서 5종 모두 정확히 갱신
5. **단일 sprint 2 PR 묶음 응답** — Sprint 152 (3 PR / blog) / Sprint 151 (2 PR / SQL) / Sprint 150 (3 PR / 시드 묶음) 패턴 계승. 영향 범위 분리 + 순차 머지

## 교훈

1. **plan 자동화 + 코드 자동화는 별개 안전망** — Phase A(plan 단계 명시화)와 Phase B(CI 자동 검증)는 동일 결함을 서로 다른 단계에서 차단. 한 쪽만으로는 불충분 — plan 누락 가능 + CI 우회 가능
2. **`file:` 스킴은 외부 URL 면제에 누락되기 쉬움** — `http(s)://`, `mailto:`, `tel:`, `ftp:` 만 흔히 고려. `file:///` 도 동일 카테고리 — Phase B 1차 적발 시 즉시 추가
3. **자동 면제 vs 명시 면제 분리 정책** — 외부 URL 처럼 결정적 패턴은 코드 룰에 / 사용자 home 경로처럼 컨텍스트 의존 면제는 명시 디렉티브로. 코드 룰에 사용자 home 패턴 박으면 fragile
4. **신규 RUNBOOK 추가 시 인덱스 2종 동시 갱신 의무 (Sprint 153 Phase D 패턴 직접 계승)** — `docs/runbook/README.md` (런북 인덱스) + `docs/README.md` (전체 인덱스 카테고리 갯수). 본 sprint 두 phase 모두 두 인덱스 동시 갱신 ✅
5. **에이전트 페르소나 cross-ref 는 작성 시점부터 신규 작업 즉시 반영** — Phase A에서 `architect.md` / `scribe.md` 갱신은 다음 sprint 부터가 아닌 본 sprint 진행 중에도 유효 — Phase B 작업 시 staging 체크리스트 자체 적용 (Edit/Write 만이므로 §2.2 첫 케이스 명시 화이트리스트 적용)

## Sprint 155 이월

### Sprint 154 신규 자동화 후보 1건

- 시드 #22: **plan 단계 staging 명령 자동 검증 (pre-push hook)** — `docs/runbook/git-staging-checklist.md` §6 향후 확장 후보. plan 본문 `**staging 절차**:` 섹션과 실제 commit 의 `git diff origin/main --stat` cross-check 자동화

### UAT 사용자 직접 (11 스프린트 누적)

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
