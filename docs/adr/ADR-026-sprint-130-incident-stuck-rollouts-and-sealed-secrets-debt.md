# ADR-026: Sprint 130 운영 인시던트 — 롤아웃 stuck 6일 방치 + SealedSecret 컨트롤러 키 mismatch 부채

- **상태**: 수용됨 (Accepted)
- **날짜**: 2026-04-25
- **스프린트**: Sprint 130 (Wave E-1)
- **의사결정자**: Oracle (심판관)
- **관련**: ADR-027 (aether-gitops 브랜치 규율), ADR-028 (개발 서버 분리)

---

## 컨텍스트

### 인시던트 타임라인

| 시점 | 사건 |
|---|---|
| **~2026-04-02** | sealed-secrets 컨트롤러 키 rotation (`sealed-secrets-keyqvbr5` 53d → `sealed-secrets-keycdlrs` 23d). **8개 SealedSecret 매니페스트 재봉인 누락** (identity, submission, problem, postgres, postgres-problem, rabbitmq, redis, monitoring). cluster Secret은 이미 unsealed로 유지되어 운영 영향 없음 |
| **2026-04-16** | Sprint 92 마감 ("AI 분석 핫픽스"). 메모리 `sprint-window.md` 갱신 마지막 시점 — 이후 9일간 윈도우 미갱신 |
| **2026-04-23 03:24 KST** | Sprint 121 PR #138 ("i18n 기반 구축") 머지. submission `services/submission/src/common/middleware/gateway-context.middleware.ts` 신규 도입. **`req.path` 사용으로 NestJS `forRoutes('*')` mount-strip 회귀 발생 → `/health` probe 401**. 신 ReplicaSet 무한 CrashLoop 시작 |
| **2026-04-24 16:44 KST** | Sprint 125 Wave C PR #144 (`27d3f95`) 머지. identity `services/identity/src/user/token-encryption.service.ts` 신규 도입 + `GITHUB_TOKEN_ENCRYPTION_KEY` 요구. 그러나 aether-gitops `f5f391d` commit에서 SealedSecret 매니페스트 재봉인 시 **identity-service-secrets에 키 추가 누락** (gateway/github-worker만 추가). identity 신 ReplicaSet 무한 CrashLoop 시작 |
| **~2026-04-23 ~ 2026-04-25** | 두 사고 모두 ArgoCD `Health=Degraded` 상태로 **알림 없이 방치** — submission 2일 5시간 (867회 재시작), identity 26시간 (314회 재시작) |
| **2026-04-25** | Oracle 진단 + Sprint 130 개시 → 4시간 내 회복 |

### 발견된 영향 범위
- **SealedSecret 컨트롤러 키 mismatch (8개)**: 매니페스트 변경 시 cluster 반영 차단. Sprint 130 Wave A-2에서 PR #2 머지 후 identity-service-secrets unseal 실패로 노출
- **submission-service-secrets `INTERNAL_KEY_AI_ANALYSIS` 매니페스트 누락**: cluster에는 존재 → 과거 누군가 cluster 직접 patch 후 매니페스트 갱신 누락 (정확한 시점 불명)
- **메모리 윈도우 미갱신 9일**: Sprint 92 → 130 사이 37개 ADR이 코드베이스에 작성되었으나 메모리 윈도우엔 미반영. /start 시점에 sprint number 오인 (Sprint 93 → 실제 130)

---

## 근본 원인

1. **AlertManager 룰/receiver 부재**
   - ArgoCD `Health=Degraded`, k8s pod CrashLoopBackOff가 운영자에게 통보되지 않음
   - 정확한 부재 항목: Sprint 130 Wave B-1에서 점검 (별도 PR)

2. **SealedSecret 컨트롤러 키 rotation 시 매니페스트 재봉인 절차 부재**
   - 23일 전 rotation이 자동/수동 어느 쪽으로 발생했는지 불명
   - 재봉인 누락 자체가 알림되지 않음 (sealed-secrets controller `Status=False`는 cluster 안에서만 가시)

