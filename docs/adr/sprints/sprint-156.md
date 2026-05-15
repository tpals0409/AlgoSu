---
sprint: 156
title: "Sprint 150 미해소 자동화 부채 3건 묶음 처리 (.claude-tools/ RUNBOOK + CI weekly cron + prom-client stale 점검)"
date: "2026-05-15"
status: completed
agents: [Oracle, Scribe, Architect]
related_adrs: ["sprint-150", "sprint-151", "sprint-155"]
related_memory: ["sprint-window"]
---
# Sprint 156 — Sprint 150 미해소 자동화 부채 3건 묶음 처리

## 목표

- Sprint 150 시드로 식별된 자동화 부채 3건을 단일 일자 묶음 처리 (Sprint 150 패턴 계승)
- `.claude-tools/` 정리 / CI paths filter 우회 부채 점검 자동화 / prom-client default metric stale 점검 3 도메인 동시 해소
- Sprint 155 3단 안전망 + Auto-Critic 큐잉을 본 sprint 모든 PR에서 실효성 검증

## 결정

- **Phase A**: `.claude-tools/`가 `.gitignore` untracked로 발견 → plan 조정. 실제 파일 마커 대신 tracked RUNBOOK(`docs/runbook/claude-tools.md`)으로 운영 정책 명문화 (Oracle 판정, safety-first 원칙)
- **Phase B**: 사용자가 옵션 A 확정 (weekly cron 신설만). `ci.yml` 기존 `rebuild_all` 입력 활용 → `workflow_dispatch` trigger로 코드 중복 0
- **Phase C**: `collectDefaultMetrics()` 중복 호출이 실제 throw 확인 (test 1차 fail) → spec을 "방어 근거 문서화" 방향으로 수정. @Global 싱글턴이 필수인 이유를 회귀 차단 spec으로 SSOT화
- **단일 sprint 3 PR + 1 fix commit** — Sprint 150 (3 PR) / 154 (3 PR + 1 fix) 묶음 패턴 직접 계승

## 구현 (3 PR squash merge + 1 fix commit, origin/main `a7cf227` → **`16d405a`**)

