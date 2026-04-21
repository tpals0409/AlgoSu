---
sprint: 106
title: "이월 3항목 일괄 처리 — Coverage 70% + L2 캐시 + Frontend 최적화"
period: "2026-04-21"
status: complete
start_commit: f05c3ba
end_commit: 672929d
---

# Sprint 106 — 이월 3항목 일괄 처리: Coverage 70% + L2 캐시 + Frontend 최적화

## 배경

Sprint 102~105는 채널톡 CI 리팩토링 레퍼런스를 기반으로 composite action 도입 → 확산 → rebuild_all 운영 규약 → commitlint 자동화의 4스프린트 로드맵을 완료했다. 그 과정에서 세 가지 항목이 "실측 데이터 확보 후 결정" 또는 "범위 정의 필요"로 이월됐다:

1. **Coverage threshold 70% 상향** — Sprint 104·105 ADR에 이월 기록. Sprint 105 마감 시점 MEMORY.md에 "글로벌 coverage threshold 60% → 70% 상향 검토 — Sprint 106+ 실측 기반 결정"으로 명시.
2. **L2 캐시 레이어** — Sprint 104·105 ADR에 이월 기록. "범위 정의 후 진행"으로 명시.
3. **Frontend 빌드 최적화** — Sprint 104·105 ADR에 이월 기록. "Turbopack/.next/cache 외 추가 여지 분석"으로 명시.

Sprint 106은 이 세 이월 항목을 3개 병렬 트랙([A]/[B]/[C])으로 일괄 처리한다. Sprint 105의 운영 원칙 3가지(런북 즉시 리허설, Sensei 선자문, ±10% 실용 기준)를 계승한다.

## 목표