3. **aether-gitops main 직접 push 흐름**
   - `f5f391d` ("add GITHUB_TOKEN_ENCRYPTION_KEY to gateway + github-worker SealedSecrets") 누락이 PR review 없이 머지됨
   - `INTERNAL_KEY_AI_ANALYSIS` 직접 patch 흔적도 PR 검증 부재

4. **메모리 윈도우 자동 갱신 부재**
   - `/start` skill이 sprint number를 sprint-window.md만 참조
   - `docs/adr/sprints/`와 cross-check 없음 → 잘못된 출발점 가능

---

## 결정

### 즉시 조치 (Sprint 130 내)
1. **submission /health 회귀 수정** — `req.path` → `req.originalUrl` (PR #157, 머지 완료)
2. **identity 키 누락 회복** — cluster patch (트랙 1, PR #2) + SealedSecret 8개 재봉인 (PR #3, 머지 완료) — GitOps 정합성 회복 동시 달성
3. **AlertManager 룰 보강** — Wave B-1 별도 PR (Architect 진행 중)
4. **메모리/스프린트 윈도우 정정** — Sprint 130으로 명명 통일, sprint-window.md 갱신

### 별도 ADR로 분리 (구조적 가드)
- **ADR-027**: aether-gitops 브랜치 규율 (작업 브랜치 + PR + auto-merge)
- **ADR-028**: 개발 서버(k3d/별도 dev cluster) 분리 — 운영 직접 수정 차단

### 향후 자동화 후보 (Sprint 131+)
- SealedSecret 컨트롤러 키 rotation 시 매니페스트 재봉인 자동 트리거 (CI job)
- `/start` skill이 `docs/adr/sprints/` 디렉토리 cross-check + sprint number 자동 추론
- `/stop` skill이 sprint-window.md 갱신을 강제 (현재 수동)

---

## 결과

### 긍정적
- Sprint 130 4시간 내 운영 회복 + GitOps 정합성 100% 회복
- 두 ADR로 재발 방지 가드 제안 → Sprint 131 구현 시 구조적 차단
- 인시던트 학습 자산 영구 기록

### 부정적
- ADR-027/028 구현은 Sprint 131로 이월 → 그 사이 동일 사고 가능성 잔존 (단 알림 가드 B-1로 인지 시간 단축)
- Sprint 명명 오류 (PR #157, #2, #3에 `sprint-93` 박힘) 사후 정정 곤란 — 본 ADR이 매핑 기록

### 중립
- 운영 트래픽은 두 사고 동안 구버전 pod이 처리 → 사용자 영향 미미. 그러나 신규 기능(i18n, OAuth 정규화) 미반영 = 기능적 stale

---

## 명명 오류 매핑

본 인시던트 처리 시 메모리 윈도우 미갱신으로 인해 PR/브랜치/commit message에 `sprint-93`이 박혔다. 실제는 **Sprint 130**.

| 산출물 | 명명 | 실제 Sprint |
|---|---|---|
| AlgoSu PR #157 | `fix(submission): /health probe 401 회귀 수정 — req.originalUrl 사용 (Sprint 93 A-1)` | Sprint 130 A-1 |
| aether-gitops PR #2 | `fix(secret): identity-service-secrets에 GITHUB_TOKEN_ENCRYPTION_KEY 추가 (Sprint 93 A-2)` | Sprint 130 A-2 |
| aether-gitops PR #3 | `fix(secret): SealedSecret 8개 일괄 재봉인 (Sprint 93 B-2)` | Sprint 130 B-2 |
| 작업 브랜치 | `fix/sprint-93-*` | Sprint 130 |

본 PR 이후 작업(B-1, 후속 PR)부터 `sprint-130` 명명 채택.

---

## 참조
- PR #157 (AlgoSu) — Wave A-1
- PR #2, #3 (aether-gitops) — Wave A-2, B-2
- ADR-027 (aether-gitops 브랜치 규율)
- ADR-028 (개발 서버 분리)
- Sprint ADR: `docs/adr/sprints/sprint-130.md`
- 메모리: `feedback_critic_unavailable.md`, `feedback_avoid_prod_direct_edit.md`, `MEMORY.md`
