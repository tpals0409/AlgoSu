# CI rebuild_all 운영 런북

> **대상**: AlgoSu GitHub Actions CI 파이프라인 (`ci.yml`)  
> **기능**: `workflow_dispatch.inputs.rebuild_all=true` — 전 서비스 강제 재빌드  
> **최초 작성**: 2026-04-21 (Sprint 105 — 교훈 1 대응)

---

## 1. 용도

`ci.yml`의 `detect-changes` 잡은 path-filter로 변경된 서비스만 빌드·테스트한다.  
이 최적화는 CI 비용을 절감하지만, **CI 인프라 자체를 수정한 PR**에서는 역효과가 발생한다.

예) `.github/workflows/ci.yml`만 수정한 PR → `detect-changes` 가 서비스 변경을 감지하지 못함 → 전 서비스 잡 skip → composite action이 실제로 실행됐는지 검증 불가.

`rebuild_all=true`는 이 문제를 우회하여 **path-filter 결과를 무시하고 8개 서비스 전체를 강제 실행**한다(`ci.yml:131-139`).

---

## 2. 발동 조건 체크리스트

아래 조건 중 **하나라도 해당**하면 PR 머지 후 `rebuild_all` 실행을 계획해야 한다.

- [ ] `.github/workflows/*.yml` 단독 변경 — 워크플로 로직 수정이 실제 서비스 잡에 반영됐는지 검증
- [ ] `.github/actions/**` composite action 변경 — `setup-node-service` 등 공유 액션 수정 시 전 서비스 영향 확인
- [ ] `scripts/check-coverage.mjs` 등 **CI 공통 스크립트** 변경 — coverage-gate, path-filter 스크립트 수정 시 전 서비스 통과 확인

> **팁**: 위 세 경로 모두 PR `detect-changes` 단계에서 서비스 경로(`services/**`, `frontend/**` 등)로 인식되지 않으므로 path-filter로 충분하지 않다.

---

## 3. 실행 절차

### 3-1. GitHub Actions UI (권장)

1. 브라우저에서 리포지토리 → **Actions** 탭으로 이동
2. 왼쪽 워크플로 목록에서 **"CI — Test, Build & Push"** 선택
3. 우측 상단 **"Run workflow"** 드롭다운 클릭
4. Branch: `main` (PR 머지 완료 후 실행할 것)
5. **Force rebuild all services** 입력란에 `true` 입력
6. **"Run workflow"** 버튼 클릭
7. 실행된 워크플로 링크를 `#ci-infra` 채널 또는 ADR에 기록

> **경로 요약**: `github.com/{owner}/{repo}/actions/workflows/ci.yml`  
> → Run workflow → Branch: main → rebuild_all: true → Run

### 3-2. GitHub CLI (선택)

```bash
gh workflow run ci.yml \
  --ref main \
  -f rebuild_all=true
```

### 3-3. 타이밍

- **PR 머지 직후** 실행 (main의 HEAD가 목표 커밋인지 확인 후 실행)
- 연속 트리거 금지: 직전 `rebuild_all` 런이 완료되기 전 추가 실행 자제 (Runner 큐 과부하)

---

## 4. 결과 검증

### 4-1. 잡 성공 확인

1. Actions 탭 → 실행된 워크플로 클릭
2. **detect-changes** 잡의 `result` 스텝 출력에서 전 서비스가 `true`인지 확인:
   ```
   gateway=true
   identity=true
   submission=true
   problem=true
   github-worker=true
   ai-analysis=true
   frontend=true
   blog=true
   ```
3. 후속 잡 (`quality-nestjs`, `audit-npm`, `test-node`, `test-ai-analysis`, `build-*`) 모두 실행 및 통과 확인

### 4-2. Sensei 실측 데이터 수집

CI 성능 측정 목적(Sprint 103~105 비교)으로 실행하는 경우:

- 실행 완료 후 Sensei에 다음 정보 전달:
  - 워크플로 실행 ID (`gh run list --workflow=ci.yml --limit=1`)
  - 실행 브랜치/SHA
  - 목적 (`rebuild_all 4회 중 N번째`)
- Sensei 보고서 경로: `~/.claude/oracle/inbox/sensei-sprint-{N}-timing.md`

### 4-3. ADR 기록

`docs/adr/sprints/sprint-{N}.md`에 실행 날짜·목적·결과를 한 줄 이상 기록한다.

---

## 5. 금지 사례

| 상황 | 이유 |
|------|------|
| 서비스 코드 변경 PR (`services/**`, `frontend/**`)에서 `rebuild_all` 남용 | path-filter가 해당 서비스를 이미 감지함. 불필요한 전체 빌드로 GHA 시간·비용 낭비 |
| `rebuild_all`을 일상적 "CI 재시도" 수단으로 사용 | 단순 flaky 재시도는 Actions UI → Re-run failed jobs 사용 |
| PR이 아직 열려 있는 상태에서 `main` 브랜치 대상 실행 | PR 머지 전에는 preview 브랜치(PR SHA)가 기준. 머지 후 main HEAD 기준으로 실행할 것 |
| 실행 기록 미보존 | ADR 또는 채널에 런 링크를 반드시 남길 것. 추적 불가 시 Sensei 실측 데이터 오염 위험 |

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `.github/workflows/ci.yml:20-25` | `workflow_dispatch.inputs.rebuild_all` 입력 정의 |
| `.github/workflows/ci.yml:128-149` | `rebuild_all=true` 시 8개 서비스 output 강제 true 로직 |
| `.github/actions/setup-node-service/action.yml` | Node 서비스 공통 composite action |
| `scripts/check-coverage.mjs` | 글로벌 coverage-gate 스크립트 |
| `docs/adr/sprints/sprint-105.md` | 이 규약 도입 결정 근거 |

---

## 레퍼런스

- Sprint 104 교훈 1: `docs/adr/sprints/sprint-104.md` §주요 교훈
- 채널톡 CI 리팩토링: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
