---
sprint: 143
title: 이월 시드 일괄 정리 — 정확성 게이트 강화 + 인프라 컨텍스트 주입
status: completed
period: 2026-05-08 (단일 일자)
start_commit: 8d3e760
end_commit: f262d73
prs:
  - https://github.com/tpals0409/AlgoSu/pull/198 (PR 1 — 가중치 재조정)
  - https://github.com/tpals0409/AlgoSu/pull/199 (PR 2 — 토큰/컨텍스트 가드)
  - https://github.com/tpals0409/AlgoSu/pull/200 (PR 3 — submission entity 확장, Critic 3 라운드)
  - https://github.com/tpals0409/AlgoSu/pull/201 (PR 4 — Calendar provider fallback)
  - https://github.com/tpals0409/AlgoSu/pull/202 (PR 5 — E2E PR 자동 코멘트)
related_sprints:
  - sprint-141 (이월 시드 일괄 정리 — 7 PR 분할 패턴 원형)
  - sprint-142 (프롬프트 최적화 — Critic 5 라운드 + 점수↔자가검증 분리)
  - sprint-134~135 (saga payload + DB schema 변경 Critic 다중 라운드 패턴)
---

# Sprint 143 — 이월 시드 일괄 정리 (B안 + 시드 #4 Option A)

## 컨텍스트

Sprint 142(프롬프트 최적화)와 Sprint 141(인프라 부채 해소)에서 발생/잔존한 이월 시드 9건을 그룹별 PR 분할 전략으로 일괄 정리.

핵심 결정 포인트는 시드 #4 (ai-analysis worker가 problem 정보를 받지 못해 빈 컨텍스트로 LLM을 호출하는 인프라 결함). Sprint 142는 프롬프트 측에서만 가드를 댔고, 인프라 fix가 빠지면 가드는 무의미한 폴백만 발동 → **본 스프린트의 핵심 작업**.

### 머지 범위 (B안 — 사용자 승인)

| 시드 | 위치 | 우선순위 | 상태 |
|------|------|---------|------|
| #1 | ai-analysis correctness 가중치 30→40% | P2 | ✅ PR #198 |
| #2 | ai-analysis worker 컨텍스트 부재 가드 | P1 | ✅ PR #199 |
| #3 | ai-analysis claude_client 토큰 절단 가드 | P2 | ✅ PR #199 |
| #4 | submission entity + getProblemInfo (Option A) | **P0 (핵심)** | ✅ PR #200 |
| #6 | Calendar useLocale provider 방어 | P2 | ✅ PR #201 |
| #8 | E2E full integration PR 자동 코멘트 | P2 | ✅ PR #202 |

### Sprint 144 이월 (3건)

- 시드 #5: UAT — 프로그래머스 재제출 채점 통과 확인 (사용자 직접)
- 시드 #7: prometheus-rules / dashboard 자동 검증 CI (`promtool check rules` + grafana JSON cross-check)
- 시드 #9: UAT — 영문 환경 캘린더 + production Grafana CB dashboard 정합 (사용자 직접)

## 결정

### 시드 #4 — Option A vs B (사용자 결정: Option A 채택)

**Option A (근본 해결, 채택)**: Submission entity에 `problem_title`(VARCHAR 255) / `problem_description`(TEXT) nullable 컬럼 추가 + DB migration + submission.service의 create()에서 problem service 호출 → entity에 저장.
- 장점: 한 번 처리하면 영구 해결, 추가 HTTP 부하 없음 (생성 시 1회만)
- 단점: TypeORM migration + 다중 spec mock 갱신 필요 → Critic 다중 라운드 (Sprint 134~135 saga 패턴)

**Option B (즉각, 미채택)**: ai-analysis worker가 problem service `/internal/{id}` 직접 호출 + 캐싱
- 장점: migration 불필요
- 단점: 매 분석마다 HTTP 호출 + 캐싱 추가 필요, problem service 부하 증가

### PR 분할 전략 (Sprint 141 패턴 재활용)

5 PR 분할로 머지 부담 분산. 각 PR은 신규 브랜치 + Squash merge.

| PR | 브랜치 | 파일 수 | Critic |
|----|--------|--------|--------|
| #198 | `feat/sprint-143-weights` | 3 (+20 -18) | 미호출 |
| #199 | `feat/sprint-143-context-token-guard` | 4 (+206) | 미호출 |
| #200 | `feat/sprint-143-submission-problem-context` | 7 (+127 -1) | **3 라운드** |
| #201 | `feat/sprint-143-calendar-fallback` | 1 (+11 -1) | 미호출 |
| #202 | `feat/sprint-143-e2e-pr-comment` | 1 (+27) | 미호출 |

