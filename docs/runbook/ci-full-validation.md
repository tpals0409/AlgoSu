---
type: runbook
domain: ci
related:
  - docs/runbook/ci-rebuild-all.md
  - docs/conventions/ci-cd.md
---
# Weekly Full CI Validation

paths filter 우회 부채를 정기 점검하는 weekly cron + 수동 진단 도구.

## 1. 배경

### 문제

`ci.yml`의 `dorny/paths-filter`는 변경 없는 서비스의 test/coverage/Trivy를 SKIP하여 CI 시간을 절감합니다.
그러나 이 SKIP은 coverage threshold 미달이 **silent하게 우회**되는 부채를 생성합니다:

- `coverage-gate` job이 `result == 'skipped'` 를 허용 (ci.yml line 566-568)
- 변경 없는 서비스의 `lcov.info` artifact가 미생성 → coverage 검증 대상에서 제외
- main push 후에야 Trivy가 실행 (PR 단계에서는 build SKIP → Trivy SKIP)

### 사고 사례

| Sprint | 사고 | 영향 |
|--------|------|------|
| Sprint 150 | paths filter로 problem-service-client.ts functions 95% 미달 우회 | PR #228에서 노출, 즉시 보강 |
| Sprint 151 | PR CI green → main push Trivy 실패 (Next.js/fast-uri/fast-xml CVE) | PR #230 lockfile-only hotfix |

## 2. Weekly Cron 동작

### 트리거

- **자동**: 매주 일요일 03:00 KST (`schedule: cron '0 18 * * 0'`)
- **수동**: GitHub Actions UI → "Weekly Full Validation" → "Run workflow"
- **dry_run**: 수동 실행 시 `dry_run: true` 입력 → 로그만 출력, ci.yml 미 trigger

### 동작 흐름

```
ci-full-validation.yml
  └─ actions/github-script
       └─ github.rest.actions.createWorkflowDispatch
            └─ ci.yml (rebuild_all=true)
                 └─ detect-changes: 모든 서비스 true
                      └─ 전체 test/coverage/build/Trivy 실행
```

### 비용

- CI 시간: ~15분 (전체 서비스 test + build + Trivy)
- GitHub Actions 무료 tier 기준: 주 1회, 월 ~60분 소비

## 3. 수동 진단 도구

### check-coverage-gate-bypass.mjs

최근 N 커밋의 CI run에서 coverage 관련 job SKIPPED 비율을 분석합니다.

```bash
# 기본 (최근 10 runs, 50% threshold)
node scripts/check-coverage-gate-bypass.mjs

# 최근 20 runs, 30% threshold
node scripts/check-coverage-gate-bypass.mjs --commits 20 --threshold 30
```

**필요 조건**: `gh` CLI 인증 (`gh auth status` 확인)

**출력 예시**:
```
| Metric | Value |
|--------|-------|
| CI runs analyzed | 10 |
| Coverage-related jobs | 40 |
| SKIPPED jobs | 24 (60%) |
| Warn threshold | 50% |

[WARN] SKIPPED rate 60% exceeds threshold 50%.
```

## 4. 실패 대응 절차

### Weekly cron 실패 시

1. GitHub Actions → "CI — Test, Build & Push" → 최근 workflow_dispatch run 확인
2. 실패한 job 식별 (test / coverage / Trivy)
3. 실패 원인 분류:
   - **coverage threshold 미달**: 해당 서비스 테스트 보강 필요 → 즉시 hotfix PR
   - **Trivy CVE**: lockfile-only 갱신 → hotfix PR (Sprint 151 PR #230 패턴)
   - **빌드 실패**: Dockerfile / 의존성 문제 → 해당 서비스 팀 확인
4. 대응 PR 작성 후 다음 주 cron 재검증

### check-coverage-gate-bypass.mjs 경고 시

- SKIPPED rate > 50%: 정상 (대부분 docs-only / 단일 서비스 PR)
- SKIPPED rate > 80%: 장기간 특정 서비스 미변경 → manual full validation 권장
- 특정 서비스 100% SKIP: 해당 서비스 테스트가 전혀 실행되지 않음 → 보강 필수

## 5. 향후 확장 (미구현)

| 항목 | 설명 | Sprint |
|------|------|--------|
| coverage-gate `skipped` 허용 제거 | `result == 'skipped'` → `result == 'success'` 강제 | TBD |
| Weekly cron 실패 시 GitHub Issue 자동 생성 | `peter-evans/create-issue-from-file` 활용 | TBD |
| Post-merge pre-deploy gate | deploy job 전 coverage/Trivy 전체 재검증 | TBD |
| check-coverage-gate-bypass CI 통합 | weekly cron 내 자동 실행 + 결과 artifact 저장 | TBD |

## 6. 이력

| 시점 | 내용 |
|------|------|
| Sprint 150 | paths filter 우회 부채 최초 식별 (교훈 #1), weekly job 후보 제안 |
| Sprint 151 | main push Trivy 실패 재현 (PR #230 hotfix) |
| Sprint 156 | 본 RUNBOOK 작성 + weekly cron + 진단 스크립트 신설 |
