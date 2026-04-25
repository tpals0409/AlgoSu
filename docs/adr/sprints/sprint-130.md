---
sprint: 130
title: "운영 인시던트 회복 (submission/identity 롤아웃 stuck) + 모니터링 강화 + SealedSecret 부채 해소 + 이월 정리"
date: "2026-04-25"
status: completed
agents: [Oracle, Architect]
related_adrs: ["ADR-026", "ADR-027", "ADR-028"]
naming_correction: "PR/브랜치/commit message에 'sprint-93'이 박혔으나 실제는 Sprint 130. 메모리 윈도우 9일 미갱신으로 인한 명명 오류 — ADR-026 명명 오류 매핑 표 참조"
---

# Sprint 130: 운영 인시던트 회복 + 부채 해소

## Decisions

### D1: submission `/health` 401 회귀 fix (Wave A-1)
- **Context**: Sprint 121 PR #138 ("i18n 기반 구축")에서 신규 도입된 `services/submission/src/common/middleware/gateway-context.middleware.ts`가 `req.path` 사용. NestJS `forRoutes('*')` mount-strip으로 `/health` 요청 시 middleware 내부에서 `/`로 인식되어 X-Internal-Key 인증 강제 → probe 401 → liveness probe 실패 → 867회 재시작 (2일 5시간)
- **Choice**: `req.path` → `(req.originalUrl ?? req.url).split('?')[0]` 변경 + 단위 테스트 7개 추가 (mount-strip 회귀 시뮬레이션)
- **Alternatives**: `forRoutes` 패턴 변경 → 변경 범위 확대, 회귀 risk 큼 / probe path를 미들웨어 우회 경로로 변경 → ad-hoc, 다른 미들웨어에 동일 패턴 잠재
- **Code Paths**: `services/submission/src/common/middleware/gateway-context.middleware.ts:64`, spec.ts (15→22 tests)
- **PR**: [#157](https://github.com/tpals0409/AlgoSu/pull/157) (`8800cfc`)

### D2: identity `GITHUB_TOKEN_ENCRYPTION_KEY` 누락 회복 (Wave A-2)
- **Context**: aether-gitops `f5f391d` commit에서 SealedSecret에 신규 키 추가 시 gateway/github-worker만 갱신, **identity-service-secrets 누락**. Sprint 125 Wave C 코드(`token-encryption.service.ts`)가 키를 요구하나 cluster Secret 미반영 → 신 ReplicaSet CrashLoopBackOff 308회 (26시간)
- **Choice (트랙 1, 임시)**: gateway/github-worker가 사용 중인 동일 키를 cluster Secret에 직접 `kubectl patch` + rollout restart → 즉시 운영 회복. **사용자 영향 0** (재인증 불필요, DB 토큰 4건 보존)
- **Choice (트랙 2, 정식)**: SealedSecret 매니페스트 PR (#2)로 키 추가 → 그러나 컨트롤러 키 mismatch 부채로 unseal 실패 → Wave B-2(PR #3)에 흡수되어 GitOps 정합성 회복
- **Alternatives**: 새 키 발급 → DB GitHub 토큰 4건 무효화, 사용자 재인증 강제 (선택 안 함)
- **PR**: [aether-gitops #2](https://github.com/tpals0409/aether-gitops/pull/2) (트랙 2 초안), 트랙 1은 `kubectl patch` 임시 → ADR-028(개발 서버 분리)에서 구조적 차단 결정

### D3: SealedSecret 8개 일괄 재봉인 — 컨트롤러 키 mismatch 부채 해소 (Wave B-2)
- **Context**: ~2026-04-02 sealed-secrets 컨트롤러 키 rotation (`sealed-secrets-keyqvbr5` 53d → `sealed-secrets-keycdlrs` 23d) 후 8개 SealedSecret 매니페스트 재봉인 미수행. cluster의 unsealed Secret은 rotation 이전 상태로 유지되어 운영 영향 없으나 **매니페스트 변경 시 cluster 반영 차단** — Wave A-2 PR #2에서 노출됨
- **Choice**: cluster의 평문 키를 메모리에서 직접 추출 → `kubeseal --raw`로 현재 active controller cert로 재봉인 → 8개 매니페스트의 `encryptedData:` 블록 일괄 교체. `apiVersion`/`kind`/`metadata`/`template:` 보존
- **Alternatives**: 컨트롤러 옛 키 복원 → 인프라 복잡성 증가 / cluster Secret 직접 patch만 유지 → GitOps 정합성 영구 깨짐 (선택 안 함)
- **부수 효과**: submission-service-secrets에 `INTERNAL_KEY_AI_ANALYSIS` 키 매니페스트 누락 발견 (cluster에는 존재) → 매니페스트로 흡수 = **추가 GitOps 정합성 회복 동시 달성**
- **검증**: 머지 후 `kubectl get sealedsecret -n algosu`의 8개 모두 `Synced=True` 도달, cluster Secret data sha256 hash 머지 전후 동일 (평문 값 불변), 운영 pod 재시작 0건
- **PR**: [aether-gitops #3](https://github.com/tpals0409/aether-gitops/pull/3) (`f458d55`)

### D4: AlertManager 룰 보강 + receiver 활성화 — 사고 재발 차단 (Wave B-1)
- **Context**: Sprint 130 두 사고 모두 ArgoCD `Health=Degraded` 상태였으나 알림 없이 26h~2일 5시간 방치
- **충격적 발견 (Architect)**: **alertmanager `receiver: 'null'`** — 13개 기존 룰(PodRestartFrequent, ServiceDown, OOMKilled 등)이 정상 firing 중이었으나 **모든 알림이 silent drop**. Sprint 130 무알림의 진짜 root cause는 룰 부재가 아닌 **배출구(receiver) 자체 비활성**
- **Choice**:
  1. AlertManager receiver를 `null` → `discord-default`(warning, 1h repeat) + `discord-critical`(critical, 30m repeat, @here)으로 활성화
  2. PrometheusRule 매니페스트에 6개 룰 신규 추가: `KubePodCrashLooping`, `KubeDeploymentReplicasMismatch`, `KubeDeploymentRolloutStuck`, `ArgoCDAppDegraded`, `ArgoCDAppOutOfSync`, `ArgoCDAppSyncFailed`
  3. alertmanager v0.28.1 업그레이드, 기존 `identity-discord-secret` webhook 재사용 (신규 SealedSecret 불필요)
- **검증**: promtool/amtool/kustomize 모두 SUCCESS. PR 머지 즉시 Sprint 130 잔존 firing(`PodRestartFrequent` 2건)이 Discord 채널에 도달 → receiver 활성화 검증 동시 달성
- **PR**: [aether-gitops #4](https://github.com/tpals0409/aether-gitops/pull/4) (Sprint 130 명명 채택 시작 PR)

### D5: 메모리/스프린트 윈도우 정정 (Wave D-3)
- **Context**: Sprint 92 종료 후 9일간 `sprint-window.md` 미갱신. `/start` 시점에 sprint number 오인 (Sprint 93 → 실제 130)
- **Choice**: sprint-window.md를 [1]=Sprint 129 / [2]=Sprint 130으로 정정. MEMORY.md 표에 Sprint 93~129 묶음 아카이브 행 추가. PR/브랜치/commit의 `sprint-93` 명명은 사후 정정 곤란하므로 ADR-026 명명 오류 매핑 표로 영구 기록
- **Alternatives**: 모든 PR/commit message 강제 정정 (rebase) → 머지된 history 변경 위험, ADR 매핑으로 충분

### D6: 구조적 가드 ADR 제안 (Wave C-2 + 개발 서버 분리)
- **Choice**: 두 ADR을 proposed 상태로 작성. Sprint 131에서 구현 결정 + 채택
  - **ADR-027**: aether-gitops 브랜치 규율 (작업 브랜치 + PR + auto-merge로 main 직접 push 차단)
  - **ADR-028**: 개발 서버(k3d/별도 dev cluster) 분리 (운영 직접 수정 안티패턴 구조적 차단)

### D7: 인시던트 종합 ADR (Wave E-1)
- **Choice**: ADR-026 작성 — 타임라인, 근본 원인 4가지, 학습, 명명 오류 매핑 영구 기록

---

## Patterns

### P1: NestJS `forRoutes('*')` middleware의 `req.path` 회피 — `req.originalUrl` 사용
- **Where**: `services/submission/src/common/middleware/gateway-context.middleware.ts:64`
- **When to Reuse**: NestJS `consumer.apply(...).forRoutes('*')` 또는 와일드카드 라우트에서 `req.path`로 path 매칭 시. mount-strip으로 `/`로 인식되는 회귀 발생 가능 — `req.originalUrl ?? req.url`로 strip되지 않은 path 사용
- **검증 패턴**: 단위 테스트 mock에 `originalUrl`/`url` 함께 주입 (production 시뮬레이션). `path`만 setter는 회귀 검출 못함

### P2: SealedSecret 일괄 재봉인 (컨트롤러 키 rotation 후)
- **Where**: `aether-gitops/algosu/base/sealed-secrets/`
- **When to Reuse**: sealed-secrets 컨트롤러 키 rotation 시 또는 unseal 실패 SealedSecret 발견 시
- **Steps**:
  1. cluster의 평문 키를 메모리(셸 변수)로만 추출: `kubectl get secret -n <ns> <name> -o json | jq -r '.data | to_entries[] | "\(.key)=\(.value | @base64d)"'`
  2. 각 키-값을 `echo -n "$VAL" | kubeseal --raw --namespace <ns> --name <secret>` 로 봉인
  3. 매니페스트 `encryptedData:` 블록만 교체 (apiVersion/kind/metadata/template 보존)
  4. `kubeseal --validate`로 dry-run unseal 확인
  5. 평문 값 디스크/로그/PR/commit message 노출 금지, 작업 후 history clear

### P3: cluster Secret data hash 비교로 평문 값 불변 검증
- **Where**: SealedSecret 재봉인 PR 머지 검증 단계
- **Steps**:
  - 머지 전: `kubectl get secret -n <ns> <name> -o json | jq -S '.data' | sha256sum`로 baseline 캡처
  - 머지 후 ArgoCD sync 완료 대기
  - 다시 hash 계산 → diff 비교
  - 동일하면 평문 값 불변 → cluster 영향 없음 확정

### P4: 운영 핫픽스 트랙 1 + 트랙 2 패턴
- **When to Reuse**: GitOps 흐름이 막힌 상태에서 운영 회복 시급한 경우
- **트랙 1 (즉시 회복)**: cluster 직접 patch — 단 ADR로 별도 기록 + 메모리 `feedback_avoid_prod_direct_edit.md` 정합 유지
- **트랙 2 (사후 정합성 회복)**: GitOps PR로 cluster 자국을 매니페스트로 흡수 — 트랙 1과 같은 Sprint 안에서 처리

---

## Gotchas

### G1: 메모리 윈도우 미갱신 → `/start` 시 잘못된 sprint number
- **Symptom**: PR/브랜치/commit message에 잘못된 sprint number 박힘 (예: Sprint 93 → 실제 130)
- **Root Cause**: `/start` skill이 `sprint-window.md` 단일 출처에 의존, `docs/adr/sprints/` cross-check 없음
- **Fix**: 본 Sprint에서는 ADR-026 명명 오류 매핑으로 사후 영구 기록. 자동화는 Sprint 131+ 후보

### G2: SealedSecret 컨트롤러 키 rotation 후 매니페스트 재봉인 절차 부재
- **Symptom**: SealedSecret이 `Status=False (no key could decrypt secret)` 상태. cluster Secret은 rotation 이전 상태로 유지되어 운영 무영향 → **알림 없음** → 매니페스트 변경 시 cluster 반영 차단으로 노출
- **Root Cause**: rotation 자동/수동 어느 쪽이든 매니페스트 재봉인 동기화 절차 부재
- **Fix**: 본 Sprint Wave B-2로 일괄 재봉인. 자동화(CI job)는 Sprint 131+ 후보

### G3: NestJS `forRoutes('*')` 단위 테스트가 mount-strip 회귀를 못 잡음
- **Symptom**: spec.ts의 `req.path` mock 직접 주입으로 production 회귀 미검출
- **Root Cause**: Express middleware mount 동작이 단위 테스트 환경에서 시뮬레이션되지 않음
- **Fix**: `originalUrl`/`url` mock 함께 주입 (production 시뮬레이션). e2e 통합 테스트 추가는 후속 P3

### G4: aether-gitops main 직접 push로 누락 commit이 PR review 우회
- **Symptom**: `f5f391d` commit에서 identity-service-secrets 키 추가 누락. 단일 reviewer 흐름이 휴먼 에러 통과
- **Fix**: ADR-027 (브랜치 규율 도입) 채택 시점에 구조적 차단

### G5: 운영 cluster `kubectl` 직접 변경 환경
- **Symptom**: Sprint 130 트랙 1에서 cluster Secret 직접 patch. GitOps 정합성 일시 깨짐 + 변경 추적 곤란
- **Fix**: ADR-028 (개발 서버 분리 + 운영 read-only) 채택 시점에 구조적 차단

### G6: alertmanager `receiver: 'null'`로 모든 알림 silent drop
- **Symptom**: 13개 PrometheusRule이 정상 firing 중이었으나 운영자에게 통보 없음. ArgoCD `Health=Degraded`도 무알림. Sprint 130 두 사고 6일/26시간 방치 + sealed-secrets 컨트롤러 키 mismatch 23일 방치의 직접 원인
- **Root Cause**: alertmanager.yaml의 receiver가 `null`로 설정 → 모든 라우팅이 폐기 destination으로 매핑. 룰 점검만 했다면 못 찾았을 함정 (룰 inventory는 정상이었기 때문)
- **Fix**: Wave B-1 (PR aether-gitops #4)에서 `discord-default` + `discord-critical`로 활성화. **점검 시 룰뿐 아니라 receiver 동작까지 end-to-end 검증 필수** (amtool/실제 Discord 도달 테스트)
- **재발 방지**: Sprint 131에서 alertmanager receiver 동작을 모니터링하는 self-test 룰 추가 검토 (예: 5분마다 dummy 알림 발사 → Discord 도달 못 하면 high alert)

---

## Metrics
- Commits (AlgoSu): 1건 (PR #157)
- Commits (aether-gitops): 2건 (PR #2, #3)
- 매니페스트 변경: SealedSecret 8개 + identity 추가 키 1개 + submission INTERNAL_KEY_AI_ANALYSIS 흡수 1개
- 코드 변경: middleware 1줄 + 테스트 7개 추가
- 새 ADR: 3건 (ADR-026, ADR-027, ADR-028)
- 새 메모리: 2건 (`feedback_critic_unavailable.md`, `feedback_avoid_prod_direct_edit.md`)
- 회복 시간: 운영 stuck 26시간/2일 5시간 → Sprint 130 인지 후 **약 4시간 내 완전 회복**
- 사용자 영향: **0명** (구버전 트래픽 처리, 재인증 불필요)
- ArgoCD: Degraded → **Healthy**

## 이월 (Sprint 131)
- ADR-027 / ADR-028 구현 (브랜치 규율 + 개발 서버 분리)
- C-1 미사용 ReplicaSet 정리 + revisionHistoryLimit
- D-1 E2E Integration Test 실패 조사
- D-2 CB + classic queue 무한 requeue 방지 (Sprint 92 G1 이월)
- SealedSecret 컨트롤러 키 rotation 자동 재봉인 CI job
- `/start` skill에 `docs/adr/sprints/` cross-check 추가
