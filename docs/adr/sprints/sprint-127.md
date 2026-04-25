---
sprint: 127
title: "Sprint 126 후속 — UNCLASSIFIED 난이도 토큰 + SWR optimistic 정합성 + Jest @messages alias + Critic UUID 강제"
period: "2026-04-25"
status: completed
start_commit: 11b2d92
end_commit: 6cbdeb1
prs:
  - "#151 feat(frontend): Wave A — UNCLASSIFIED 난이도 토큰 + analytics 차트 대칭화 (squash 6cbdeb1)"
  - "#152 refactor(frontend): Wave B+C+D — SWR optimistic + Jest @messages alias + locale-path @sync (squash 8baa57d)"
  - "#153 (closed) chore: Wave F — autoCritic requireSessionId flag (강제력 부재로 close)"
---

# Sprint 127 — Sprint 126 후속 + Critic 워크플로 강화

## 배경

Sprint 126 종료 시점 시드 4건(B2 unclassified 차트 비대칭, Wave C P3 SWR follow-up,
B6 Jest alias 도입, Critic 워크플로 점검)을 단일 세션 내 마감하는 것이 목표.
**Wave E (Oracle A2 fs_usage 실증)는 `sudo` 권한 의존성으로 보류 → Sprint 128 이월
(재이월 아님 — 권한 차단)**.

PM 원칙: Critic Codex 세션 ID UUID 강제 검증을 인프라(`oracle-reap.sh`)와 Critic
페르소나(`critic.md`) 양쪽에 내재화. flag 추가만으로는 강제력 없음을 Sprint 127 Wave F
실증으로 확인하고 PR #153을 close — 강제 지점은 스크립트 측 로직이 SSOT.

### Sprint 127 처리 현황

