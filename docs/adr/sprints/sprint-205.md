---
sprint: 205
title: "Phase 3 외부 작업 재확인 + 이월 2건 처리 (commitlint oracle scope + Build Blog SSG required check)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-156", "sprint-191", "sprint-202", "sprint-204"]
related_memory: ["sprint-window"]
topics: ["security", "operations", "cleanup", "ci"]
tldr: "Sprint 204 Phase 3 외부 작업(Discord BOT_TOKEN revoke + 다른 머신 dormant 파일 정리) 재확인. (a) BOT_TOKEN revoke는 운영 결정 미정으로 보류 — 운영 결정 명시 시점에 종결 조건 명문화. (b) 다른 머신 정리는 미완료 — 사용자 직접 점검 후 보고 필요. Sprint 202·203·204 3회 누적 이월인 commitlint oracle scope 추가(6e6760c)와 Sprint 201 회귀 재발 방지를 위한 Build Blog (SSG) required check 승격(gh api) 동시 처리. 무한 이월 방지 명문화 패턴 신설."
---
# Sprint 205 — Phase 3 외부 작업 재확인 + 이월 2건 처리 (commitlint oracle scope + Build Blog SSG required check)

## 목표

- Sprint 204 Phase 3 외부 작업(Discord BOT_TOKEN revoke + 다른 머신/체크아웃 dormant 파일 정리)의 완료 여부를 재확인하고, 미완료·보류 결과를 영속화.
- 무한 이월 방지 조건 명문화로 Phase 3 재확인이 Sprint 206+에서 반복되는 구조적 패턴 제거.
- Sprint 202·203·204 3회 누적 이월인 `commitlint` oracle scope 추가 + Sprint 201 회귀 재발 방지를 위한 Build Blog (SSG) required check 승격을 동시 처리.

## 배경

Sprint 156(RUNBOOK 명문화) → Sprint 191(deprecated 삭제) → Sprint 202(dormant 일부 삭제 + 재분류) → Sprint 204(dormant 완전 삭제 + repo-side BOT_TOKEN 평문 처분)의 4-스프린트 점진 정리 파이프라인이 Sprint 204에서 종결되었다. 그러나 외부 시스템 트랙(Discord 토큰 revoke + 다른 머신/CI 체크아웃 dormant 파일 정리)은 repo PR/머지와 비동기로 진행되는 사용자 직접 작업이라, Sprint 204 ADR §이월에 Sprint 205 재확인이 명시되었다.

동시에 Sprint 202에서 `chore(oracle):` 커밋 시도가 commitlint `scope-enum` 미등록으로 차단된 경험이 Sprint 203·204를 거치며 누적 이월 중이었고, Sprint 201에서 Build Blog (SSG) 잡이 required check가 아니라 실패해도 머지가 통과된 회귀가 발생한 바 있어, 두 항목을 본 sprint에서 동시 처리했다.

## 결정

### D0. Phase 3 (a) — BOT_TOKEN revoke 보류

사용자 응답: **보류** — Discord 통합 운영 방향 미확정(재활성화 검토 vs 완전 폐기 결정 보류).

- repo·로컬 파일 측 평문 토큰 보유 경로는 Sprint 204에서 종결됨(`.claude-tools/discord-send.sh` 삭제 + `.gitignore` 차단).
- 외부 토큰(Discord Developer Portal)은 revoke 미완료 — 현재 토큰이 여전히 유효할 수 있음.
- 시크릿 노출 잔존 위험: Discord API 접근 권한 잔존 (토큰 자체 유효 여부 불명). 그러나 live caller 0건(Sprint 202 검증 + Sprint 204 재검증)이라 즉시 악용 경로는 없음.
- **무한 이월 방지 조건**: 운영 방향이 명시되면 (A) 재활성화 → Secret-store 재설계 sprint 개설, (B) 완전 폐기 → Discord Developer Portal BOT_TOKEN Reset/애플리케이션 삭제 1회 처리. 미정 지속 시 sprint-window/메모리에만 추적, ADR 추가 commit 회피 (Sprint 204 placeholder 회귀 차단 결정 패턴 재사용).

### D1. Phase 3 (b) — 다른 머신/CI 체크아웃 정리 미완료

사용자 응답: **미완료** — 다른 머신 미확인. 본 머신(이 작업이 실행된 워크스테이션)은 `ls .claude-tools/` empty 검증됨.