| PR | Phase | 담당 | 변경 | 라인 |
|----|-------|------|------|------|
| [#249](https://github.com/tpals0409/AlgoSu/pull/249) | A | scribe | `docs/runbook/claude-tools.md` 신규(86라인) + 인덱스 3건(`runbook/README.md` 5→6, `docs/README.md` 17→18, `CLAUDE.md` cross-ref) | +86 −3 |
| [#250](https://github.com/tpals0409/AlgoSu/pull/250) | B | architect | `.github/workflows/ci-full-validation.yml` 신규(57라인) + `scripts/check-coverage-gate-bypass.mjs` 신규(150라인) + `docs/runbook/ci-full-validation.md` 신규(108라인) + 인덱스 갱신 | +321 −3 |
| Phase B fix | B | scribe | rebase 후 `docs/README.md` 18→19 누적 반영 | +1 −1 |
| [#251](https://github.com/tpals0409/AlgoSu/pull/251) | C | architect | `scripts/check-prom-default-metrics.mjs` 신규(180라인) + `metrics.service.spec.ts` 회귀 차단 +3건 + `monitoring-logging.md` §9-3 신설(40라인) | +234 −1 |

## 검증

- **3 PR 모두 CI fail 0, mergeStateStatus CLEAN** (28 SUCCESS / 11 SKIPPED / 0 FAIL)
- `node scripts/check-doc-refs.mjs --include-untracked` 169 files, 0 broken refs (Sprint 155 산출물 활용)
- `submission/metrics.service.spec.ts` 13 PASS / 0 FAIL (회귀 차단 신규 3건 포함)
- 신규 RUNBOOK 2건(claude-tools.md / ci-full-validation.md) + §9-3 자체 lint 통과 (메타-자체-검증)
- Sprint 155 3단 안전망(plan + pre-push + CI lint) 본 sprint 모든 commit에 실효 — 0 위반

## 브랜치 규율 ✅ 24 스프린트 연속 준수

3 PR 모두 신규 브랜치 + Squash merge, main 직접 commit 0건 (Sprint 134 위반 이후).

## 신규 패턴

1. **plan 가정 깨짐 즉시 재라우팅 (Sprint 147/152 교훈 재현)** — Phase A `.claude-tools/` deprecated 마커 추가가 untracked 발견으로 무의미. tracked RUNBOOK으로 즉시 재라우팅. Oracle 판정 cycle 영향 0
2. **사용자 ExitPlanMode 옵션 선택 → 본 sprint 범위 명확화** — Phase B 옵션 A/B/C 중 사용자 확정 후 plan 그대로 진행. 큰 결정(coverage-gate 강화)은 별도 sprint 이월로 명시
3. **테스트 1차 fail로 방어 메커니즘 본질 노출** — Phase C `collectDefaultMetrics()` 중복 호출이 idempotent 가정 깨짐. spec을 "방어 근거 문서화"로 전환, @Global 싱글턴이 필수인 이유 SSOT화
4. **rebase 후 누적 카운트 fix 패턴** — 동일 위치(런북 카운트) 동시 수정 시 git auto-merge가 한쪽만 반영. PR #249 머지 후 PR #250 rebase에서 18 정체 → fix commit으로 19 보강. Sprint 150 PR #226+#227 동시 카운트 갱신 패턴 진화
5. **tracked RUNBOOK으로 untracked 도구 운영 가시성 확보** — `.gitignore` 보호된 `.claude-tools/` 의 운영 정책을 별도 tracked 문서로 노출. 보안(BOT_TOKEN 미노출) + 가시성 동시 달성

## 교훈

1. **`.gitignore` 보호 디렉토리는 tracked RUNBOOK으로 정책 명문화** — 파일 자체에 마커/주석 추가는 untracked라 git diff 무의미. SSOT는 항상 tracked 위치에
2. **prom-client `collectDefaultMetrics()`는 idempotent 아님** — 같은 prefix + 같은 registry로 두 번 호출 시 throw. @Global 싱글턴 + onModuleInit 1회 호출이 유일한 안전 패턴 (Sprint 135 Wave C P1 직접 재확인)
3. **rebase 후 동일 위치 누적 갱신은 자동 처리 안 됨** — git 3-way merge는 line 위치만 충돌 처리. 카운트(17→18) 같은 의미적 누적은 사람이 fix 필요. 본 sprint 검증 → 향후 plan 단계에서 "carry-over count fix" 체크리스트 항목화 후보 (시드 #23)
4. **paths filter 우회 부채 노출 메커니즘은 weekly cron으로 충분** — 본 sprint 옵션 A(노출 도구 신설)로 시작. 실제 부채 발견 빈도에 따라 옵션 B(coverage-gate 강화) 단계적 확장 가능. "측정 → 강화" 순서가 안전성 + CI 시간 trade-off 최적
5. **Auto-Critic 큐잉 자동 트리거는 본 sprint 적용 검증** — Phase B/C는 architect commit이라 Auto-Critic 큐잉 대상. (실제 적용 여부는 oracle-auto-critic.sh 실행 로그 확인 별도) 본 sprint는 단순 신규 추가라 P0/P1 부재 가능성 높음

## Sprint 157 이월

- **UAT 사용자 직접 (13 스프린트 누적)**: 시드 #5 프로그래머스 / 시드 #9 영문 캘린더+Grafana
- **신규 자동화 후보**:
  - 시드 #23 plan 템플릿 "rebase 후 누적 카운트 fix" 체크리스트 항목 (본 sprint Phase B fix commit 사례 직접 매핑)
- **이월 유지**:
  - 시드 #18 블로그 도메인 사실 cross-check 자동화
  - 시드 #19 KR/EN 양면 plan 의무 + CI 룰
- **후속 (선택)**:
  - create/edit page category UI
  - Programmers URL 추론
  - SQL 백필
  - coverage-gate `skipped` 허용 제거 (Phase B 옵션 B)
  - Phase B 옵션 C post-merge pre-deploy gate
  - prom-client Case B~D 점검 자동화
  - `.claude-tools/` Phase 2 실제 삭제 (trigger path 검증 후)

## 관련 문서

- [docs/runbook/claude-tools.md](../../runbook/claude-tools.md) — Phase A 산출물
- [docs/runbook/ci-full-validation.md](../../runbook/ci-full-validation.md) — Phase B 산출물
- [docs/conventions/monitoring-logging.md](../../conventions/monitoring-logging.md) §9-3 — Phase C 산출물
- [sprint-150.md](./sprint-150.md) — 본 sprint 시드 출처
- [sprint-151.md](./sprint-151.md) — Phase B Trivy hotfix 사례 직접 인용
- [sprint-155.md](./sprint-155.md) — 3단 안전망 + Auto-Critic 큐잉 본 sprint 실효성 검증
