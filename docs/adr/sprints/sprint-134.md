---
sprint: 134
title: "이월 항목 처리 (계속) — revisionHistoryLimit 일괄 적용 + 메타 정정"
date: "2026-04-27"
status: in-progress
agents: [Oracle, Scribe]
related_adrs: ["ADR-026", "ADR-028"]
---

# Sprint 134: 이월 항목 처리 (계속)

## Sprint Goal

Sprint 133 이월 운영 부채 중 본 레포 실행 가능 항목 처리 + 메타 정정. Sprint 130 ADR-026에서 식별된 C-1(revisionHistoryLimit) / D-1(E2E 조사) 2건을 마감하고, 셸 글로빙 오판 패턴 재발에 대한 교훈을 기록한다.

## Decisions

### D1: C-1 revisionHistoryLimit: 3 일괄 적용 (Wave A)
- **Context**: `infra/DEPLOYMENT.md` L115에 OCI Free Tier 정책으로 `revisionHistoryLimit: 3` 명시. 그러나 `infra/k3s/` 8개 Deployment yaml에 해당 필드 미적용 — 정책과 실제 매니페스트 괴리 상태. Sprint 130 ADR-026 C-1 이월 항목. Sprint 133 D4 사후 정정으로 본 레포 직접 수정 가능 확인
- **Choice**: 8개 Deployment yaml(`ai-analysis-service`, `blog`, `frontend`, `gateway`, `github-worker`, `identity-service`, `problem-service`, `submission-service`)의 `spec` 레벨에 `revisionHistoryLimit: 3` 일괄 추가. overlay(dev/staging/prod)는 base Kustomize 상속으로 별도 변경 불필요
- **Verification**: `grep -r 'revisionHistoryLimit' infra/k3s/` 8/8 일치. ArgoCD sync 시 무중단 적용 (Deployment spec 변경이나 pod template 미변경 → rollout 없음)
- **Code Paths**: `infra/k3s/ai-analysis-service.yaml`, `infra/k3s/blog.yaml`, `infra/k3s/frontend.yaml`, `infra/k3s/gateway.yaml`, `infra/k3s/github-worker.yaml`, `infra/k3s/identity-service.yaml`, `infra/k3s/problem-service.yaml`, `infra/k3s/submission-service.yaml`
- **PR**: [#166](https://github.com/tpals0409/AlgoSu/pull/166) (`95d4bd8`)

### D2: Sprint 133 ADR Carryover C-1 / D-1 사후 정정 (Wave B)
- **Context**: Sprint 133 ADR의 Carryover 섹션 C-1과 D-1이 미완료(`[ ]`) 상태였으나 실제로는 Sprint 134에서 처리 완료
- **Choice**: `docs/adr/sprints/sprint-133.md` Carryover 항목 2건을 `[x]`로 정정
  - **C-1**: aether-gitops 작업이 아닌 본 레포 `infra/k3s/` 직접 수정으로 완료
  - **D-1**: `e2e-full.sh` 657줄 실재 확인 (Sprint 133 "미존재" 결론은 셸 글로빙 오판 — `infra/` 부재 오판과 동일 패턴 재발). `.github/workflows/ci.yml` workflow_dispatch 수동 전용으로 정상 운영 중. 자동 PR CI 통합은 Sprint 135+ 신규 시드로 재분류
- **Code Paths**: `docs/adr/sprints/sprint-133.md:73-74`
- **PR**: [#166](https://github.com/tpals0409/AlgoSu/pull/166) (`95d4bd8`)

## Patterns

### P1: 셸 글로빙 오판 → "부재" 결론 패턴 (재발 경고)
- **Where**: Scout 정찰 시 `find`/`ls` 결과가 빈 배열일 때
- **Pattern**: Sprint 133에서 2건 재발 — (1) `infra/` 디렉토리 부재 오판, (2) `e2e-full.sh` 부재 오판. 모두 셸 글로빙/인자 형태 문제로 빈 결과 반환 → "파일 없음" 조기 결론
- **Countermeasure**: `find` 빈 결과 시 "부재" 결론 전에 3중 교차 검증 필수: `ls -la <dir>` + `test -d <dir>` + `find <dir> -type f | head`. 단일 명령 결과만으로 부재 결론 금지
- **When to Apply**: 에이전트 정찰(Scout 등)에서 파일/디렉토리 존재 여부 판단 시 항상

## Metrics

| 항목 | 값 |
|------|-----|
| 총 변경 | +10줄, -2줄 (9 files) |
| jest | 변경 없음 (인프라 yaml만 수정, 테스트 영향 없음) |
| tsc | clean |
| lint | clean |
| Critic | 생략 (인프라 yaml 단순 필드 추가, 신규 로직 0건 — Sprint 131/132/133 정책 동일) |
| PR | [#166](https://github.com/tpals0409/AlgoSu/pull/166) `95d4bd8` |
| CI | 대기 중 |
| end_commit | `95d4bd8` |

## Carryover (Sprint 135+)

### 신규 시드
- [ ] Circuit Breaker 패턴 도입 (예상 1~1.5주 단독 스프린트) — github-worker 5곳(status-reporter/token-manager/worker → GitHub API) + submission 3곳(saga-orchestrator/submission.service → Problem Service, AI Analysis Service). ai-analysis Python 기존 구현(`circuit_breaker.py`) 참조. opossum 도입 + Saga 충돌 검증 + Prometheus 메트릭/Grafana 대시보드
- [ ] E2E 자동 PR CI 통합 — docker-compose.dev.yml에 services 컨테이너 확장 + ci.yml 자동 트리거 전환. 비용/시크릿 관리 평가 선행 (현 workflow_dispatch 수동 전용은 의도된 정책)

### 외부 레포 분기 (aether-gitops)
- [ ] ADR-027 구현 — aether-gitops 브랜치 규율
- [ ] SealedSecret 컨트롤러 키 rotation 자동 재봉인 CI
- [ ] AlertManager receiver self-test 룰

### 사용자 결정 대기
- [ ] ADR-028 미적용 항목 — 운영 cluster kubeconfig read-only 분리 + Claude Code 실행 환경 이전 여부
