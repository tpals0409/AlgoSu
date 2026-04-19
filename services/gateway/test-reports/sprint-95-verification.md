# Sprint 95 Wave 3 — 검증 리포트

- **검증 시각**: 2026-04-20T08:08+09:00
- **브랜치**: `feat/gateway-programmers-dataset`
- **누적 커밋**: `adad5cf` (architect) → `60b7925` (ADR) → `e460b79` (크롤러+373건)
- **검증 에이전트**: Gatekeeper

---

## 항목별 결과

### 1. Gateway 유닛 테스트 — PASS

```
Test Suites: 50 passed, 50 total
Tests:       749 passed, 749 total
Time:        8.903 s
```

| 신규 스펙 | 결과 |
|-----------|------|
| `programmers.service.spec.ts` | PASS |
| `programmers.controller.spec.ts` | PASS |

| 회귀 스펙 | 결과 |
|-----------|------|
| `solvedac.service.spec.ts` | PASS |
| `solvedac.controller.spec.ts` | PASS |

### 2. TypeScript (Gateway) — PASS

```
$ npx tsc --noEmit
# 오류 0건 — 출력 없음
```

### 3. ESLint (Gateway) — PASS

**`src/**/*.ts`**: 0 errors, 6 warnings (기존 파일의 `@typescript-eslint/no-unused-vars`)

```
structured-logger.service.ts:138  — _t, _r unused (기존)
public-profile.controller.spec.ts:8  — fetch, 모킹 unused (기존)
public-share.controller.spec.ts:9    — fetch, 모킹 unused (기존)
```

- `no-console` 위반: **0건** (programmers 관련 신규 파일 모두 준수)

**`scripts/**/*.ts`**: 0 errors, 0 warnings

- `fetch-programmers-problems.ts`는 `scripts/` 경로에 위치한 1회성 크롤러 스크립트
- ESLint 검사 결과 `no-console` 위반 없음 (구조적 로그 또는 미사용)

### 4. Problem DTO 회귀 — FAIL

```
Test Suites: 1 failed, 12 passed, 13 total
Tests:       114 passed, 114 total
```

**실패 원인**: `problem.service.spec.ts` 컴파일 실패 (TS2322 × 2건)

| 위치 | 값 | 오류 |
|------|-----|------|
| `problem.service.spec.ts:156` | `sourcePlatform: 'LeetCode'` | `'LeetCode'`는 `'BOJ' \| 'PROGRAMMERS' \| undefined`에 할당 불가 |
| `problem.service.spec.ts:414` | `sourcePlatform: 'Codeforces'` | `'Codeforces'`는 `'BOJ' \| 'PROGRAMMERS' \| undefined`에 할당 불가 |

**근본 원인**: Architect(`adad5cf`)가 `create-problem.dto.ts`에서 `sourcePlatform` 타입을 `string` → `SourcePlatform = 'BOJ' | 'PROGRAMMERS'`로 강화하면서, 기존 spec 파일의 테스트 값(`'LeetCode'`, `'Codeforces'`)이 타입 불일치.

**수정 방안** (Oracle/Architect 판단 필요):
- 옵션 A: spec 값을 `'BOJ'` 또는 `'PROGRAMMERS'`로 교체 (타입 정합성 복원)
- 옵션 B: 해당 테스트에서 `as any`로 캐스팅 (잘못된 값 거부 테스트 의도 보존)
- 권장: **옵션 A** — 테스트 의도가 DTO 유효성 거부가 아니라 "임의 sourcePlatform으로 create/update" 이므로 유효한 값으로 교체

**Problem `tsc --noEmit` 결과**: 동일 2건 오류

### 5. BOJ 회귀 점검 — PASS

**Solvedac 파일 변경사항**: 없음 (git diff 결과 공백)

```
$ git diff main..feat/gateway-programmers-dataset -- \
    services/gateway/src/external/solvedac.service.ts \
    services/gateway/src/external/solvedac.controller.ts
# (변경 0줄)
```

**external.module.ts 등록 유지 확인**:

```diff
  controllers: [SolvedacController, ProgrammersController],
  providers: [SolvedacService, ProgrammersService],
```

- `SolvedacController` / `SolvedacService` 등록 유지 확인
- `ProgrammersController` / `ProgrammersService` 병치 추가 확인
- 기존 BOJ 라우트 (`/api/external/solvedac/*`) 무결성 보존

### 6. 종합 판정

| # | 항목 | 판정 |
|---|------|------|
| 1 | Gateway 유닛 테스트 (50 suites, 749 tests) | **PASS** |
| 2 | Gateway `tsc --noEmit` | **PASS** |
| 3 | Gateway ESLint (`src/` + `scripts/`) | **PASS** (0 errors) |
| 4 | Problem DTO 회귀 (`tsc` + `jest`) | **FAIL** (2건 TS2322) |
| 5 | BOJ 회귀 (solvedac diff + module 등록) | **PASS** |

---

## 에스컬레이션

**과제 4 실패** → Oracle에 에스컬레이션 필요.

- 실패는 **Problem 서비스** 내부 (`services/problem/src/problem/problem.service.spec.ts`)
- Gateway 측 코드는 전부 정상 — 문제는 Architect의 DTO 타입 강화가 기존 spec에 영향
- Gatekeeper 규칙에 따라 **코드 수정 미실시** — 수정은 Architect 또는 Oracle 판단 하에 진행