- 정리 대상 명령: `rm .claude-tools/{discord-send.sh,oracle-system-prompt.md,discord-inbox.md}` (Sprint 202·204 패턴 그대로).
- `.claude-tools/`는 `.gitignore` 등록이라 git으로 전파되지 않음 — 다른 워크스테이션·CI 체크아웃은 각자 수동 실행 필요.
- **무한 이월 방지 조건**: D0 BOT_TOKEN revoke와 동일 트랙. 다른 머신 보유 여부 불명 시 sprint-window/메모리 추적만, ADR 추가 commit 없음. 사용자가 직접 점검 후 완료 보고 시 sprint-window에 기록.

### D2. Phase C — commitlint oracle scope 추가 (커밋 6e6760c)

`commitlint.config.mjs`의 `staticScopes` 배열에 `'oracle'` 삽입 (알파벳 정렬 — `'infra'`와 `'runbook'` 사이). Architect 위임.

- Sprint 202에서 `chore(oracle):` 커밋 시도가 "oracle is not allowed" lint 에러로 차단된 경험.
- Sprint 203·204에서도 동일 패턴 반복 이월 — 3회 누적으로 본 sprint 우선 처리.
- 검증: `echo 'chore(oracle): test' | npx commitlint` exit 0.

### D3. Phase D — Build Blog (SSG) required check 승격 (Oracle 직접 gh api)

GitHub branch protection `required_status_checks.contexts`에 `"Build Blog (SSG)"` 추가.

- Sprint 201에서 `check-adr-links.mjs`가 삭제된 `search-index.json` 존재 검증(exit 2)을 포함하고 있었으나, Build Blog (SSG) 잡이 required check가 아니라 실패해도 머지가 통과됨. 이 회귀가 main에 반영된 후 PR #356 교정 sprint이 필요했음.
- 변경 전 contexts (3개): `["Secret & Env Scan", "Detect Changed Services", "Coverage Gate"]`
- 변경 후 contexts (4개): `["Secret & Env Scan", "Detect Changed Services", "Coverage Gate", "Build Blog (SSG)"]`
- `strict: true` (변경 없음)
- API 명령: `gh api -X POST repos/tpals0409/AlgoSu/branches/main/protection/required_status_checks/contexts -f 'contexts[]=Build Blog (SSG)'`
- 검증 명령: `gh api repos/tpals0409/AlgoSu/branches/main/protection --jq '.required_status_checks.contexts'`

> git 변경 없음 — GitHub 설정 변경이라 commit 대상 아님. ADR에 변경 전/후 상태 + API 명령 + 검증 명령 영속화로 감사 추적성 확보.

## 구현

### Phase A·B — Phase 3 결과 영속화

본 ADR(KR) + EN 페어 신설으로 Phase 3 (a) 보류 + (b) 미완료 결과 영속화. RUNBOOK `docs/runbook/claude-tools.md` §5 이력 + §Discord 관련 정책 갱신.

### Phase C — commitlint.config.mjs 수정 (커밋 6e6760c)

```diff
- 'e2e', 'frontend', 'infra', 'runbook', 'security',
+ 'e2e', 'frontend', 'infra', 'oracle', 'runbook', 'security',
```

Architect 위임, 커밋 `6e6760c chore(ci): commitlint scope-enum에 oracle 추가 — Sprint 202·203·204 누적 이월 해소`.

### Phase D — GitHub branch protection 설정 변경 (Oracle 직접)

```bash
gh api -X POST repos/tpals0409/AlgoSu/branches/main/protection/required_status_checks/contexts \
  -f 'contexts[]=Build Blog (SSG)'
```

git 변경 없음. GitHub API 응답에서 4개 contexts 포함 확인.

### Phase E — ADR sprint-205 KR+EN + README index 갱신 (Scribe)

본 ADR(KR) + EN 페어 + `docs/adr/README.md` 카운트 **142→143** / sprint range **62~204→62~205** + `docs/runbook/claude-tools.md` §5·§Discord 정책 갱신.

## 검증

- `scripts/check-adr-index-count.mjs --strict` — 영구 8 / 토픽 1 / sprint **143** 일치.
- `scripts/check-adr-en-coverage.mjs --lint` — **152/152** (100%).
- `scripts/check-doc-refs.mjs` — 0 broken.
- `scripts/check-i18n-residue.mjs --strict` — prose Hangul 임계 8% 이하.
- `echo 'chore(oracle): test' | npx commitlint` — exit 0 (Phase C 검증).
- `gh api repos/tpals0409/AlgoSu/branches/main/protection --jq '.required_status_checks.contexts'` — `["Secret & Env Scan","Detect Changed Services","Coverage Gate","Build Blog (SSG)"]` 4개 포함 (Phase D 검증).
- CI green.