| # | 항목 | Wave | 상태 |
|---|------|------|------|
| 1 | UNCLASSIFIED 난이도 토큰 추가 + analytics 차트 대칭화 (Sprint 126 B2) | A | ✅ |
| 2 | handleStatusChange 후 useFeedbackDetail mutate (모달 stale 방지) | B-1 | ✅ |
| 3 | dashboard/feedbacks SWR 모킹 테스트 추가 | B-2 | ✅ |
| 4 | 낙관 업데이트 패턴 강화 (`mutate(updater, { optimisticData })`) | B-3 | ✅ |
| 5 | Jest moduleNameMapper `@messages/*` alias 도입 (Sprint 126 B6) | C | ✅ |
| 6 | middleware ↔ 클라이언트 locale-path 동기화 (`@sync` 주석) | D | ✅ |
| 7 | Oracle A2 `fs_usage` 가설 실증 | E | ⏸️ 보류 → Sprint 128 (sudo 권한 의존) |
| 8 | Critic 워크플로 codex 세션 ID UUID 강제 (oracle-reap.sh + critic.md) | F | ✅ (로컬 인프라) |
| 9 | `.claude-team.json` `requireSessionId: true` 추가 | F | ❌ revert (강제력 부재 → PR #153 close) |

---

## Wave A — UNCLASSIFIED 난이도 토큰 + analytics 차트 대칭화 (PR #151, squash `6cbdeb1`)

담당: palette (디자인 토큰), curator (enum 분리), herald (i18n 회귀 수정), critic (3회 교차 리뷰)

### 배경 (Sprint 126 B2 보류 항목)

`analytics/page.tsx` 태그 차트는 `unclassified` 카테고리를 표시하나 난이도 차트는
silent drop. 디자인 시스템 색상 토큰 결정(Palette 협의)이 동반 필요로 Sprint 126에서
보류, **옵션 A(양쪽 차트 표시)** 채택 합의 후 Sprint 127 Wave A에서 진행.

### 1차 시도 (commit `9e63751`) — 단순 enum 확장

`Difficulty` enum에 `UNCLASSIFIED` 추가 + `globals.css`에 회색 토큰
(`--difficulty-unclassified: #94A3B8` Light / `#64748B` Dark) 추가.

### Critic 1차 (`019dc214-3a86-7670-b068-c72041922ff0`) — P1+P2 발견

- **P1**: `DIFFICULTIES` enum 확장이 백엔드 계약 깨뜨림. `services/problem/src/problem/problem.entity.ts`의
  `Difficulty` enum은 `BRONZE~RUBY` 6종만 허용 — frontend가 `UNCLASSIFIED`를 보내면
  `400 Validation` 발생.
- **P2**: 필터 pill에 `Unclassified`가 노출되나 DB는 null 저장 → 사용자가 선택 시
  빈 결과 회귀.

### 2차 수정 (commit `0ac64f3`) — Curator 위임, enum 분리 패턴

`Difficulty` ↔ `DifficultyDisplay` 분리:

- `Difficulty`: 백엔드 호환 enum 6종 (`BRONZE | SILVER | GOLD | PLATINUM | DIAMOND | RUBY`)
- `DifficultyDisplay`: UI 표시 전용 7종 (위 6종 + `UNCLASSIFIED`)
- 폼/필터/POST 페이로드: `DIFFICULTIES` (백엔드 계약 보호)
- analytics 차트만: `DIFFICULTIES_DISPLAY` (UI 대칭 표시)
- `constants.test.ts`: 두 enum의 분리 보장 회귀 테스트 추가

### Critic 2차 (`019dc220-04a9-70c1-8a43-af94d550066d`) — P1/P2 해소, 신규 P2 발견

- ✅ P1 해소: 백엔드 enum과 UI enum 완전 분리, POST 페이로드 회귀 0
- ✅ P2 해소: 필터 pill에서 Unclassified 제거 (`DIFFICULTIES`만 참조)
- 🟡 신규 P2: `AnalyticsCharts.tsx`에 영문 라벨 회귀 — ko 사용자에게도 `'Unclassified'`
  하드코딩이 노출됨 (`row.tier === 'UNCLASSIFIED' ? 'Unclassified' : row.tier`)

### 3차 수정 (commit `bd66f54`) — Herald 위임, i18n 1줄 분기

```tsx
{row.tier === 'UNCLASSIFIED' ? t('unclassified') : (DIFFICULTY_LABEL[row.tier])}
```

`messages/ko/analytics.json` + `messages/en/analytics.json`에 `unclassified` 키 1개씩.

### Critic 3차 (`019dc228-35b4-7080-91e0-048392ff4f58`) — ✅ 머지 가능

후속 관찰: `DifficultyRow.tier` 타입이 `string`으로 느슨함 — `DifficultyDisplay`로 좁히기는
차단 아님, Sprint 128 시드로 이관.

### 변경 요약

- 6 files, +73/-22 (`constants.ts` + `globals.css` + `analytics/page.tsx` +
  `AnalyticsCharts.tsx` + `DifficultyBadge.tsx` + `constants.test.ts`)
- i18n 라인 1 (`unclassified` 키 ko + en)
- 머지 commit: `6cbdeb1` (squash)

---

## Wave B+C+D — SWR optimistic + Jest @messages alias + locale-path @sync (PR #152, squash `8baa57d`)

담당: architect (B race fix), palette (B2 SWR 모킹), 직접 적용 (C alias + D 주석),
critic (2회 교차 리뷰)

### B-1/B-3 — handleStatusChange detail mutate + optimistic 패턴 (commit `d92ae65`)

#### 변경

`admin/feedbacks/page.tsx` `handleStatusChange`:

1. PATCH 호출 전 `mutateFeedbacks` 낙관 업데이트
2. 모달이 열려 있으면 `mutateDetail` 동시 낙관 업데이트
3. PATCH 완료 후 `mutateFeedbacks() + mutateDetail()` 명시 호출 → 서버 권위 재검증
4. 실패 시 `mutate()` rollback (`{ optimisticData, rollbackOnError: true }`)

#### Critic 1차 P1 발견

- **P1**: `mutateFeedbacks(updater, { revalidate: true })` race condition. PATCH
  완료 전 GET 재검증이 fire되어 stale 데이터로 optimistic 덮어쓰기 가능.

### B-1 fix (commit `43ba8b0`) — Architect 위임, race 정확 해소

- `mutateFeedbacks(updater, { revalidate: false })` 변경 (optimistic만 적용,
  자동 revalidate 비활성)
- 성공 path 마지막에 `await mutateFeedbacks()` + `await mutateDetail()` 명시 호출
  → 서버 응답 후 권위 재검증
- 회귀 테스트 2건 추가:
  - deferred Promise로 PATCH 완료 시점 제어 → optimistic이 GET 응답에 의해
    덮어써지지 않음을 정확히 검증
  - rollback 시 optimistic이 사라지고 원본 데이터 복원

### B-2 — admin/feedbacks SWR 모킹 테스트 20건 신설 (commit `8a0c600`)

신규: `admin/feedbacks/__tests__/page.test.tsx` 20건
- SWRConfig wrapper + `mockFetcher` 패턴 (Sprint 126 C1 use-study-stats 테스트 재사용)
- 페이지네이션 + 모달 detail + status PATCH + 필터 변경 + skeleton 회귀

### C — Jest moduleNameMapper `@messages/*` alias (commit `37b24f0`)

#### 배경 (Sprint 126 B6)

`callback/page.test.tsx`가 `messages/ko/auth.json`을 6-level relative import
(`../../../../../../messages/ko/auth.json`)로 참조 — fragility 높음.

#### 변경

- `tsconfig.json` `paths` + `jest.config.ts` `moduleNameMapper`에
  `"@messages/*": ["./messages/*"]` 추가
- 3 파일 16개 deep relative import → `@messages/ko/auth.json` 형태로 전환
  - `app/[locale]/callback/__tests__/page.test.tsx`
  - `lib/__tests__/locale-path.test.ts`
  - 기타 1 파일 (분석 스크립트)

### D — middleware ↔ 클라이언트 locale-path `@sync` 주석 (commit `6c9d1db`)

#### 배경 (Sprint 126 P3 follow-up)

`middleware.ts`의 `stripLocalePath`와 `frontend/src/lib/locale-path.ts`의
`stripLocalePrefix`는 동일 로직이나 runtime이 다름:
- middleware: Edge runtime
- locale-path: Node + Browser

→ 모듈 통합 불가, drift 위험.

#### 변경

양쪽 함수 JSDoc에 `@sync <상대경로>:<함수명>` cross-reference 주석 추가:

```typescript
/**
 * @sync frontend/src/lib/locale-path.ts:stripLocalePrefix
 * Edge runtime이므로 client util을 import할 수 없음. drift 발생 시 양쪽 동기 수정 필요.
 */
function stripLocalePath(pathname: string): string { ... }
```

### Critic 2차 (`019dc221-b4f4-7e30-9612-31de70cba6ba`) — P1 해소, 신규 P2 2건

- ✅ P1 race 완전 해소. 회귀 테스트가 deferred Promise로 race를 정확히 모킹
- 🟡 신규 P2#1: status 필터 활성 시 optimistic update가 일치하지 않는 카테고리에 행 잔존
  (counts stale) → Sprint 128 시드 이관
- 🟡 신규 P2#2: 두 행 빠르게 변경 시 첫 PATCH 완료 후 GET이 두 번째 optimistic
  덮어쓰는 잔여 race → in-flight PATCH 카운트 또는 row-scoped mutate 필요 → Sprint 128 시드 이관

### 머지

- 머지 commit: `8baa57d` (squash)

---

## Wave E — Oracle A2 fs_usage 실증 (보류 → Sprint 128 이월)

담당: 보류 (사용자 권한 의존)

### 배경

Sprint 125 D2 H1 가설 (`~/.claude/` 경로 sensitive path 보호 추정) 실증이 목적.
`sudo fs_usage -w -f filesys claude` 명령은 root 권한 필요 → 사용자 직접 실행 의존.

### 결정

- Sprint 127 단일 세션 내 사용자 sudo 실행 미수행 → Sprint 128 이월
- **재이월 아님 — 권한 의존성 차단으로 인한 정상 이월**
- 검증 결과에 따라 inbox path rename (`~/.claude/oracle/inbox` → `~/oracle-results`)
  진행 여부 결정

---

## Wave F — Critic 워크플로 codex 세션 ID UUID 강제

담당: 직접 적용 (로컬 인프라), critic (1회 교차 리뷰)

### F-1 — `critic.md` (local, gitignored) 강화

- 세션 ID 필수화 — "있으면" 표현 제거
- UUID 예시 명시 (`019dc214-3a86-7670-b068-c72041922ff0` 형식)
- Sprint 127 Wave F 검증 노트 추가 (Sprint 126 Wave B Codex 미호출 사례 재발 방지)

### F-2 — `~/.claude/oracle/bin/oracle-reap.sh` (local) UUID regex 검증

- log에서 codex 세션 ID 추출 패턴: `session id: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`
- 세션 ID 부재 시 task status를 `failed_no_codex_session`으로 마킹
- `update_task_status` 완료 판정 함수에 신규 status 포함 (Critic이 codex 미호출 시
  자동 거부)

### F-3 — PR #153 (close 결정)

`.claude-team.json`에 `dispatch.autoCritic.requireSessionId: true` flag 추가했으나
사용자가 revert.

#### Critic 1차 (`019dc216-56b1-70c0-9bd9-91145b449502`) — 강제력 부재 지적

- repo 변경 자체는 회귀 0이나 강제력 부재 — `oracle-reap.sh` UUID 검증 로직이
  `.claude-team.json` flag를 참조하지 않음. flag만으로는 런타임 강제력 없음.

#### 결정

- **PR #153 close** — `.claude-team.json` 측 변경은 SSOT 아님
- 강제력은 로컬 `oracle-reap.sh`의 hardcoded UUID 검증 로직에 있으며, `.claude/`는
  `.gitignore`로 git 추적 외부 → repo 측 PR은 무효
- `oracle-spawn.sh`가 `.claude-team.json` flag를 참조하도록 연결하는 작업은
  Sprint 128 시드로 이관

---

## 결정 (Decisions)

1. **`Difficulty` ↔ `DifficultyDisplay` 분리 패턴**: UI 표시 전용 가상 카테고리는
   백엔드 호환 enum과 분리해야 함. 공유 enum 확장은 frontend/backend 계약을 동시에
   깨뜨릴 수 있음 → 후속 sprint에서 동일 패턴(예: `Status`/`StatusDisplay`,
   `Tier`/`TierDisplay`) 적용 권장.
2. **SWR optimistic 정확한 sequencing**: `mutate(updater, { revalidate: false })`로
   optimistic만 → `await mutation()` → 성공 시 `mutate()` 명시 revalidate.
   `revalidate: true`는 PATCH 완료 전 GET fire로 race condition 유발.
3. **`@sync` cross-reference 주석**: 동일 로직이지만 runtime이 다른 코드(Edge vs
   Node/Browser)는 공용 추출 불가 → drift 방지용 cross-reference 주석으로 동기화
   요구 명문화. 모듈 통합 대신 의도적 중복 + 검증 게이트.
4. **autoCritic UUID 강제**: Critic 페르소나 + `oracle-reap.sh` 양쪽에서 codex
   세션 ID UUID 검증. Claude 단독 분석은 자동 거부. `.claude-team.json` flag만으로는
   강제력 없음 → 스크립트 측 로직이 SSOT.
5. **PR #153 close 결정**: `.claude-team.json` flag 추가만으로 런타임 강제력 없다는
   Critic 지적 수용. 강제 지점은 로컬 `oracle-reap.sh`의 UUID 검증 로직에 있으며,
   `.claude/`는 `.gitignore`로 git 추적 외부 → repo 측 PR은 무효, 로컬 인프라만 유지.
6. **Wave E 보류**: `sudo fs_usage` 권한 의존성으로 단일 세션 내 미수행. Sprint 128로
   이월 (재이월 아님).

---

## 패턴 (Patterns)

1. **enum 분리 패턴**: `<Domain>` (백엔드 계약 enum) ↔ `<Domain>Display` (UI 표시 전용
   확장) 분리. POST/필터는 `<Domain>`, 차트/표시는 `<Domain>Display`. 회귀 테스트로
   분리 보장 강제.
2. **SWR race-free optimistic 패턴**:
   ```typescript
   await mutate(updater, { revalidate: false, optimisticData, rollbackOnError: true });
   await fetch(...).then(...);
   await mutate();  // 명시 revalidate (서버 권위)
   ```
3. **`@sync` cross-reference 주석 패턴**: Edge runtime 등 module 분리가 강제되는
   경우 양쪽 함수 JSDoc에 `@sync <상대경로>:<함수명>` 주석 + drift 시 동기 수정
   요구 명문화.
4. **로컬 인프라 SSOT 원칙**: `.claude-team.json` 등 repo 측 flag는 *선언적 정책*.
   런타임 강제력은 로컬 스크립트(`oracle-reap.sh`/`oracle-spawn.sh`)의 검증 로직이
   SSOT. flag만 추가하고 스크립트 측 참조 누락 시 강제력 0.

---

## Critic 통과 codex 세션 누적

| Wave | 회차 | 세션 ID | 결과 |
|------|------|---------|------|
| Wave A | 1차 | `019dc214-3a86-7670-b068-c72041922ff0` | P1+P2 발견 (백엔드 계약 + 빈 결과 회귀) |
| Wave A | 2차 | `019dc220-04a9-70c1-8a43-af94d550066d` | P1/P2 해소, 신규 P2 (영문 라벨 회귀) |
| Wave A | 3차 | `019dc228-35b4-7080-91e0-048392ff4f58` | ✅ 머지 가능 |
| Wave B | 1차 | `019dc215-842c-7a21-b0f4-574827880ff6` | P1 race condition 발견 |
| Wave B | 2차 | `019dc221-b4f4-7e30-9612-31de70cba6ba` | P1 해소, 신규 P2 2건 시드 이관 |
| Wave F | 1차 | `019dc216-56b1-70c0-9bd9-91145b449502` | 강제력 부재 지적 → PR #153 close |

---

## 메트릭

| 지표 | 수치 |
|------|------|
| 머지된 PR | 2개 (#151, #152). PR #153 close (강제력 부재) |
| 총 commit (squash 전) | 7개 (Wave A 3 + Wave B 4) |
| Critic codex 교차 리뷰 | 6회 (Wave A 3 + Wave B 2 + Wave F 1) |
| 신규 회귀 테스트 | 22건 (B-2 admin/feedbacks 20 + B-1 fix race 2) |
| 신규 enum 분리 | 1건 (`Difficulty` ↔ `DifficultyDisplay`) |
| 신규 i18n 키 | 2개 (analytics.unclassified ko+en) |
| Jest path alias 도입 | 1개 (`@messages/*`) |
| `@sync` cross-reference 주석 | 2건 (middleware + locale-path) |
| Sprint 126 시드 마감 | 4/5 (Wave E는 권한 의존으로 Sprint 128 이월) |

---

## 학습 / 회고 (Lessons)

1. **공유 enum 확장 위험성**: frontend가 단순히 enum 한 값 추가했을 뿐이라도
   POST 페이로드를 통해 백엔드 validation을 깰 수 있음. UI 표시 전용 카테고리는
   반드시 별도 enum으로 분리하고 회귀 테스트로 강제. Sprint 127 Wave A에서 1차
   commit 후 Critic이 정확히 이 점을 지적해 2차 분리 commit으로 해소.
2. **SWR `revalidate: true` 안티패턴**: optimistic update의 `revalidate: true`는
   PATCH 완료 전 GET fire를 유발해 race condition을 만든다. `revalidate: false`로
   optimistic만 적용 후 PATCH 성공 path에서 명시 `mutate()` 호출하는 sequencing이
   안전. deferred Promise 회귀 테스트로 race를 정확히 검증 가능.
3. **`@sync` 주석으로 Edge runtime drift 방지**: middleware (Edge)와 클라이언트
   util (Node/Browser)는 module 분리가 강제되어 모듈 통합 불가. 의도적 중복 +
   `@sync` cross-reference 주석으로 drift 시 양쪽 동기 수정 요구 명문화하는 것이
   현실적. 향후 인프라 작업으로 검증 게이트(grep `@sync` 후 양쪽 diff 확인) 추가
   고려.
4. **flag 추가만으로는 강제력 0**: `.claude-team.json`에 `requireSessionId: true`
   추가했지만 `oracle-reap.sh`가 이 flag를 참조하지 않음 → 런타임 강제력 0.
   Critic이 정확히 이 점을 지적, PR #153 close. 강제 지점은 *스크립트 측 검증
   로직*에 있으며, repo 측 flag는 선언적 정책에 불과. SSOT는 로컬 인프라.
5. **권한 의존성 작업의 분리**: `sudo fs_usage` 같은 권한 의존성 작업은 단일 세션
   내 미수행이 정상. 강제로 진행하지 말고 Sprint 128로 이월하되 *재이월이 아닌
   계획적 후속*으로 명시. PM 원칙 "이월 0"은 권한 의존성 차단에는 적용되지 않음.

---

## Sprint 128 시드 (재이월 아님 — 신규 발견 후속)

### SWR + 동시성 (Sprint 127 Wave B Critic 2차 발견)

- [ ] admin/feedbacks: status 필터 활성 시 optimistic update가 일치하지 않는
  카테고리에 행 잔존 (counts stale) → 필터 일치성 검증 추가
- [ ] admin/feedbacks: 두 행 빠르게 변경 시 첫 PATCH 후 GET이 두 번째 optimistic
  덮어쓰는 잔여 race → in-flight PATCH 카운트 도입 또는 row-scoped mutate

### Oracle 인프라 (Sprint 126→127 이월, 권한 의존성 차단)

- [ ] Wave E: `sudo fs_usage -w -f filesys claude` 로 H1 가설 (`.claude/` sensitive
  path 보호) 실증 → path rename 진행 여부 결정

### Critic 워크플로 (Sprint 127 Wave F 보강)

- [ ] `oracle-spawn.sh`가 `.claude-team.json` `dispatch.autoCritic.requireSessionId`
  flag를 참조하도록 연결 (현재는 `oracle-reap.sh`의 hardcoded UUID 검증만 동작)

### 기술부채 (Sprint 127 Wave A Critic 3차 관찰)

- [ ] `AnalyticsCharts.tsx` `DifficultyRow.tier`를 `string` → `DifficultyDisplay`로
  좁히기 (차단 아님, 후속 작업)
