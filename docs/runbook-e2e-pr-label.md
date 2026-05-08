# E2E Full Integration — PR 라벨 트리거 가이드

> 대상: `.github/workflows/ci.yml`의 `e2e-test` 잡 (전체 서비스 docker-compose 통합)
> 작성 배경: Sprint 134~140 누적 시드 — E2E 자동 PR CI 통합 (Sprint 141)

---

## 자동 실행 vs 명시 트리거

| 잡 | 트리거 | 실행 시간 |
|----|--------|----------|
| `e2e-programmers` | **모든 PR + push on main** (자동) | ~3분 |
| `e2e-test` (full integration) | **`run-e2e-full` 라벨 부착 PR** + workflow_dispatch | ~10분 |

`e2e-programmers`는 가벼운 sourcePlatform 전달 검증으로 PR마다 실행되지만, `e2e-test`는 docker-compose로 전 서비스 기동 + e2e-full.sh 실행이라 PR마다 자동 실행은 비용 부담. 따라서 큰 변경에 한정 명시 트리거 (opt-in).

## 사용법

### 1. PR에 라벨 부착

```bash
gh pr edit <PR번호> --add-label run-e2e-full
```

또는 GitHub web UI에서 PR Labels → `run-e2e-full` 선택.

### 2. CI 자동 트리거

라벨 부착 시점에 GitHub Actions가 자동으로 `e2e-test` 잡을 트리거. 결과는 PR Checks에서 확인.

### 3. 라벨 제거 후 재트리거

라벨 제거 → 다시 부착하면 새 commit 없이도 e2e-test 재실행. push 없이 인프라 변경 후 검증할 때 유용.

## 언제 부착해야 하는가

- **인프라 manifest 변경** (k3s yaml, docker-compose.dev.yml)
- **MQ 이벤트 계약 변경** (events 라우팅, 페이로드 schema)
- **DB 마이그레이션** (Expand-Contract 검증)
- **Saga orchestration 변경** (submission ↔ github-worker ↔ ai-analysis 흐름)
- **인증 미들웨어 변경** (X-Internal-Key, JWT 검증 흐름)

부착 안 해도 되는 경우:
- frontend 단독 변경
- docs/runbook 변경
- 단일 서비스 단위 테스트 변경

## 수동 워크플로우 트리거 (라벨 외 경로)

PR 라벨 외에도 main 브랜치에서 수동 트리거 가능:

```bash
gh workflow run ci.yml --ref main
```

또는 GitHub Actions web UI에서 "CI" 워크플로우 → "Run workflow".

## 향후 개선 시드

- 라벨 부착 시 자동 코멘트로 e2e-test 시작 알림
- e2e-test 실패 시 PR comment로 로그 링크 자동 작성
- 특정 path filter(예: `infra/k3s/**`)에서는 라벨 강제 또는 자동 부착
