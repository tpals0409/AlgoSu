---
sprint: 160
title: "frontend deploy 차단 forward-fix + per-service Trivy gate 본질 회귀 차단 + 알림 강화"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 160 — frontend deploy 차단 forward-fix + per-service Trivy gate 본질 회귀 차단

## 목표

- Sprint 159 PR #272 frontend AI 분석 파싱 핫픽스가 production frontend 에 4시간째 미반영된 사건의 즉시 unblock (Phase A)
- 본질 회귀 원인 — `Update GitOps manifests` job 가드(`needs.trivy-scan.result != 'failure'`)가 한 service Trivy fail 로 전 service GitOps update 를 차단하는 구조 — 의 영구 차단 (Phase B)
- "git merge 성공" 메시지 후에도 일부 service 가 SKIPPED 된 사실이 4시간 노티되지 않은 알림 가시성 문제 해결 (Phase C, Sprint 159 시드 #신규4)
- 외부 read-only 진단 세션이 식별한 frontend deploy 누락을 본 세션에서 cross-check → 즉시 unblock → 본질 차단 → 알림 강화 → 회고로 마무리하는 정식 사이클 정립

## 결정

- **옵션 B 채택 (정밀 1줄 manual PR)**: Phase A 의 unblock 경로로 옵션 A (workflow_dispatch + `rebuild_all=true`, 전 service 재빌드)/옵션 C (main 에 frontend trivial commit, history 오염) 대신 **aether-gitops 수동 PR** 선택. 변경 범위 최소(`kustomization.yaml` 1줄), 이미 빌드된 GHCR 이미지(`main-505568a`) 활용, blast radius frontend 한정
- **forward-fix 정책 계승 (Sprint 159 패턴)**: revert 또는 trivial commit 대신 정확한 SHA(`main-505568a`)로 GitOps tag advance. 핫픽스 코드는 이미 안전(GHCR 빌드 완료 + 검증)이므로 정확 적용이 정상 흐름
- **artifact 기반 per-service Trivy gate (Phase B 본질 설계)**: matrix output 단일 값 한계 회피 위해 `trivy-status/<service>.txt` 파일을 service 별 artifact (`trivy-status-<service>`) 로 export → deploy job 이 `pattern: trivy-status-* + merge-multiple: true` 로 download → per-service lookup. matrix 자체 result 는 그대로 fail 마킹 유지(commit-level 가시성)
- **fail-closed security gate (Critic R1 P1 해소)**: 본 PR 의 `trivy-scan.result != 'failure'` 가드 제거와 결합되어 artifact 누락 케이스(infra fail / upload 실패)도 통과 가능하던 결함을 명시 차단. `STATUS != "pass"` 인 모든 케이스(fail/missing/empty/기타) 를 SKIPPED 분류. 명시 `pass` 만 통과
- **deploy summary push outcome 분기 (Critic R1 P2 해소)**: Phase C `Surface deploy summary` step 의 `always()` 조건이 GitOps push fail 시에도 "✅ Deployed services" 거짓 성공 메시지 출력 가능 — sprint 목표(정확한 알림) 자기 모순. `steps.push_gitops.outcome` 으로 분기 → `success` 외 모두 "candidates only (NOT applied)" 분리. Sprint 155 패턴(Critic 1차 통과 후 자기 모순 검출) 재현
- **GitHub-native 만 사용**: Phase C 알림 강화는 `$GITHUB_STEP_SUMMARY` markdown + `::warning::` workflow command 만 활용. Discord/Slack webhook 통합은 secrets/채널 결정 필요 → 별도 sprint 범위 분리

## 구현 (3 PR squash merge + 1 aether-gitops PR, origin/main `2ec3747` → **`b385343`**)

| Repo | PR | Phase | Owner | 변경 내용 | Lines |
|------|----|-------|-------|----------|-------|
| aether-gitops | [#6](https://github.com/tpals0409/aether-gitops/pull/6) | A·P0 | architect | `algosu-frontend` tag `main-4313561` → `main-505568a` 1줄 advance | +1 −1 |
| AlgoSu | [#274](https://github.com/tpals0409/AlgoSu/pull/274) | B·P1 | architect + critic | per-service Trivy gate + artifact 통신 + fail-closed | +73 −12 |
| AlgoSu | [#275](https://github.com/tpals0409/AlgoSu/pull/275) | C·P2 | architect + critic | STEP_SUMMARY + `::warning::` + push outcome 분기 | +58 |

### PR aether-gitops #6 세부 — Phase A frontend deploy unblock

**진단 cross-check 결과 (외부 read-only 분석과 100% 일치)**:

| Fact | 확인 방법 |
|------|----------|
| PR #272 CI run `26071766405` Trivy(ai-analysis) fail → `Update GitOps manifests` SKIPPED | `gh run view 26071766405 --json conclusion,status,jobs` |
| PR #272 는 `frontend/src/lib/feedback.ts` + tests + ai-analysis 백엔드 변경 | `gh pr view 272 --json files` |
| PR #273 은 `services/ai-analysis/Dockerfile` 1개 파일만 변경 → frontend 빌드 비활성 | 동일 |
| `Update GitOps manifests` 가드 `needs.trivy-scan.result != 'failure'` (ci.yml:885) | 코드 직접 |
| PR #272 CI run 의 `Build Frontend (Next.js)` 잡 conclusion = `success` (GHCR 이미지 존재) | `gh run view 26071766405 --json jobs` |

**aether-gitops 현재 상태 확인**: `kustomization.yaml` 의 `algosu-frontend` newTag = `main-431356156f615c2e6b215baddaebf307d26c881b` (외부 진단의 4313561 과 일치). 다른 7개 서비스 tag 는 정상.

**변경 적용**: python3 정밀 치환 — `algosu-frontend` 항목만 `main-505568a229922bf2c77e9e425cfdc846c0eceb70` 으로 advance. 다른 service 영향 0.

**머지**: `mergeStateStatus: CLEAN`, CI 없음(GitOps 데이터 레포), 즉시 squash merge → aether-gitops main HEAD `cb9f9a1` → `3f50eb7` → ArgoCD reconcile 자동 sync → frontend pod rollout.

### PR AlgoSu #274 세부 — Phase B per-service Trivy gate 본질 차단

**회귀 시나리오 재확인**: PR #272 CI run 26071766405 → `Build Frontend (Next.js)` ✅ + `Build AI Analysis (FastAPI)` ✅ + `Trivy Scan — ai-analysis` ❌ → `Update GitOps manifests` SKIPPED (frontend 까지 모두 차단). PR #273 (ai-analysis CVE 패치) 머지 후 ai-analysis 만 GitOps 갱신, frontend 는 4시간째 pre-hotfix 이미지(`main-4313561`)로 운영.

**설계 4단**:

1. **trivy-scan matrix 에 service 별 결과 artifact 기록**:
   - `Trivy scan (table)` step 에 `id: trivy_table` 추가
   - 새 step `Record Trivy result for deploy gate` — `trivy-status/<service>.txt` 에 `pass`/`fail` 1줄 기록 (`always()` + `skip == 'false'`)
   - 새 step `Upload Trivy status artifact` — `trivy-status-<service>` artifact (always, retention 1일)

2. **deploy job 가드에서 aggregated `trivy-scan.result != 'failure'` 제거**:
   ```diff
   if: |
     github.ref == 'refs/heads/main' && !cancelled() &&
     needs.secret-scan.result == 'success' &&
   - needs.trivy-scan.result != 'failure' &&
     (needs.build-services.result == 'success' || ...)
   ```

3. **deploy job 신규 step 2개**:
   - `Download Trivy status artifacts` — `pattern: trivy-status-* + merge-multiple: true` 평탄화
   - `Probe Trivy status artifacts (Sprint 157 시드 #29)` — directory listing + service 별 결과 echo

4. **Update image tags 로직 재설계**:
   - `CANDIDATES` 수집 (build 성공 + detect-changes 활성 service)
   - service 별 `trivy-status/<svc>.txt` lookup → fail 인 service 만 `SKIPPED_TRIVY` 분리
   - 통과한 service 만 `kustomization.yaml` tag 갱신
   - outputs `updated` / `skipped_trivy` 노출 (Phase C 입력)

**Critic R1 P1 해소 사이클**:

> "When a candidate service has no `${SVC}.txt` status file, this loop treats it as passing and updates its GitOps tag. ... Treat missing or non-`pass` status as skipped/failed for the service."

→ 이전 로직(`if [ -f "$STATUS_FILE" ] && [ "$(cat ...)" = "fail" ]`)이 fail 만 명시 분류, missing 은 통과 → security gate 우회. 수정: `STATUS != "pass"` 모든 케이스(fail/missing/empty/기타) SKIPPED. **fail-closed security gate**.

```bash
STATUS=$(cat "$STATUS_FILE" 2>/dev/null || echo "missing")
if [ "$STATUS" != "pass" ]; then
  SKIPPED_TRIVY="${SKIPPED_TRIVY} ${SVC}"
  echo "  ⚠ algosu-${SVC} SKIPPED (Trivy status: ${STATUS} — ...)"
  continue
fi
```

**Critic R2 Clean** ✅: "The change makes the deploy gate require an explicit per-service Trivy pass status and treats missing/empty/failed statuses as skipped, which is consistent with the fail-closed intent. I did not identify a discrete regression introduced by this commit."

### PR AlgoSu #275 세부 — Phase C deploy 차단 알림 강화

**Sprint 159 시드 #신규4 충족**: Phase B 에서 노출한 `deploy.outputs.skipped_trivy` 를 활용해 두 layer 의 명시적 가시화.

1. **deploy job `outputs:` 선언**:
   ```yaml
   outputs:
     updated: ${{ steps.update_tags.outputs.updated }}
     skipped_trivy: ${{ steps.update_tags.outputs.skipped_trivy }}
   ```

2. **`Surface deploy summary` step (`always()`)** — `$GITHUB_STEP_SUMMARY` markdown:
   - `### ✅ Deployed services` 섹션 + 각 service tag
   - `### 🚫 SKIPPED (Trivy fail or status missing)` 섹션 + 조치 안내
   - SKIPPED non-empty 시 `> ⚠️ "git merge 성공" ≠ "deploy 성공"` 경고 인용문

3. **`notify` job `Warn on Trivy-skipped services` step** — `if: needs.deploy.outputs.skipped_trivy != ''`:
   - `::warning::` 3줄 — service 명단 + production 이미지 advance 안 됐다는 명시 + 재발 방지 안내

**Critic R1 P2 해소 사이클** (sprint 목표 자기 모순 검출):

> "When `git commit` or `git push` fails after `update_tags` has populated `UPDATED`, this `always()` summary still runs and labels those services as deployed even though the GitOps repo was not updated. ... gate the 'Deployed services' section on the commit/push result or phrase these as candidates when the deploy job has failed."

→ Phase C 본질 = "deploy 결과 정확한 가시화" 인데 push fail 시 거짓 성공 메시지 → sprint 목표 정면 모순. 수정:
- `Commit and push to aether-gitops` step 에 `id: push_gitops` 추가
- summary step 에서 `steps.push_gitops.outcome` 으로 분기:
  - `success` → "✅ Deployed services"
  - 그 외 → "🚫 GitOps push failed" + "candidates only — production is unchanged" + intended tag 명시 `(NOT applied)`

**Critic R2 Clean** ✅: "does not introduce an obvious workflow-breaking issue".

## 신규 패턴

1. **외부 read-only 진단 → 본 세션 cross-check → 즉시 hotfix → 본질 차단 → 알림 강화 → ADR 의 6-단계 사이클** — 단일 sprint 안에서 production 사고 진단부터 회고까지 full cycle. Sprint 159 (단순 hotfix + ADR) 보다 한 단계 진화

2. **production hotfix 옵션 비교표 + 사용자 단일 선택 후 즉시 실행** — A (workflow_dispatch rebuild_all) / B (manual aether-gitops PR) / C (main trivial commit) 옵션 명시 + 변경 범위 / 위험 / 소요 / 평가 4축 비교 → 사용자 옵션 B 단일 선택 → plan 그대로 실행. Sprint 156 옵션 선택 패턴 직접 계승

3. **artifact 기반 per-service gate 통신 패턴** — GitHub Actions matrix output 단일 값 한계 회피. `<key>-<dim>` artifact 명 + `pattern + merge-multiple` 평탄화 → deploy job 이 service 별 lookup. matrix 자체 result 는 fail 마킹 유지(commit-level 가시성). matrix output 한계의 표준 우회 패턴

4. **fail-closed security gate 원칙** — Critic R1 P1 정착. `STATUS != "pass"` 모든 경우(fail/missing/empty/기타) 차단. 명시 `pass` 만 통과. infra fail / artifact upload 실패도 자동 차단. Phase B의 본질 안전 원칙

5. **Critic R1 P2 sprint 목표 자기 모순 검출 재현 (Sprint 155/159 패턴 강화)** — Phase C `always()` summary 의 거짓 성공 메시지가 Phase C 본질(정확한 알림)과 정면 모순. R1 통과 → R2 진입 직전에 자기 모순 검출. 본 sprint 의 두 번째 자기 모순 검출 (Phase B P1 + Phase C P2)

6. **forward-fix 정책 계승** — Sprint 159 base image 패치 패턴 그대로 Phase A 에서 재현. revert 회피, 정확한 SHA 로 GitOps tag advance. 코드는 안전(GHCR 빌드 완료 + 검증)이므로 정확 적용이 정상

7. **GitHub-native 만 사용한 알림 강화** — `$GITHUB_STEP_SUMMARY` + `::warning::` workflow command. 추가 secrets / webhook 불필요. Discord/Slack 통합은 secrets/채널 결정 필요 → 별도 sprint 분리. 점진 강화 정책

8. **Critic R1 메시지의 정확한 위치 인용** — Critic 이 line:973-979 / line:1033-1036 형식으로 정확한 위치 + 회귀 시나리오 + 수정 방향을 인용. 본 sprint architect 측 수정 사이클이 1회로 마무리. Codex 교차 검증의 위치 인용 정밀도 효과

9. **PR 단계 CI green 자체가 본질 변경 회귀 차단** — Phase B/C 변경 후 본 PR CI 27 잡 SUCCESS 가 그 자체로 회귀 차단 1차 게이트. Trivy fail 시나리오 실증 검증은 별도 sprint 이월

## 교훈

1. **외부 read-only 진단 세션 결과는 cross-check 필수** — 외부 분석이 100% 정확했지만 우리 측 git/CI cross-check 4건(`gh run view` / `gh pr view --json files` 두 PR / ci.yml deploy job 가드 + matrix outputs 한계 확인)으로 actionable plan 구체화. 외부 진단 + 본 세션 cross-check 의 2단 검증이 안전

2. **`Update GitOps manifests` 가드의 매트릭스 aggregated 한계** — `needs.<matrix-job>.result` 는 단일 값만 노출 (한 service fail = 전체 result=failure). matrix 의 service 별 결과 활용은 artifact / job-output / 별도 job 분리 패턴 필요. 본질 회귀 원인의 핵심

3. **fail-open security gate 의 함정** — "file 있고 fail 이면 차단" 패턴은 file 누락 시 통과 = fail-open. 보안 게이트는 항상 fail-closed (명시적 pass 만 통과). Critic R1 P1 핵심 교훈

4. **sprint 목표 자기 모순 검출은 Critic 1차 통과 후에도 가능** — Phase B R1 P1 (sprint 목표 = "한 service fail이 전 service 차단 안 함" 인데 missing 통과 = 또 다른 security 회귀) / Phase C R1 P2 (sprint 목표 = "deploy 정확한 알림" 인데 push fail 시 거짓 성공 메시지). Auto-Critic 의 sprint 일관성 가드 효과 본 sprint 두 번 재확인. Sprint 155 → 159 → 160 패턴 강화

5. **production hotfix 옵션 비교표가 사용자 결정의 핵심 도구** — 옵션 A/B/C 변경 범위 / 위험 / 소요 / 평가 4축 비교 → 사용자 단일 선택 → plan 즉시 실행. 옵션 추천 없이 plan 만 제시 시 사용자가 결정 부담. 비교표 + 추천 마크 + 사용자 선택 의 3단 분리

6. **PR 단계 Trivy SKIP + post-merge 만 실제 실행 = 회귀 검출 불가** (Sprint 159 교훈 재확인) → 시드 #신규1 (PR 단계 Trivy 활성화) 우선순위 상승. Phase B 변경 자체는 본질 회귀 차단이지만 PR 단계 SKIP 은 별도 sprint 필요

7. **base image 회귀 + matrix gate 동시 회귀의 conjunction** — Sprint 159 의 ai-analysis Trivy fail 자체는 base image 정기 갱신 부재 (시드 #신규2) + matrix gate 한계 (본 sprint Phase B) 두 회귀의 conjunction. 두 회귀 모두 차단해야 완전 안전

8. **GitOps 데이터 레포는 CI 없음 → manual review 가 유일 안전망** — aether-gitops PR #6 의 `mergeStateStatus: CLEAN` 은 CI 부재 때문. 자동 검증 없음. 본 sprint 는 정밀 1줄 변경이라 risk 낮음이지만 복잡한 GitOps 변경 시 manual review 강화 필요 (별도 sprint)

9. **"git merge 성공" 메시지의 모호성은 GitHub-native 알림으로 일부 해소 가능** — Discord/Slack 통합 없이도 STEP_SUMMARY + `::warning::` 으로 충분한 가시성. 본 sprint Phase C 의 핵심 발견. 더 강한 통합은 점진 강화

## Sprint 161 이월 시드

### Sprint 159 이월 (3건 유지, 1건 본 sprint 정착)

- 시드 #신규1: PR 단계 Trivy scan 활성화 (matrix conditional 변경) — 본 sprint 교훈 #6 우선순위 상승
- 시드 #신규2: base image 정기 갱신 자동화 (Dependabot Dockerfile updater 또는 weekly cron) — 본 sprint 교훈 #7 conjunction 한 축
- 시드 #신규3: `_parse_group_response` raw_text fallback 동일 envelope 적용
- 시드 #신규4: ✅ **본 sprint Phase C 정착**

### Sprint 160 신규 시드

- 시드 #신규5: PR 단계 deploy gate 시뮬레이션 (dry-run mode) — 본질 변경 회귀 차단 강화
- 시드 #신규6: aether-gitops `kustomization.yaml` 변경 자동 PR template — Phase A 패턴 재현 시 일관성
- 시드 #신규7: `$GITHUB_STEP_SUMMARY` 표준화 — 다른 job (build/test/quality) 도 summary markdown 통일

### Sprint 158 이월 계속

- 시드 #30: 빌드 산출물 한국어 잔재 자동 검증 CI step (allowlist 기반)
- 시드 #31: i18n 매칭 체크리스트 3계층 (메타/UI/본문) plan 템플릿 자동

### Sprint 157 이월 계속

- 시드 #24: plan 템플릿 i18n 양면 의무 체크리스트 자동
- 시드 #26: docs/adr/README.md paths filter negation
- 시드 #27: CI build-blog `ls out/` 산출물 실재 검증 step
- 시드 #28: check-adr-links.mjs ROOT 자동 감지
- 시드 #29: ✅ **본 sprint Phase B 정착** (probe step 동반)

### UAT 사용자 직접 (17 스프린트 누적)

- 시드 #5: 프로그래머스 재제출 채점 통과 확인
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합

### 이월 유지

- 시드 #18: 블로그 글 머지 전 도메인 사실 cross-check 자동화
- 시드 #23: plan 템플릿 "rebase 후 누적 카운트 fix" 체크리스트

### 후속 (선택)

- create/edit page.tsx category UI / Programmers URL 자동 카테고리 추론 / 기존 SQL 문제 데이터 백필 / coverage-gate `skipped` 허용 제거 / post-merge pre-deploy gate / prom-client Case B~D 점검 자동화 / `.claude-tools/` Phase 2 실제 삭제 / `(adr)` layout 분할

## 검증

| 항목 | 결과 |
|------|------|
| aether-gitops PR #6 | MERGED (`3f50eb7`) — ArgoCD reconcile 시작 |
| Phase A frontend rollout + 핫픽스 동작 시각 검증 | 사용자 외부 read-only 세션 협조 대기 |
| AlgoSu PR #274 (Phase B) CI | 27/27 SUCCESS, mergeStateStatus CLEAN, Critic R1 P1 → R2 clean |
| AlgoSu PR #275 (Phase C) CI | 27/27 SUCCESS, mergeStateStatus CLEAN, Critic R1 P2 → R2 clean |
| YAML syntax (`python3 yaml.safe_load`) | 두 PR 모두 OK |
| 본 PR ADR (Phase D) CI | 본 PR 자체로 검증 예정 |

## 브랜치 규율 ✅ 28 스프린트 연속 준수

- 3 PR (AlgoSu 2 + aether-gitops 1) 모두 신규 브랜치 + Squash merge
- main 직접 commit 0건
- `--no-verify` 0건
- Critic R1/R2 cycle 2회 (Phase B/C 각각)

## 변경 파일

- `.github/workflows/ci.yml` — trivy-scan matrix artifact export + deploy job per-service gate + STEP_SUMMARY + notify warning (Phase B/C 통합, +131 −15)
- `aether-gitops:algosu/overlays/prod/kustomization.yaml` — frontend tag advance (Phase A, +1 −1)
- `docs/adr/sprints/sprint-159.md` — 누락 회수 (Sprint 159 본문)
- `docs/adr-en/sprints/sprint-159.md` — 누락 회수 (Sprint 159 EN)
- `docs/adr/sprints/sprint-160.md` — 본 ADR
- `docs/adr-en/sprints/sprint-160.md` — 본 ADR EN