## 변경 핵심

### PR #198 — correctness 가중치 30% → 40% 강화 (시드 #1)

- `ALGORITHM_WEIGHTS`: correctness 30→40%, efficiency 25→20%, bestPractice 15→10%
- `SQL_WEIGHTS`: correctness 30→40%, efficiency 20→15%, bestPractice 20→15%
- 프롬프트 본문(SYSTEM_PROMPT/SQL_SYSTEM_PROMPT) + SSOT 상수 + 테스트 assertion 일괄 동기화
- `test_claude_client.py` totalScore=0 재계산 TC 3건 기대값 갱신 (68→70, 64→66, 62→65)

### PR #199 — 토큰 + 컨텍스트 가드 (시드 #2, #3)

- `claude_client.CODE_LENGTH_THRESHOLD = 50000` 상수 + `analyze_code()` 코드 길이 사전 검증
- `worker._on_message()` problem context 부재 시 optimizedCode 폴백
- Sprint 142 자가 검증 메타 패턴 재활용 — 이중 가드로 정답성 강화
- 토큰 가드 TC 3건 + 컨텍스트 가드 TC 3건 신규

### PR #200 — submission entity 확장 + getProblemInfo (시드 #4 Option A)

- `submission.entity.ts`: `problem_title` (VARCHAR 255 nullable), `problem_description` (TEXT nullable)
- `migrations/20260508000000-AddProblemContextColumns.ts`: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (Expand-Contract 호환)
- `ProblemServiceClient.getProblemInfo()` 신규 메서드 — 호스트 단일 CB 보호, `_dispatch`/`_fallback` 확장
- `submission.service.create()`에서 `Promise.all`로 `checkLateSubmission` + `getProblemInfo` 병렬 호출
- ai-analysis worker는 `/internal/{id}` 응답 entity에 자동 포함된 새 필드 사용 (worker 코드 변경 0건)

### PR #201 — Calendar useLocale provider 방어 (시드 #6)

- `useLocale()` 호출을 try-catch로 감싸 NextIntlClientProvider 외부(Storybook/테스트)에서 throw 시 ko fallback
- ESLint `react-hooks/rules-of-hooks` disable + 의도 명시 주석 (동일 트리 내 환경 의존이므로 hook 순서 불변)

### PR #202 — E2E full integration PR 자동 코멘트 (시드 #8)

- `e2e-test` job에 `actions/github-script` step 2개 추가
- 시작 시: "🧪 E2E Integration Test 진행 중" + 워크플로우 실행 링크
- 실패 시: "❌ E2E Integration Test 실패" + artifact 다운로드 안내
- `pull-requests: write` 권한 추가

## Critic 검증 (PR #200 — 3 라운드)

### Round 1 — P1 1건 + P2 1건 적발

- **P1**: 3개 spec(`saga-orchestrator.service.spec.ts`, `ai-satisfaction.spec.ts`, `submission.service.spec.ts`)의 `mockProblemServiceClient` 팩토리에 `getProblemInfo` 미정의 → `service.create()` 호출 테스트 모두 `TypeError`
- **P2**: `checkLateSubmission` + `getProblemInfo` 직렬 호출 → incident 시 5초 timeout 2배 (10초)

**해결**: 3개 spec mock에 `getProblemInfo: jest.fn().mockResolvedValue({title:'', description:''})` 추가 + `Promise.all` 병렬화. 동일 호스트 단일 CB가 OPEN되면 둘 다 즉시 fallback이므로 병렬화 안전.

### Round 2 — P2 1건 적발

- **P2**: `problemTitle: problemTitle || null` → SQL NULL → ai-analysis worker `submission.get()`이 None 반환 → prompt builder가 `f"설명: {problem_description}"`로 직렬화 → LLM에 **"설명: None" 문자열** 전달

**해결**: `?? ''`로 정규화 (빈 문자열 보존). entity는 nullable 유지(마이그레이션 호환), 신규 row는 모두 string 저장.

### Round 3 — 클린 통과 ✅

> "The changes appear consistent with the existing submission flow: the new columns are added via migration, populated on create with safe fallbacks, and the ProblemService client extension matches the current internal Problem Service contract. I did not identify a discrete regression or blocking issue in the diff relative to the base branch."

## 검증

