---
sprint: 128
title: "Sprint 127 후속 — admin/feedbacks SWR 동시성 + Oracle SSOT 통합 + AnalyticsCharts 타입 좁히기"
period: "2026-04-25"
status: completed
start_commit: 2bd3dfe
end_commit: d4c27a1
prs:
  - "(통합 PR 예정) Sprint 128 Wave A+B-1+C: admin/feedbacks 동시성 + .claude-team.json flag + DifficultyDisplay 타입 좁히기"
---

# Sprint 128 — Sprint 127 후속 + Oracle SSOT 통합 마감

## 배경

Sprint 127 종료 시점 시드 4건(admin/feedbacks 동시성 P2 2건, Oracle Wave F flag 미연결,
AnalyticsCharts 타입 좁히기)을 단일 세션 내 마감. 모두 회귀 fix가 아닌 후속 보강이며
Critic 2차/3차 관찰로 이관된 항목.

PM 원칙: Sprint 127 Wave F PR #153 close 결정으로 남은 "정책 + 강제" SSOT 미통합 상태를
이번 스프린트에서 마감. `.claude-team.json` flag와 `oracle-reap.sh` 검증 로직을 env var로
연결하여 두 곳이 같은 진실을 가리키도록 함. flag만 추가했던 PR #153과 달리 강제력
(reap 로직)이 함께 동작.

### Sprint 128 처리 현황

| # | 항목 | Wave | 상태 |
|---|------|------|------|
| 1 | admin/feedbacks status 필터 일치성 (listUpdater 범위 밖 행 제거 + counts 갱신) | A-1 | ✅ |
| 2 | admin/feedbacks 동시 PATCH in-flight race (useRef 카운터 게이팅) | A-2 | ✅ |
| 3 | admin/feedbacks 회귀 테스트 5건 신규 (필터 일치성 3 + 동시 race 2) | A-3 | ✅ |
| 4 | `.claude-team.json` `dispatch.autoCritic.requireSessionId: true` 재도입 | B-1 | ✅ |
| 5 | `oracle-spawn.sh` env var 전달 + `oracle-reap.sh` flag 분기 | B-2 | ✅ (로컬 인프라) |
| 6 | `critic.md` 페르소나 문구 동기화 (`requireSessionId` flag 명시) | B-3 | ✅ (로컬 인프라) |
| 7 | `AnalyticsCharts.DifficultyRow.tier`: `string` → `DifficultyDisplay` | C-1/C-2 | ✅ |
| 8 | analytics 테스트 fixture UPPER_CASE 정합 + `UNCLASSIFIED` 케이스 | C-3 | ✅ |

---

## Wave A — admin/feedbacks SWR 동시성 잔여 P2 2건 (commit `ed5d831`)

담당: architect (구현), critic (예정 — 머지 직전 교차 리뷰)

### 배경 (Sprint 127 Critic 2차 관찰)

Sprint 127 Wave B에서 `revalidate: false` 패턴으로 단일 PATCH의 GET 선행 race를 차단했으나,
Critic 2차에서 두 가지 잔여 시나리오가 식별됨:

1. **필터 일치성 (P2)**: `statusFilter='OPEN'` 활성 상태에서 행을 RESOLVED로 변경 →
   optimistic 단계에서 행 잔존 → PATCH 완료 후 GET 재검증으로 갑자기 사라짐 (UX 부자연).
   counts 카드도 동기화 안 됨.
2. **동시 PATCH race (P2)**: `fb-1`/`fb-2` 두 행을 빠르게 변경 → PATCH2 응답이 PATCH1보다
   먼저 도착 → PATCH2 success가 트리거한 GET이 PATCH1 미완료 상태(서버에서 `fb-1`이 아직
   OPEN)를 캐시에 반영 → 캐시 불일치.

### A-1 — listUpdater 필터 일치성

`handleStatusChange` 내 `listUpdater`에 `statusFilter` 클로저 캡처. items.map 후 filter 단계
추가 (`statusFilter !== 'ALL' && fb.publicId === publicId && newStatus !== statusFilter` 인 행 제외).
이전 status를 `current.items.find(...)?.status`로 추출 후 counts -1/+1 optimistic 갱신
(카테고리 카운트 `cat:BUG` 등은 status 변경에 영향 없으므로 보존).

### A-2 — useRef in-flight 카운터

선택지 비교:

| 옵션 | 복잡도 | 채택 |
|------|--------|------|
| `useRef<number>(0)` 카운터 | 중 | ✅ |
| row-scoped SWR key (`/api/feedbacks/{id}/row`) | 고 (백엔드 endpoint 필요) | ❌ |
| debounced revalidation | 중 | △ (race 완전 차단 미보장) |

채택: `inFlightRef`. PATCH 시작 +1, finally 블록 -1. 0일 때만 `mutateFeedbacks()` +
`mutateDetail()` 호출 → 모든 PATCH 완료 후에만 GET 재검증 트리거.

추가 단순화: 기존 `isDetailOpen` 분기 클로저 제거. in-flight 0일 때 항상 `mutateDetail()`
호출 (selectedPublicId가 null이면 SWR no-op이라 안전). 두 PATCH의 `isDetailOpen`이
다를 경우 발생할 수 있는 누락 케이스 회피.

### A-3 — 회귀 테스트 5건 신규

기존 deferred promise + `mockFetcher.mock.calls.length` 카운팅 패턴 재사용.

- 필터 일치성 3건: 범위 밖 변경 시 행 제거 / ALL 필터에서 행 유지 / counts -1+1 갱신
- 동시 race 2건: PATCH2 먼저 resolve → PATCH1 완료 전 GET 보류 / PATCH 실패 finally 카운터 감소

전체 admin/feedbacks 테스트: **22 → 27건 통과**, Jest 글로벌: **1388 → 1398건 통과**.

### 변경 요약

- 2 files, +196/-14
  - `frontend/src/app/[locale]/admin/feedbacks/page.tsx` (handleStatusChange 재구성, +28/-14)
  - `frontend/src/app/[locale]/admin/feedbacks/__tests__/page.test.tsx` (+168 신규 describe 2개)

---

## Wave B — Oracle SSOT 통합 (commit `d4c27a1` + 로컬 인프라)

담당: architect (`.claude-team.json` + `oracle-spawn.sh` + `oracle-reap.sh`), scribe (`critic.md` 문구 동기화)

### 배경 (Sprint 127 Wave F PR #153 close 사유)

Sprint 127 Wave F에서 `oracle-reap.sh`에 hardcoded UUID 검증을 도입했고, 별도로
`.claude-team.json` `dispatch.autoCritic.requireSessionId: true` flag를 추가했으나
**flag와 검증 로직이 미연결** — Critic 1차(`019dc216`)가 "강제력 부재" 지적 → PR #153 close.
SSOT는 `oracle-reap.sh` 단독으로 유지.

Sprint 128 목표: flag 재도입 + reap 로직 분기 연결로 "정책 + 강제" 양쪽 SSOT 통합.

### B-1 — `.claude-team.json` flag 재도입

```json
"autoCritic": {
  "enabled": true,
  "trigger": "commitDetected",
  "method": "codex review --base <HEAD_BEFORE>",
  "requireSessionId": true
}
```

기본값 `true`로 기존 동작 보존. 옵트아웃은 명시적 `false` 설정 필요.

### B-2 — `oracle-spawn.sh` env 전달 + `oracle-reap.sh` flag 분기

`oracle-spawn.sh` cleanup trap (`oracle-reap.sh` 호출 직전):

```bash
export REQUIRE_CODEX_SESSION_ID=$(jq -r '.dispatch.autoCritic.requireSessionId // "true"' \
  "${project_dir}/.claude-team.json" 2>/dev/null || echo "true")
```

`oracle-reap.sh` UUID 검증 블록 (L89~95):

```bash
local require_sid="${REQUIRE_CODEX_SESSION_ID:-true}"
if ! grep -qiE 'session id: <UUID>' "$inbox_file" 2>/dev/null; then
  if [[ "$require_sid" == "true" ]]; then
    status="failed_no_codex_session"
    warn "...→ Claude 단독 분석 거부"
  else
    warn "...(requireSessionId=false → 경고만)"
  fi
fi
```

**dry-run 검증** 결과:
- `REQUIRE_CODEX_SESSION_ID=true` + UUID 누락 → `failed_no_codex_session` ✅
- `REQUIRE_CODEX_SESSION_ID=false` + UUID 누락 → `completed` (경고만) ✅
- 기본값(env 없음) → `true` 처리로 기존 동작 보존 ✅

### B-3 — `critic.md` 문구 동기화