**Critic(Codex)**: 본 sprint 변경은 docs-only(ADR KR+EN + RUNBOOK + README) + commitlint.config.mjs 1줄 패치 + GitHub API 호출(git 변경 없음). 코드 변경 에이전트(Architect) 위임 커밋이 존재하므로 auto-critic 트리거 예정. Critic 라운드 결과는 본 commit 시점까지 영속화. R{N+1}+ 결과는 sprint-window/메모리에만 기록(placeholder 회귀 차단 결정, Sprint 204 패턴 재사용).

## 신규 패턴

### 1. 무한 이월 방지 명문화 패턴

외부 시스템 트랙 분리 시 N+1 sprint 재확인이 또 미완료/보류이면 다음 원칙으로 무한 ADR commit 회귀를 종결:

| 상황 | 조치 |
|------|------|
| 운영 결정 명시됨 | 해당 sprint에서 종결 commit (재활성화 → 새 sprint / 폐기 → 1회 처리) |
| 미정 지속 (결정 보류) | sprint-window/메모리에만 추적. ADR 추가 commit 회피 |
| 사용자 직접 작업 완료 보고 | sprint-window에 기록. ADR §이월에서 해당 항목 제거 |

Sprint 204의 placeholder 회귀 차단 결정("Critic 영역은 R{N}까지 영속화, R{N+1}+ 결과는 sprint-window/메모리에만 기록")과 동일 원리를 외부 시스템 트랙 이월에 확장 적용.

### 2. 운영 설정 변경의 ADR 영속화 패턴

GitHub branch protection / GitHub repo 설정 / Secret 변경 등 git 변경 없는 외부 시스템 조작은 다음을 ADR에 영속화:

- 변경 전/후 상태 (contexts 배열, 설정값 등)
- 실행 API 명령 (재현 가능한 형태)
- 검증 명령 (다음 sprint에서 즉시 감사 가능)

git blame / PR 이력으로 추적 불가능한 설정 변경이라도 ADR 기록으로 감사 추적성 확보.

## 교훈

1. **외부 시스템 트랙 분리의 운영 부담** — repo PR 머지는 즉시 완결되나 외부 작업(Discord 토큰 revoke + 다른 머신 정리)은 사용자 직접 작업이라 비동기. Sprint 204에서 ADR §이월에 Sprint 205 재확인을 명시했어도, 사용자 응답이 '보류/미완료'면 N+2, N+3 이월 가능성 존재. 본 sprint에서 '운영 결정 명시 후 종결' 조건 명문화로 종결 트리거를 명확화했다.
2. **소규모 이월 항목 동시 처리 효율** — commitlint oracle scope(3 sprint 누적 이월, 1줄 패치)와 Build Blog (SSG) required check(1 sprint 이월, API 1회 호출)는 각각 매우 작은 변경이다. 운영 후속 sprint에 묶어 처리하면 별도 sprint 비용 없이 해소 가능.
3. **branch protection 변경은 git commit 비포함** — gh api 호출은 GitHub 설정 변경이라 git diff 0. ADR §Phase D에 변경 전/후 contexts 배열 + API 명령 + 검증 명령 영속화로 감사 추적성 확보. 향후 branch protection 변경 시 ADR 기록 패턴으로 재사용.

## 이월

- **Phase 3 외부 작업 (Sprint 206 재확인 필요)**:
  - **(a) Discord BOT_TOKEN revoke** — 운영 결정 시점에 처리 (Discord 통합 운영 방향 확정 후). 운영 방향 결정 전까지는 sprint-window/메모리 추적, ADR 추가 commit 없음.
  - **(b) 다른 워크스테이션/CI 체크아웃 dormant 파일 정리** — 사용자 직접 점검 후 보고. 대상 명령: `rm .claude-tools/{discord-send.sh,oracle-system-prompt.md,discord-inbox.md}`. 완료 시 sprint-window에 기록.
- **(운영) Sprint 196 마이그레이션 실행 + 재배포** (사용자/운영 담당).
- (선택) CI PYTHON 3.12 → 3.13 상향.
- (시드) 하네스 정기점검 체크리스트 자동화 스크립트 (Sprint 202 신규 패턴).
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
