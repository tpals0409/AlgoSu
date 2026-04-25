# ADR-027: aether-gitops 브랜치 규율 — 작업 브랜치 + PR 강제

- **상태**: 제안됨 (Proposed)
- **날짜**: 2026-04-25
- **스프린트**: Sprint 130 (Wave C-2)
- **의사결정자**: Oracle (심판관)
- **관련**: CLAUDE.md "에이전트 브랜치 규율 (Sprint 126 D 강화)", ADR-026 (인시던트 종합)

---

## 컨텍스트

### 현재 흐름
- **AlgoSu 레포**: Sprint 126 D부터 모든 변경에 작업 브랜치 + PR + Squash merge 필수 (Critic 또는 사용자 수동 리뷰 가드)
- **aether-gitops 레포 (운영 GitOps)**: main 직접 push 허용. CI auto-deploy 워크플로우(`gitops-update`)가 image tag bump를 main에 직접 commit
- 결과: aether-gitops 변경에 PR 검증 가드 부재

### 노출된 인시던트 (Sprint 130)
- **SealedSecret 컨트롤러 키 rotation 미동기화** (23일 전): 8개 SealedSecret을 재봉인하지 않은 상태로 누적. PR 검증이 있었다면 controller cert 변경 시점에 영향 분석되었을 가능성 높음
- **submission-service-secrets에 `INTERNAL_KEY_AI_ANALYSIS` 매니페스트 누락**: cluster에는 존재하나 매니페스트에 없음 → 누군가 cluster에 직접 patch한 후 매니페스트 갱신 누락. PR 검증 부재로 발견 못함
- **identity-service-secrets에 `GITHUB_TOKEN_ENCRYPTION_KEY` 누락** (commit `f5f391d`): gateway/github-worker는 추가했으나 identity 누락. 단일 reviewer 부재로 휴먼 에러 통과

### 제약
- **자동 deploy commit**: CI(`gitops-update` job)가 매 image tag 갱신 시 main에 직접 push. 작업 브랜치 + PR로 전환 시 워크플로우 재설계 필요 (auto-merge 또는 fast-forward)
- **GitOps 즉시 반영성**: PR 흐름 도입 시 머지까지 추가 ~1분 지연. 단 selfHeal=true이므로 운영 영향은 미미

---

## 결정

aether-gitops 레포에 다음 규율을 도입한다:

1. **branch protection rule** (main 직접 push 차단)
   - require pull request before merging
   - require linear history (squash 또는 rebase)
   - allow GitHub Actions bot bypass (auto-deploy용)

2. **자동 deploy 워크플로우 재설계**
   - CI가 image tag 갱신 시 작업 브랜치 (`auto-deploy/<sha>`) 생성 + PR 자동 생성 + auto-merge label 부착
   - 머지 권한이 있는 GitHub App 토큰으로 auto-merge 트리거 (Sprint 92 메모리 참조: Dependabot auto-merge App 토큰 패턴 재사용)

3. **수동 매니페스트 변경 흐름**
   - 작업 브랜치 (`fix/sprint-NNN-<scope>`) + PR + Squash merge
   - PR description에 변경 의도 + 검증 plan 명시
   - 사용자 수동 리뷰 + 머지 (Critic 미설치이므로)

---

## 결과

### 긍정적
- 모든 매니페스트 변경에 검토 가드 → SealedSecret/Secret 누락 같은 사고 차단
- PR description으로 변경 의도 추적 가능 → 인시던트 디버깅 용이 (`f5f391d` 같은 일부 누락이 PR review에서 발견되었을 것)
- 사고 발생 시 PR revert 1단계로 복구

### 부정적
- 자동 deploy 워크플로우 재설계 필요 (~중간 규모 작업)
- 머지 지연 ~1분 (auto-merge 포함). selfHeal=true로 운영 영향 미미
- GitHub App 토큰 추가 권한 필요 (PR 자동 생성/머지)

### 중립
- AlgoSu 레포 흐름과 일관성 확보 → 학습 곡선 낮음

---

## 구현 작업

- **Sprint 131 또는 후속**으로 별도 트랙 처리 (Sprint 130 마감 범위에서 제외)
- 단계:
  1. branch protection rule 추가
  2. CI auto-deploy 워크플로우 재설계 + PR/auto-merge 토큰 발급
  3. 검증: 1주일 운영 후 사고 패턴 변화 비교
- 담당: Architect + Postman

---

## 참조
- ADR-026 (Sprint 130 인시던트 종합)
- CLAUDE.md "에이전트 브랜치 규율 (Sprint 126 D 강화)"
- 메모리: `feedback_avoid_prod_direct_edit.md`