L50 `**세션 ID 검증**` 항목과 L70 보고 형식의 "필수, 부재 시 결과 invalid" 표현을
"기본 필수 (`.claude-team.json` `requireSessionId` flag로 토글 가능). flag 변경은 Architect
협의 필수"로 톤 다운. 실제 강제력은 flag와 reap 로직에 위임.

### 변경 요약

- git tracked: `.claude-team.json` 1 file, +2/-1
- 로컬 인프라 (gitignored): `oracle-spawn.sh` env export 1줄 + `oracle-reap.sh` 분기 6줄 + `critic.md` 문구 2줄

---

## Wave C — AnalyticsCharts 타입 좁히기 (commit `e92fad8`)

담당: herald (타입 + 테스트 fixture)

### 배경 (Sprint 127 Critic 3차 관찰)

Sprint 127 Wave A에서 `Difficulty` ↔ `DifficultyDisplay` enum 분리는 완료되었으나,
`AnalyticsCharts.tsx`의 `DifficultyRow.tier`가 `string`으로 남아 unsafe cast
(`DIFFICULTY_LABELS[row.tier as DifficultyDisplay] ?? row.tier`) 잔존. Sprint 128 시드로 이관됨.

### C-1/C-2 — 타입 좁히기 + cast 제거

```diff
- interface DifficultyRow { tier: string; count: number; color: string; }
+ interface DifficultyRow { tier: DifficultyDisplay; count: number; color: string; }

- DIFFICULTY_LABELS[row.tier as DifficultyDisplay] ?? row.tier
+ DIFFICULTY_LABELS[row.tier]
```

`DifficultyDisplay`는 이미 import되어 있어 신규 import 불필요. `DIFFICULTY_LABELS`가
7종 모두 정의(`UNCLASSIFIED` 포함)이므로 `?? row.tier` fallback도 안전하게 제거.

### C-3 — 테스트 fixture UPPER_CASE 정합

`Analytics.test.tsx` L56~59 fixture가 `'Silver'`/`'Gold'` (PascalCase)로 작성되어 있어 새
타입과 불일치. `'SILVER'`/`'GOLD'` (UPPER_CASE) + `'UNCLASSIFIED'` 케이스 1건 추가.
총 해결 수 assertion 14 → 17.

### C-4 — 데이터 공급자 검증

`analytics/page.tsx` L209~221 `useMemo` `difficultyData`가 이미 `tier: d.key` 형태로
`DifficultyDisplay` 타입 값을 공급 중 — 변경 불필요. 타입 좁히기 후 `tsc --noEmit` 통과 확인.

### 변경 요약

- 2 files, +6/-5 (`AnalyticsCharts.tsx` 타입 + 분기 단순화, `Analytics.test.tsx` fixture)
- analytics Jest: 6건 통과

---

## 검증 결과

- `npx tsc --noEmit`: 통과
- `npx next lint`: 신규 warning 0 (기존 인라인 style warning만 잔존)
- `npx jest`: **130 suites, 1398 tests** 통과 (1388 → +10 신규 admin/feedbacks 5 + analytics 5)
- Wave B dry-run: flag true/false 양쪽 시나리오 예상대로 동작

## 에이전트 협업

| Agent | 담당 |
|-------|------|
| architect | Wave A 동시성 fix + Wave B-1/B-2 oracle 인프라 연결 |
| herald | Wave C 타입 좁히기 + 테스트 fixture |
| scribe | Wave B-3 critic.md 페르소나 문구 동기화 |
| critic | (예정) 머지 직전 codex 교차 리뷰 |

## 후속 시드 (Sprint 129 — 재이월 아닌 신규 후속)

- (없음) Sprint 128에서 모든 4 시드 마감. Critic 교차 리뷰 결과 신규 발견이 있으면 추가 가능.

## 학습 메모

- **로컬 인프라 + git tracked의 SSOT 분리**: `.claude/`는 gitignored, `~/.claude/` 외부 환경.
  flag(repo)와 강제 로직(local script)을 env var로 연결하면 분리된 위치라도 단일 진실
  유지 가능. 이번 패턴은 향후 다른 정책-강제 분리 케이스에 재사용 가능.
- **closure-captured `isDetailOpen` 함정**: 비동기 finally 블록에서 클로저 변수에
  의존하는 분기는 동시 호출 시 stale snapshot 위험. in-flight 카운터로 동기화 시점만
  결정하고 분기는 SWR no-op에 위임하는 것이 단순.