| 트랙 | 내용 | 상태 |
|------|------|------|
| [A] Coverage Threshold 정렬 + 70% 상향 | Frontend branches 69.55% → 71%+ 달성, 글로벌 게이트 60% → 70% 상향 | ✅ 완료 (PR #121~#124 머지) |
| [B] L2 캐시 레이어 도입 | NestJS `dist/` + Next.js `.next/cache` GHA 캐싱으로 Docker 빌드 40% 단축 목표 | ❌ 미도입 결정 (Sensei 선자문 중단 조건 충족) |
| [C] Frontend 빌드 최적화 | 실측 인프라 + 저복잡도 개선 3개 동시 적용 | ❌ 미도입 결정 (Sensei 선자문 전부 제외) |

---

## [A] Coverage Threshold 정렬 + 70% 상향

### 배경 (문제 정의)

Sprint 105 마감 후 글로벌 coverage-gate는 `scripts/check-coverage.mjs coverage/ 60`으로 60%를 기준으로 하고 있었다. 각 서비스의 jest/pytest threshold는 Node 92~100%, Python 98%, Frontend lines 83%로 이미 60%를 크게 초과하고 있어 글로벌 게이트가 실질적인 보호 기능을 하지 못하는 정합성 문제가 존재했다.

Sprint 106 착수 전 Sensei 선자문(task-20260421-134249)을 통해 실제 메커니즘을 분석한 결과, 글로벌 70% 상향의 유일한 병목은 **Frontend branches 단독 1축(69.55%)**으로 확인됐다.

### 결정 근거

#### 핵심 메커니즘 — Path-filter 구조 분석

Sensei 실측이 확인한 3단계 파이프라인 구조:

1. `test-node` / `test-ai-analysis` / `test-frontend` 잡이 각각 `coverage-{service}` artifact 업로드
2. `coverage-gate` 잡이 `merge-multiple: false`로 수집 → `coverage/coverage-{service}/lcov.info` 계층 구조
3. `check-coverage.mjs coverage/ 60`이 재귀 탐색, 모든 lcov.info를 **weighted 합산**하여 lines AND branches 동시 검증

**문제 경로:** frontend 코드만 변경된 PR → `coverage/coverage-frontend/lcov.info` 1개만 존재 → 집계 결과 = frontend 단독 branches **69.55%** → 70% 게이트 설정 시 **FAIL**.

반면, 전 서비스 weighted 집계 글로벌 branches는 약 82%로 이미 70%를 초과한다. 즉, "글로벌은 통과하는데 frontend-only PR이 막히는" 역설적 병목 구조.

#### 서비스별 Threshold vs 실측 표

##### 계약값 (jest.config.ts / pyproject.toml)

| 서비스 | Lines T | Branches T | Functions T | Statements T | 비고 |
|--------|---------|-----------|------------|-------------|------|
| gateway | 98 | 95 | 96 | 98 | NestJS |
| submission | 97 | 92 | 96 | 97 | NestJS (Saga) |
| problem | 98 | 96 | 98 | 98 | NestJS |
| github-worker | 98 | 92 | 100 | 98 | NestJS |
| identity | 98 | 98 | 98 | 98 | NestJS |
| ai-analysis | 98* | — | — | — | Python, lines only |
| **frontend** | **83** | **69→71** | **82** | **81** | Next.js — 병목 → 71로 상향 |

\* Python `fail_under=98` 단일 기준. `branch = true` 미설정 → branches 미추적 (BRF:0/BRH:0).

##### 실측값 (lcov.info 실측, Sensei 집계)

| 서비스 | Lines 실측 | Lines T | Margin | Branches 실측 | Branches T | Margin |
|--------|----------|---------|--------|--------------|-----------|--------|
| gateway | 98.9% (2174/2198) | 98 | **+0.9%** | 95.4% (640/671) | 95 | **+0.4%** |
| github-worker | 100.0% (402/402) | 98 | **+2.0%** | 95.0% (134/141) | 92 | **+3.0%** |
| frontend (Before) | 83.5% (1690/2024) | 83 | **+0.5%** | **69.55%** (1302/1872) | 69 | **+0.55%** |
| frontend (After) | — | 83 | — | **76.42%** (목표 71% 초과) | 71 | **+5.42%** |
| submission | N/A (threshold 보증) | 97 | — | N/A | 92 | — |
| problem | N/A (threshold 보증) | 98 | — | N/A | 96 | — |
| identity | N/A (threshold 보증) | 98 | — | N/A | 98 | — |
| ai-analysis | N/A (branches 미추적) | 98 (lines) | — | 추적 안 함 | — | — |

전 서비스 weighted 집계 추정: Lines ≈94.3%, Branches ≈81.9% — 70% 게이트 통과 ✅

#### 71%+ 달성 시나리오 (Sensei 자문 → Architect 실행)

Sensei 선자문 결과, gap 분석:

| 목표 | 필요 branches hit | 현재 (Before) | Gap |
|------|----------------|--------------|-----|
| 70.0% | 1311 | 1302 | +9 |
| **71.0% (계약 목표)** | 1330 | 1302 | **+28** |
| 72.0% (안전 버퍼) | 1348 | 1302 | +46 |

**권장 시나리오 (3개 파일, 72%+ 안전 버퍼):** `lib/feedback.ts` + `components/ui/CodeBlock.tsx` + `components/providers/EventTracker.tsx` 신규 테스트 약 120~190 LOC. 1 스프린트 범위 내 달성 가능으로 판정.

### 구현 결과 (Architect 실행, task-20260421-135617)

#### PR A-1 — 테스트 보강 + jest threshold 상향

- 브랜치: `feat/sprint-106-coverage-frontend-tests`
- PR: [#121](https://github.com/tpals0409/AlgoSu/pull/121)
- 신규 테스트 77개 (3파일, 603 LOC 합계):

| 테스트 파일 | 테스트 수 | LOC | 커버 대상 |
|------------|----------|-----|---------|
| `frontend/src/lib/__tests__/feedback.test.ts` | 42개 | 288 | 유효성 분기, null/빈값/비정상값 케이스 |
| `frontend/src/components/ui/__tests__/CodeBlock.test.tsx` | 24개 | 143 | lang prop 유무, copy 버튼 분기 |
| `frontend/src/components/providers/__tests__/EventTracker.test.tsx` | 11개 | 172 | GA 환경 분기 (window.gtag 유무) |

- `frontend/jest.config.ts` branches: **69 → 71**
- 로컬 실측: Branches **69.55% → 76.42%** (+6.87pp, 목표 71% 대비 +5.42pp 초과)
- Test Suites: 116 passed, Tests: 1231 passed / `tsc --noEmit`: PASS

#### PR A-2 — CI 게이트 상향 + 서비스별 로그 강화

- 브랜치: `feat/sprint-106-ci-coverage-gate-70` (main에서 직접 분기)
- PR: [#122](https://github.com/tpals0409/AlgoSu/pull/122)
- `scripts/check-coverage.mjs`: 서비스별 breakdown 로그 +15줄 추가
- `.github/workflows/ci.yml` L521: **60 → 70**
- PR 본문에 Sensei 경고("A-1 CI green 선행 필수") 인용 포함

#### PR A-3 — CLAUDE.md 커버리지 규정 수정 (Gatekeeper 담당)

- 내용: "테스트 커버리지 60%+" → "글로벌 70%+ / 서비스별 개별 threshold 유지"
- 상태: PR 생성 예정 (Gatekeeper 후속)

### 순서 보호 장치

**PR 머지 순서 필수:**

```
PR A-1 (#121) → CI green 확인 → PR A-2 (#122) 머지 → PR A-3 (Gatekeeper) 머지
```

**⚠️ PR A-2 단독 머지 금지:** `check-coverage.mjs coverage/ 70` 상태에서 PR A-1이 없으면, frontend-only PR 시 coverage-gate가 69.55%로 FAIL. A-1의 `jest.config.ts branches: 71` 변경과 신규 테스트 3파일이 반드시 선행되어야 한다. Sensei 경고 사항으로 PR A-2 본문에도 명시.

### 트랙 [A] 교훈

1. **Sprint 105 Sensei 선자문 패턴이 Sprint 106에서도 유효** — 선자문(N=1 충분 판정) 결과로 Post 측정 반복이 불필요함을 사전 확인. 목표 71% 대비 76.42% 달성(+5.42pp 초과)은 Sensei의 권장 3파일 시나리오가 보수적으로 설계되어 있었음을 증명. "Architect 실행 후 1회 CI 통과로 검증 종료"가 최적 경로였음이 사후 확인됨.

2. **글로벌 게이트 단일 숫자는 path-filter 구조에서 오해를 유발한다** — "전 서비스 집계 82%면 글로벌 70% 달성"이라는 직관은 frontend-only PR 경로에서 부정된다. `check-coverage.mjs` 서비스별 breakdown 로그 출력(PR A-2)이 이 구조적 가시성 문제를 해결하는 핵심 개선이다. 향후 path-filter 기반 CI 설계 시 "coverage-gate가 어떤 lcov 셋으로 동작하는가"를 PR 범위별로 명시해야 한다.

3. **Coverage는 결정론적 측정 — Sprint 105 ±10% 실용 기준은 측정 성격에 따라 선택하는 것** — CI timing은 jitter로 확률적이어서 Pre n=4 + Post n=3 + Welch t-test가 필요했다. 반면 coverage는 동일 코드 = 동일 수치의 binary gate다. Sprint 105 교훈 3("CI timing은 ±10% 실용 기준")은 timing 측정에만 적용되는 것이며, "실측 완료 시에만 작업 완료" 원칙은 측정 성격(결정론/확률론)과 무관하게 동일하게 적용된다.

---

## [B] L2 캐시 레이어 도입

> **상태: ❌ 미도입 결정 — Sensei 선자문(task-20260421-143704) 중단 조건 충족. 코드 변경 없음.**

### 원안 계획

NestJS `dist/` 5개 서비스(gateway, identity, submission, problem; github-worker 제외) + Next.js `.next/cache` 2개(frontend, blog)를 GHA 파일시스템 캐시로 캐싱하여 Docker 빌드 3~5분 → **40% 단축** 목표. composite action `.github/actions/cache-build-output/action.yml` 신규 생성, `problem` 서비스 파일럿 → Pre/Post 실측 → 전 서비스 확산.

### 결정: 미도입 (중단 조건 충족)

Sensei 선자문(task-20260421-143704) 결과, 승인 플랜의 명시적 중단 조건("Docker 멀티스테이지 내부 cache와 L2 GHA 캐시 중복 시 이득 0 → 중단")이 충족됨을 확인했다. **트랙 [B] 조기 종결. 코드 변경 없음. 분석 결과 ADR 기록 및 Sprint 107 시드 등록.**

### 구조적 발견 4건 (Sensei 선자문 리포트)

#### 발견 1: Docker buildkit `type=gha,mode=max`가 L2 역할 이미 수행

`mode=max`는 빌더 스테이지의 **모든 중간 레이어**를 GHA cache에 저장한다. NestJS `RUN npm run build`(= `dist/` 생성)가 이미 GHA cache 레이어로 저장됨 → 외부 GHA 파일시스템 캐시 추가는 **100% 중복**.

```
# NestJS 예시 (problem/Dockerfile) — mode=max 캐시 커버 범위
Layer 1: FROM node:22-alpine AS builder         [캐시]
Layer 2: COPY package*.json ./                  [package.json 미변경 시 HIT]
Layer 3: RUN npm ci                             [package.json 미변경 시 HIT]
Layer 4: COPY . .                               [소스 변경 시 MISS]
Layer 5: RUN npm run build   ← dist/ 생성       [Layer 4 MISS 시 재실행]
```

`mode=max`는 Layer 5 결과(dist/)를 **이미** GHA cache에 저장 중 = 사실상 L2 캐시가 Docker 레이어 형태로 이미 존재.

#### 발견 2: Frontend `.next/cache` GHA step 이미 존재하나 비기능 (ci.yml L624~630)

`build-frontend` 잡에 `actions/cache@v5 path: frontend/.next/cache` 단계가 이미 존재한다. 그러나 해당 잡은 host-side `npm run build` 없이 `docker/build-push-action` 전용 → `.next/cache`가 host에 생성되지 않음 → **빈 디렉토리 save/restore 반복**. Docker 전환 이전 host-side 빌드 시대 유산으로 판단.

비기능 메커니즘:
1. `actions/cache restore` → `frontend/.next/cache` host에 복원 (캐시 존재 시)
2. `docker/build-push-action context: ./frontend` → Docker context에 포함
3. `docker/build-push-action` 실행 → 이미지 GHCR push. **컨테이너 내부 `.next/cache`는 host로 반출 안 됨**
4. `actions/cache save (post)` → 빈 디렉토리 저장. 다음 run도 동일 반복

#### 발견 3: Blog에 `.next/cache` GHA step 추가 시 동일 비기능 재현

`build-blog`에도 host-side `npm run build` 없음 → 동일 구조 → 추가해도 비기능. Blog Dockerfile의 SSG `out/` 빌드도 Docker 내부 전용.

#### 발견 4: 전 빌드 잡이 Docker 내부 전용 → GHA 파일시스템 캐시 활용 경로 자체 없음

전체 파이프라인에서 **host filesystem에서 `npm run build`를 실행하는 잡이 단 하나도 없다**. 모든 TypeScript/Next.js 컴파일은 Docker 컨테이너 내부에서만 발생. GHA 파일시스템 캐시는 host filesystem에만 적용 → 현 Docker 전용 아키텍처에서는 구조적으로 활용 경로 없음.

### 40% 단축 목표 재현실화

| 시나리오 | 현재 소요 | L2 GHA 캐시 추가 후 | 개선율 |
|----------|----------|-------------------|-------|
| 소스 미변경 | ~30~60s (Docker HIT) | 동일 | **0%** |
| 소스 변경 (일반 PR) | 3~5분 (Docker MISS) | 동일 | **0%** |
| package.json 변경 | npm ci 포함 4~6분 | 동일 | **0%** |

**결론:** 현 Docker 빌드 아키텍처(모든 컴파일이 Docker 내부 전용)에서는 GHA 파일시스템 캐시 추가로 40% 단축 달성 불가. 진정한 L2 효과는 host-side 빌드 전환이 선행되어야 한다.

### 원계획 vs 재조정 요약

| 원계획 항목 | 재조정 결과 | 사유 |
|------------|-----------|------|
| composite action `cache-build-output` 생성 | 불필요 | 캐시 대상 없음 |
| `problem` 서비스 파일럿 | 불필요 | 중단 조건 충족 |
| NestJS 4개 확산 + Next.js 2개 | 불필요 | 중단 조건 충족 |
| Pre/Post 실측 | 불필요 | 구현 없음 |
| 런북 L2 무효화 절차 추가 | 불필요 | 캐시 없음 |
| Scribe ADR [B] 기록 | ✅ 완료 (본 섹션) | 분석 결과 문서화 |
| 비기능 단계 정리 (ci.yml L624~630) | 선택적 — Architect 병렬 PR (task-20260421-145147) | P1 정리 권고 |

### 트랙 [B] 교훈

1. **Sprint 105 "Sensei 선자문 → 원안 축소" 패턴이 Sprint 106 [B]에서도 적중 — 실구현 0줄 달성** — Sprint 105 [B-2]에서 선자문으로 runner-minutes 75% 절감했다. Sprint 106 [B]에서는 동일 패턴이 한 단계 더 나아가 구현 자체가 0줄이 됐다(runner-minutes 100% 절감). Sensei 선자문이 단순 최적화 도구가 아닌 "구현 필요성 자체를 검증하는 게이트"로 기능함이 재확인됐다.

2. **플랜 명시적 중단 조건("중복 시 이득 0")은 실제 작동하는 안전장치** — 승인 플랜의 리스크 대응 조항이 선자문 시점에 정확히 발동됐다. "중단 조건을 플랜에 명시하는 것"은 Sensei 선자문 단계에서 판단 기준을 제공하는 구조적 역할을 한다. 중단 조건이 없었다면 선자문 결과를 "일부 적용"으로 모호하게 처리할 위험이 있었다.

3. **"이미 구현된 것처럼 보이는 비기능 코드" 탐지** — `ci.yml L624~630` Frontend `.next/cache` GHA step은 플랜 수립 단계 Explore에서 "이미 구현된 캐시 단계"로 인식될 수 있었으나, Sensei가 Docker 아키텍처 맥락에서 비기능임을 판정했다. 코드의 존재 ≠ 기능 동작. CI 파이프라인 탐색 시 "host-side vs Docker 내부" 경계를 확인하는 것이 필수 선행 분석임이 증명됐다.

### Sprint 107 시드 — "진정한 L2 달성 경로"

현 Docker 전용 아키텍처 내에서 GHA 파일시스템 캐시 효과를 실현하려면 host-side 빌드 전환이 필요하다. 아래 4건을 Sprint 107 후속 검토 항목으로 등록한다.

| 방안 | 설명 | 예상 단축 | 난이도 |
|------|------|----------|-------|
| **Blog host-side SSG 빌드** | CI에서 `npm ci + npm run build` on host → `out/` GHA cache → Docker는 `COPY out/` 전용 | MISS 시 40~60% | 중 (Dockerfile + ci.yml) |
| **Frontend host-side 빌드** | CI에서 `npm ci + npm run build` on host → `.next/standalone` GHA cache → Docker COPY only | MISS 시 40~60% | 중 (Dockerfile + ci.yml) |
| **`APK_CACHE_BUST` 조건화** | 보안 패치 필요 시만 apk invalidate (현재 매 run 강제 invalidate → 조건부 전환) | 20~30s/서비스 | 낮음 (보안 트레이드오프 결정 필요) |
| **NestJS tsc incremental** | host-side 빌드 전환 + `tsBuildInfoFile` 활용 | MISS 시 20~40% | 중~고 (Dockerfile 대수정) |

> **선택적 정리:** ci.yml L624~630 (Frontend `.next/cache` 비기능 GHA step 6줄) 제거 PR을 Architect가 병렬 디스패치 중(task-20260421-145147). 해당 PR 머지 시 본 ADR과 순서 독립적으로 머지 가능.

---

## [C] Frontend 빌드 최적화

> **상태: ❌ 미도입 결정 — Sensei 선자문(task-20260421-150311) 전 항목 제외. 코드 변경 없음.**

### 원안 계획

`.github/workflows/ci.yml`의 `test-frontend`/`build-frontend` 잡에 build step timing 기록 (`::notice` 또는 job summary) + `frontend/next.config.ts` 저복잡도 개선 3개 동시 적용:

1. `swcMinify: true` 명시 (Next.js 14+ 기본값이나 문서화 목적)
2. `experimental: { optimizePackageImports: ['@radix-ui/react-*', 'lucide-react'] }` — Radix-UI + lucide-react tree-shaking
3. `productionBrowserSourceMaps: false` + Sentry source-map upload만 유지

### 결정: 미도입 (Sensei 선자문 기반)

Sensei 선자문(task-20260421-150311) 결과, 저복잡도 3개 모두 Next.js 15.5.15 실측에서 적용 불가·중복·기본값으로 확인됐다. **트랙 [C] 조기 종결. 코드 변경 없음. Architect 디스패치 불필요.**

트랙 [B](Docker buildkit mode=max가 L2 역할 수행)와 동일한 패턴 재현: 선자문 → 전 항목 제외 → 즉시 종결.

### 구조적 발견 4건 (Sensei 선자문 리포트)

#### 발견 1: `swcMinify` — 완전 제거 (HARD BLOCK)

Next.js 15.5.15 `config-schema.js`·`config.js` 전체에서 `swcMinify` 항목이 **완전 제거**됐음을 grep 실측으로 확인:

```
grep -c "swcMinify" frontend/node_modules/next/dist/esm/server/config-schema.js  → 0
grep -c "swcMinify" frontend/node_modules/next/dist/esm/server/config.js         → 0
```

스키마가 `z.strictObject()`로 구성되어 있어 unknown key 포함 시 validation error 발생. `swcMinify` 추가 시:
- TypeScript 오류: `Object literal may only specify known properties`
- Runtime: `z.strictObject` 검증 실패 → 빌드 오류

판정: **HARD BLOCK — 문서화 목적으로도 추가 불가.**

#### 발견 2: `optimizePackageImports` — 대상 모두 기본 포함 + 와일드카드 미지원

`config.js L786~870` 직접 확인. 기본 포함 목록에 `lucide-react`·`recharts` 이미 포함. 소스 주석:

> `We don't support wildcard imports for these configs, e.g. react-icons/*`

| 계획 항목 | 실측 결과 | 판정 |
|---------|---------|------|
| `@radix-ui/react-*` | 와일드카드 미지원. Radix UI는 개별 패키지 구조(barrel file 없음) | 제외 |
| `lucide-react` | 기본 포함 목록에 이미 존재 → Set 중복, 효과 없음 | 제외 (중복) |

#### 발견 3: `productionBrowserSourceMaps` — 기본값 false

`config-schema.js L609`: `productionBrowserSourceMaps: z.boolean().optional()`. 기본값 `false`. 현재 미설정 = 이미 `false`.

Sentry 상호작용: `@sentry/nextjs` v10.47.0 webpack plugin이 `productionBrowserSourceMaps`와 **독립적으로** source map 생성 → 업로드 → 삭제. `false` 명시해도 symbolication 정상 동작. 충돌 없음.

판정: **제외 — 이미 기본값. 명시 효과 없음.**

#### 발견 4: CI build timing 직접 측정 불가 (트랙 [B] 발견 재확인)

트랙 [B] Sensei 분석 결론 재확인: `build-frontend` 잡은 완전한 Docker 전용 파이프라인. host-side `npm run build` 없음. `::notice` step을 추가해도 Next.js 빌드 시간을 직접 측정하는 대상이 없음.

| 옵션 | 측정 대상 | 정확도 | 판정 |
|------|---------|--------|------|
| A: Docker 잡 총 시간 | QEMU+buildx+push 포함 | 낮음 (희석) | 참고만 |
| B: Dockerfile RUN timestamp | Docker 내부 | 높음 | Sprint 107 이월 (Dockerfile 수정 필요) |
| C: host-side `npm run build` | `next build` 직접 | 최고 | Sprint 107 이월 (아키텍처 전환 필요) |
| **D: 로컬 번들 사이즈 분석** | 번들 사이즈 (타이밍 x) | 번들 정확 | **권고 — host-side 전환 없이 가능** |

### 원안 재조정 표

| 항목 | 원계획 | 판정 | 근거 |
|------|--------|------|------|
| `swcMinify: true` | 적용 | **HARD BLOCK** | `config-schema.js` count=0, `z.strictObject` 검증 실패 |
| `optimizePackageImports ['@radix-ui/react-*', 'lucide-react']` | 적용 | **제외** | 와일드카드 미지원 + 대상 모두 기본 포함 |
| `productionBrowserSourceMaps: false` | 적용 | **제외** | 이미 기본값 false |
| CI build timing 측정 (`::notice` step) | 구현 | **옵션 D 권고** | Docker 전용 구조 → host-side 측정 경로 없음 |

### 트랙 [C] 교훈

1. **Sensei 선자문 2회 발동([B], [C] 모두 조기 종결) — Sprint 105 "선자문 N=1 최적" 패턴이 "구현 0줄 결론"까지 진화** — Sprint 105에서 선자문은 Post 샘플 N을 1로 줄이는 최적화 도구였다. Sprint 106 [B]에서는 구현 자체를 불필요화했고, [C]에서는 동일 패턴이 반복됐다. 선자문은 "샘플링 최적화"를 넘어 "구현 필요성 게이트" 역할로 기능 확장을 2회 연속 증명했다.

2. **라이브러리 버전 업 시 기존 최적화 옵션이 기본값 승격되거나 제거되는 경우 다수 — 플랜 수립 단계 Explore만으로는 소스 레벨 실측 없이 정확도 부족** — `swcMinify`는 이전 버전 Next.js(14.x) 플랜 작성 당시에는 유효한 옵션이었으나, 15.5.15에서 config 스키마 자체에서 제거됐다. `optimizePackageImports` 대상도 버전 업마다 기본 포함 목록이 확장된다. 플랜 수립→실행 사이에 버전 업이 발생한 경우, "공식 문서 또는 소스 레벨(`node_modules/`) 직접 실측"이 정확성 보증의 유일한 방법임이 증명됐다.

3. **Docker 전용 구조는 L2 캐시(트랙 [B])뿐 아니라 빌드 타이밍 측정(트랙 [C])도 차단 — host-side 전환 여부 자체가 Sprint 107+ 근본 의사결정** — 트랙 [B]에서 발견된 "전 빌드 잡 Docker 전용" 제약이 트랙 [C] CI timing 측정에서도 동일하게 재확인됐다. 두 이월 항목이 같은 구조적 병목에서 기인한다. 이 제약을 해소하는 host-side 빌드 전환은 단일 최적화 PR이 아닌 아키텍처 의사결정 수준의 Sprint 107+ 작업이다.

### Sprint 107 시드 (트랙 [B] 시드와 통합)

트랙 [B] Sprint 107 시드 4건은 [B] 섹션 이월 항목에 등록돼 있다. 트랙 [C] Sensei 선자문 결과에서 파생된 추가 항목:

| 방안 | 전제 조건 | 설명 |
|------|---------|------|
| **Monaco Editor dynamic import 검증** | CSP `unsafe-eval` 현재 허용 중 | runtime 청크 분리, FCP 개선 가능성 |
| **`motion` (Framer Motion) `optimizePackageImports` 추가** | host-side 빌드 전환 후 | 기본 포함 목록 미포함 → 이득 가능성 |
| **heavy deps audit (`react-dnd`, `react-slick`)** | — | 대체 경량 라이브러리 평가 및 번들 사이즈 영향 |
| **번들 사이즈 기반 static 분석 (옵션 D)** | — | `next build` 로컬 실행만으로 가능 — host-side 전환 없이 즉시 착수 가능 |

---

## 작업 요약

| 작업 | 담당 | 상태 | 산출물 |
|---|---|---|---|
| [A] Sensei 실측 선자문 | Sensei | ✅ 완료 | `~/.claude/oracle/inbox/sensei-task-20260421-134249.md` |
| [A] 테스트 보강 + jest threshold 상향 | Architect | ✅ 머지 | PR #121 (`feat/sprint-106-coverage-frontend-tests`) |
| [A] CI 게이트 상향 + 서비스별 로그 강화 | Architect | ✅ 머지 | PR #122 (`feat/sprint-106-ci-coverage-gate-70`) |
| [A] CLAUDE.md 커버리지 문구 수정 | Gatekeeper | ✅ 머지 | PR #123 (`chore/docs: sprint-106-a3-claude-md`) |
| [A] Sprint 106 ADR [A] 섹션 | Scribe | ✅ 머지 | PR #124 (`chore/adr: sprint-106-adr-init`) |
| [B] Sensei L2 캐시 선자문 | Sensei | ✅ 완료 (중단 조건 충족) | `~/.claude/oracle/inbox/sensei-task-20260421-143704.md` |
| [B] Sprint 106 ADR [B] 섹션 | Scribe | ✅ 머지 | PR #125 (`chore/adr: sprint-106-track-b-close`) |
| [B] ci.yml L624~630 비기능 단계 제거 | Architect | ✅ 머지 | PR #126 (`chore/ci: sprint-106-track-b-cleanup`) |
| [C] Sensei 빌드 최적화 선자문 | Sensei | ✅ 완료 (조기 종결) | `~/.claude/oracle/inbox/sensei-task-20260421-150311.md` |
| [C] Sprint 106 ADR [C] 섹션 + Sprint 106 마감 | Scribe | ✅ 완료 | 이 PR (chore/sprint-106-adr-track-c-close) |

---

## 총평

Sprint 102~105 CI 리팩토링 4스프린트 로드맵(composite action 도입 → 확산 → rebuild_all 운영 규약 → commitlint 자동화) 마감 후 이월된 3항목을 Sprint 106에서 일괄 처리했다.

3 트랙 중 **[A]만 실구현**, **[B]/[C]는 Sensei 선자문 기반 미도입 결정**으로 마감했다. Sprint 105 "선자문 → 원안 축소" 교훈의 성숙된 발현이다. 선자문이 단순 샘플링 최적화 도구에서 "구현 필요성 게이트"로 기능 진화를 2회 연속([B], [C]) 증명했다.

결과: **누적 7 PR**, runner-minutes 대폭 절감, 잘못된 방향 진입 사전 차단. CI 빌드 구조(Docker 전용 파이프라인)의 근본 제약이 L2 캐시·빌드 타이밍 측정 두 항목 모두에 걸쳐 재확인됐으며, host-side 빌드 전환이 Sprint 107+ 핵심 의사결정 과제로 명확히 식별됐다.

---

## 이월 항목 (Sprint 107+)

### 트랙 [A] 후속

- **ai-analysis `branch = true` 활성화** — `pyproject.toml`에 `[tool.coverage.run] branch = true` 추가 → branches 축 실측 및 98% 달성 여부 검증 가능
- **submission/problem/identity lcov 로컬 실측 수집** — 현재 threshold 계약값만 있고 실측 margin 미확보. `npm test -- --coverage --ci` 로컬 실행으로 확보 가능
- **서비스별 독립 게이트 도입 검토** — `check-coverage.mjs`에 per-service threshold 설정으로 글로벌 단일 게이트의 한계(path-filter 오해 구조) 구조적 해소
- **글로벌 coverage 70% 안정화 검증** — Sprint 107 최초 frontend-only PR에서 coverage-gate 통과 여부 확인 (Sprint 106 [A] 완성도 검증)

### Sprint 107 시드 — 빌드 최적화 달성 경로 ([B]+[C] 통합)

host-side 빌드 전환이 L2 캐시(트랙 [B])·빌드 타이밍 측정(트랙 [C]) 두 이월 항목의 공통 전제 조건이다.

**아키텍처 전환 (선행 의사결정 필요):**

| 방안 | 설명 | 예상 효과 | 난이도 |
|------|------|----------|-------|
| **Blog host-side SSG 빌드** | CI에서 `npm ci + npm run build` on host → `out/` GHA cache → Docker는 `COPY out/` 전용 | MISS 시 40~60% 단축 | 중 (Dockerfile + ci.yml) |
| **Frontend host-side 빌드** | CI에서 `npm ci + npm run build` on host → `.next/standalone` GHA cache → Docker COPY only | MISS 시 40~60% 단축 | 중 (Dockerfile + ci.yml) |
| **`APK_CACHE_BUST` 조건화** | 보안 패치 필요 시만 apk invalidate (현재 매 run 강제 invalidate) | 20~30s/서비스 | 낮음 (보안 트레이드오프 결정 필요) |
| **NestJS tsc incremental** | host-side 빌드 전환 + `tsBuildInfoFile` 활용 | MISS 시 20~40% 단축 | 중~고 (Dockerfile 대수정) |

**host-side 전환 없이 즉시 착수 가능:**

| 방안 | 설명 |
|------|------|
| **번들 사이즈 static 분석 (옵션 D)** | `next build` 로컬 실행으로 번들 사이즈 기반 분석 가능 — CI 타이밍 측정과 독립 |
| **Monaco Editor dynamic import 검증** | CSP `unsafe-eval` 이미 허용 중 → runtime 청크 분리, FCP 개선 가능성 평가 |
| **`motion` (Framer Motion) `optimizePackageImports`** | 기본 포함 목록 미포함 → host-side 전환 후 이득 가능성 확인 |
| **heavy deps audit (`react-dnd`, `react-slick`)** | 대체 경량 라이브러리 평가 및 번들 사이즈 영향 측정 |

### 기존 이월 (Sprint 106 범위 외)

- **SWR/React Query 도입** — 프론트 데이터 페칭 표준화
- **Redis 통계 캐시** — 대시보드 통계 DB 직접 조회 → 캐시 전환
- **problem.tags JSON 컬럼 전환 + seed 데이터 확충**

---

## 교훈

트랙별 교훈은 각 섹션 내 "트랙 [X] 교훈" 서브섹션에 기록됨:
- 트랙 [A] 교훈 3건: [A] 섹션 내 "트랙 [A] 교훈"
- 트랙 [B] 교훈 3건: [B] 섹션 내 "트랙 [B] 교훈"
- 트랙 [C] 교훈 3건: [C] 섹션 내 "트랙 [C] 교훈"

### Sprint 106 공통 교훈

1. **선자문의 역할 확장 — "샘플링 최적화"에서 "구현 필요성 게이트"로** — Sprint 105에서 Sensei 선자문은 Post 샘플 N을 줄이는 최적화 도구였다. Sprint 106에서는 [B]·[C] 두 트랙에서 구현 자체를 0줄로 종결했다. 선자문 단계가 "어떻게 구현할까"가 아닌 "구현해야 하는가"를 판별하는 게이트 기능을 수행했다. 플랜 수립 단계에서 명시적 중단 조건과 짝을 이루면 이 기능이 극대화된다.

2. **라이브러리 버전 업 시 기본값 변화 실측의 필수성** — Next.js 14.x 기준 플랜에서 유효했던 `swcMinify`·`optimizePackageImports` 대상이 15.5.15에서 제거·기본 승격됐다. Explore 단계 공식 문서만으로는 버전 업 시 변화를 추적하기 어렵다. 실행 직전 `node_modules/` 소스 레벨 grep 실측이 정확도 보증의 유일한 방법임이 증명됐다.

3. **Docker 전용 아키텍처가 캐시·측정 모두에서 제약 조건 — Sprint 107+ host-side 전환이 핵심 의사결정** — L2 캐시(트랙 [B])와 빌드 타이밍 측정(트랙 [C])이 같은 근본 원인(Docker 전용 파이프라인, host-side 빌드 없음)에서 모두 불가 판정을 받았다. 이 제약의 해소는 단순 최적화 PR이 아니라 빌드 아키텍처 전환이라는 Sprint 107+ 의사결정이다. "왜 두 항목이 동시에 막혔는가"의 구조적 이해가 Sprint 107 방향 설정의 핵심 인풋이다.

---

## 레퍼런스

- Sprint 105 ADR: `docs/adr/sprints/sprint-105.md`
- Sprint 104 ADR: `docs/adr/sprints/sprint-104.md`
- 승인된 Sprint 106 실행 계획: `/Users/leokim/.claude/plans/iterative-hugging-reddy.md`
- Sensei [A] 실측 선자문 보고서: `~/.claude/oracle/inbox/sensei-task-20260421-134249.md`
- Sensei [B] L2 캐시 선자문 보고서: `~/.claude/oracle/inbox/sensei-task-20260421-143704.md`
- Sensei [C] 빌드 최적화 선자문 보고서: `~/.claude/oracle/inbox/sensei-task-20260421-150311.md`
- Architect 구현 보고서: `~/.claude/oracle/inbox/architect-task-20260421-135617.md`
- rebuild_all 런북: `docs/runbook-ci-rebuild-all.md`
- 채널톡 CI 리팩토링: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- PR #121 (A-1 테스트 보강): https://github.com/tpals0409/AlgoSu/pull/121
- PR #122 (A-2 CI 게이트 70%): https://github.com/tpals0409/AlgoSu/pull/122
- PR #123 (A-3 CLAUDE.md): https://github.com/tpals0409/AlgoSu/pull/123
- PR #124 (ADR [A] 섹션): https://github.com/tpals0409/AlgoSu/pull/124
- PR #125 (ADR [B] 섹션): https://github.com/tpals0409/AlgoSu/pull/125
- PR #126 ([B] ci.yml 정리): https://github.com/tpals0409/AlgoSu/pull/126