- CI 전체 GREEN — Quality(submission/frontend/ai-analysis) + Test(전 서비스) + Coverage Gate + E2E Programmers Full Flow
- jest 회귀 0건 — submission 서비스 spec 갱신으로 모든 create() 테스트 통과
- pytest 회귀 0건 — ai-analysis 신규 TC 6건(토큰 3 + 컨텍스트 3) + 가중치 assertion 3건 갱신

## 신규 정책 / 패턴

### 1. 점수 분포 변경 시 의존 테스트 일괄 갱신 패턴

가중치 재조정(시드 #1) 시 `test_prompt.py`의 직접 가중치 assertion만 갱신하면 부족. `test_claude_client.py`의 `totalScore=0 재계산` TC도 가중치에 의존하므로 함께 갱신 필요. **Sprint 143 PR #198 후속 commit**으로 검출 → 이후 동일 패턴(SSOT 가중치 변경 시 모든 가중 평균 TC 사전 grep) 권장.

### 2. saga + DB schema 변경 시 mock 누락 패턴

ProblemServiceClient에 신규 메서드 추가 시, 3개 spec의 `mockProblemServiceClient` 팩토리에 모두 동일 mock 추가 필요. Sprint 141의 schema 변경 시 monitoring 4파일 일괄 갱신 패턴과 동일 — **클라이언트 메서드 추가 시 모든 mock 팩토리 grep 필수**.

### 3. 외부 호출 직렬화 latency 검토 의무

신규 외부 서비스 호출 추가 시, 동일 호스트로의 기존 호출이 있으면 직렬 await로 timeout 2배가 되는지 검토 필요. CB가 OPEN이면 둘 다 즉시 fallback이므로 `Promise.all` 병렬화가 안전. Critic R1 P2 패턴.

### 4. SQL NULL → 다른 언어 직렬화 회귀 패턴

TypeScript `null` → PostgreSQL NULL → Python `None` → f-string `"None"`. 언어 경계를 넘는 nullable 필드는 prompt/log 등 사용자 노출 경로에 도달 가능 → **빈 문자열 정규화 권장** (entity는 nullable 유지하여 migration 호환).

### 5. React Hooks try-catch 패턴 (provider 부재 방어)

`useLocale()`처럼 provider 부재 시 throw하는 hook은 ESLint `react-hooks/rules-of-hooks`와 충돌. 동일 컴포넌트 트리에서 환경 의존이므로 throw 여부가 매 렌더 동일 → hook 순서 불변. ESLint disable + 의도 명시 주석으로 해결.

## 사후 회고

### 잘 된 점

- **사용자 결정 우선 흐름**: 시드 #4 Option A/B 결정을 사용자에게 사전 위임 → Plan에서 명시적 결정 포인트 분리 → 실행 단계에서 망설임 없음
- **Critic 다중 라운드 효과 재확인**: PR #200에서 R1 (mock + latency), R2 (null 직렬화), R3 (클린) 3 라운드 — Sprint 142 5 라운드 패턴 동일
- **PR 분할 전략 재활용**: Sprint 141 7 PR 패턴을 5 PR로 축소 적용 — 사이즈 적절
- **브랜치 규율 ✅**: 9 스프린트 연속 준수 (Sprint 134 위반 이후) — 5 PR 모두 신규 브랜치 + Squash merge

### 개선 여지

- **PR #200 lint/typecheck 사전 점검 부재**: 3개 spec mock 누락은 로컬 Python 3.9 환경 한계로 사전 검증 불가했지만, TypeScript는 가능했음 → **신규 클라이언트 메서드 추가 시 자동 mock 검색 grep 의무화** (Sprint 144 시드)
- **사용자 직접 UAT 의존도**: 시드 #5(프로그래머스 재제출), #9(영문 캘린더+Grafana) 모두 사용자 직접 시각 검증 필요. 자동화는 Sprint 144+에서 검토.

## Sprint 144 이월 시드

### Sprint 143 신규 (이번 작업에서 발견)

- **신규 시드 (P3)**: TypeScript 클라이언트 메서드 추가 시 mock 팩토리 자동 검출 lint 또는 CI grep 추가
- **신규 시드 (P3)**: 점수 시스템 변경 시 의존 TC 자동 검출 (가중치 SSOT 단일화 + 재계산 TC 자동 정합)

### Sprint 142~141 잔여

- 시드 #5 (UAT): 프로그래머스 실제 재제출 → 채점 통과 확인 (사용자 직접)
- 시드 #7 (P2): prometheus-rules / dashboard 자동 검증 CI — `promtool check rules` + grafana JSON cross-check
- 시드 #9 (UAT): 영문 환경 캘린더 + production Grafana CB dashboard 정합 (사용자 직접)
