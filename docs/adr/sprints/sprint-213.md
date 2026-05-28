---
sprint: 213
title: "NEXT_PUBLIC_BASE_URL 폴백 리터럴 중앙화 (getBaseUrl SSOT)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-212", "sprint-210"]
related_memory: ["sprint-window", "project-deploy-and-domain"]
topics: ["frontend", "seo", "i18n", "refactor"]
tldr: "Sprint 212에서 식별된 재드리프트 위험을 해소했다. NEXT_PUBLIC_BASE_URL 폴백 `?? 'https://algo-su.com'`이 sitemap/robots/[locale]layout/i18n metadata 4곳에 중복되어 있어 도메인 변경 시 한 곳을 놓치면 부분 정합으로 끝나는 위험이 있었다. 폴백 리터럴을 전용 모듈 frontend/src/lib/site-url.ts의 단일 상수 DEFAULT_BASE_URL + getBaseUrl() 헬퍼로 중앙화(유일 SSOT)하고, 4곳 호출처를 헬퍼 호출로 치환했다. getBaseUrl은 모듈 캐싱 없이 호출마다 process.env를 평가하는 단순 함수라, sitemap/robots/layout의 import-time 평가와 metadata의 call-time 평가(env override 테스트) 양쪽 평가 시점이 그대로 보존된다. 빌드 산출물 sitemap.xml/robots.txt가 algo-su.com만 출력하고 algosu.kr 잔존이 0건임을 직접 검증."
---
# Sprint 213 — NEXT_PUBLIC_BASE_URL 폴백 리터럴 중앙화 (getBaseUrl SSOT)

## 목표

- Sprint 212에서 식별된 **재드리프트 위험**을 구조적으로 해소한다.
- `NEXT_PUBLIC_BASE_URL` 폴백 리터럴이 4곳에 중복된 것을 단일 헬퍼(`getBaseUrl()`)로 중앙화(SSOT)한다.
- 각 호출처의 평가 시점(import-time vs call-time)과 기존 테스트(env override) 동작을 그대로 보존한다.

## 배경

[Sprint 212](./sprint-212.md)에서 `NEXT_PUBLIC_BASE_URL`의 폴백 기본값을 죽은 도메인 `algosu.kr`에서 실 라이브 도메인 `algo-su.com`으로 정합했다. 그 과정에서 동일 폴백 표현식 `process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algo-su.com'`이 4곳에 **그대로 복제**되어 있어, 도메인을 한 번 더 바꾸면 4곳을 모두 동시에 수정해야 하고 한 곳을 놓치면 부분 정합으로 끝나는 위험이 드러났다 (Sprint 212 교훈 3 — "동일 폴백 리터럴 4곳 중복은 재드리프트 위험", Sprint 213+ 중앙화 후보로 이월).

중복된 4곳:

- `src/app/sitemap.ts:14` — `BASE_URL` (sitemap URL + ko/en hreflang)
- `src/app/robots.ts:13` — `BASE_URL` (sitemap.xml 링크)
- `src/app/[locale]/layout.tsx:31` — `metadataBase` (모든 OG/twitter URL 기준)
- `src/lib/i18n/metadata.ts:40` — `baseUrl` (canonical + hreflang alternates, `buildLocaleAlternates` 내부)

이번 작업은 동작을 바꾸지 않는 순수 리팩토링으로, 폴백 리터럴이 정의되는 지점을 단일 SSOT로 모은다.

## 결정

### D0. 헬퍼 위치 — 전용 모듈 신설 `frontend/src/lib/site-url.ts`

두 가지 위치가 검토되었다.

- **대안**: 기존 `src/lib/i18n/metadata.ts`에 `getBaseUrl()`을 추가. 그러나 `robots.ts`·`sitemap.ts`가 **i18n 도메인 파일을 import**하게 되어 도메인이 어긋난다 (사이트 URL은 i18n보다 넓은 사이트 전역 관심사). 부자연스러운 의존을 회피하기 위해 기각.
- **결정**: 사이트 URL 전용 common 모듈 `src/lib/site-url.ts`를 신설한다 (`@domain common`). 사이트 URL은 i18n·sitemap·robots·layout 모두가 공유하는 사이트 전역 관심사이므로, 별도 common 모듈이 단일 책임(SRP)에 부합한다.

### D1. 핵심 설계 제약 — 캐싱 없는 단순 함수 (평가 시점 보존)

`getBaseUrl()`은 **모듈 스코프 캐싱 없이** 호출 시마다 `process.env`를 평가하는 단순 함수다 (`return process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_BASE_URL`). 폴백 리터럴 `'https://algo-su.com'`은 `DEFAULT_BASE_URL` 상수로 `site-url.ts`에만 1회 정의되어 **유일 SSOT**다.

캐싱을 두지 않음으로써 각 호출처의 평가 시점이 그대로 보존된다.

| 호출처 | 사용 형태 | 평가 시점 |
|--------|-----------|-----------|
| `sitemap.ts:14` | `const BASE_URL = getBaseUrl()` | 모듈 레벨 const → **import-time** (유지) |
| `robots.ts:13` | `const BASE_URL = getBaseUrl()` | 모듈 레벨 const → **import-time** (유지) |
| `[locale]/layout.tsx:31` | `new URL(getBaseUrl())` | 모듈 레벨 메타데이터 → **import-time** (유지) |
| `i18n/metadata.ts:40` | `const baseUrl = getBaseUrl()` (`buildLocaleAlternates` 내부) | 함수 내부 → **call-time** (유지) |

`metadata.ts`의 call-time 평가가 보존되므로, `metadata.test.ts`의 환경 변수 override 검증이 그대로 통과한다 (모듈 캐싱이 있었다면 깨졌을 동작).

### D2. 의존성 무변경 — npm install 금지

본 작업은 헬퍼 모듈 신설 + import/치환뿐으로 신규 npm 패키지가 없다. [Sprint 210](./sprint-210.md)의 lockfile prune 재발을 차단하기 위해 `npm install`을 실행하지 않으며, `package.json`/`package-lock.json`을 변경하지 않는다. 검증은 `npm ci`로 CI 환경을 재현한다.

## 구현

architect 단일 atomic commit `b74f1f4` (`refactor(frontend): centralize NEXT_PUBLIC_BASE_URL fallback into getBaseUrl SSOT`).

### 신규 파일 (2개)

- `src/lib/site-url.ts` — `DEFAULT_BASE_URL` 상수(폴백 리터럴 유일 정의) + `getBaseUrl()` 헬퍼. 파일 헤더 `@domain common` / `@layer lib`, 함수 JSDoc에 평가 시점·nullish coalescing(빈 문자열은 falsy로 보지 않고 그대로 반환) 명시.
- `src/lib/__tests__/site-url.test.ts` — 3 케이스:
  - env 설정 시 → 그 값 반환
  - env 미설정 시 → 폴백 `https://algo-su.com` 반환
  - 빈 문자열(`''`) 설정 시 → nullish coalescing이 빈 문자열을 그대로 반환

  branch coverage 100%. `getBaseUrl`이 호출 시점에 env를 읽으므로 각 테스트 후 env 원복만 하면 충분(모듈 리셋 불요).

### 수정 파일 (4개)

각 파일에 `import { getBaseUrl } from '@/lib/site-url';`를 추가하고 폴백 표현식을 헬퍼 호출로 치환:

- `sitemap.ts:14` — `const BASE_URL = getBaseUrl()` (import-time 평가 유지)
- `robots.ts:13` — `const BASE_URL = getBaseUrl()` (import-time 평가 유지)
- `[locale]/layout.tsx:31` — `metadataBase: new URL(getBaseUrl())` (import-time 평가 유지)
- `i18n/metadata.ts:40` — `const baseUrl = getBaseUrl()` (call-time 평가 유지) + `buildLocaleAlternates` JSDoc을 헬퍼 위임 사실에 맞게 일관성 조정

신규 의존성이 없으므로 `package.json`/`package-lock.json` 무변경 (D2).

## 검증

Oracle 직접 검증 (`npm ci` 기반 CI 환경 재현):

- `npm ci` → EXIT=0 (lockfile 정합 — prune 0건, 의존성 드리프트 없음)
- `npx tsc --noEmit` → No errors found (0)
- `npx next lint` (raw) → 0 errors / 0 warnings (변경 파일 신규 warning 0)
- `npx next build` → ✓ Compiled successfully, static pages 5/5 생성 (RTK 요약의 "Errors: 2"는 `@sentry/nextjs` 설정 안내 메시지의 오집계 — 실제 빌드 정상)
- `npx jest --coverage` → 135 suites / 1393 tests PASS (기존 1390 + 신규 3). `site-url.ts` **100%** (stmt/branch/func/line), `metadata.ts` 100% 유지, All files 86.47% stmt / 78.36% branch — 글로벌 임계값(lines 83 / branches 71 / functions 82 / statements 81) 충족

### 빌드 산출물 도메인 검증 (직접)

```
.next/server/app/sitemap.xml.body:
  <loc>https://algo-su.com/</loc>  (algosu.kr 잔존 0건)
  hreflang ko 7 + en 7 (7페이지 × 2 locale)

.next/server/app/robots.txt.body:
  Sitemap: https://algo-su.com/sitemap.xml
```

- SEO 산출물(sitemap/robots)에서 `algosu.kr` 잔존 **0건**, 모두 `algo-su.com`
- 코드가 헬퍼를 읽는 것과 실제 SEO 출력 도메인은 별개 층이므로, 헬퍼 중앙화 후에도 산출물 grep으로 출력 도메인을 종단 확인

### ADR 인덱스 게이트

- `node scripts/check-adr-index-count.mjs` → sprint **151**
- `node scripts/check-adr-en-coverage.mjs` → **160/160 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs` → prose Hangul 임계(8%) 이내

## 교훈

1. **공개 env 폴백 리터럴 중복은 재드리프트 위험의 근본 원인** — Sprint 212에서 도메인을 정합할 때 동일 폴백을 4곳에서 동시에 수정해야 했던 이유가 바로 이 중복이었다. 단일 SSOT 헬퍼로 모으면 다음 도메인 변경 시 1곳(`DEFAULT_BASE_URL`)만 수정하면 모든 호출처에 반영되어 부분 정합 위험이 사라진다.
2. **평가 시점은 헬퍼를 "캐싱 없는 단순 함수"로 만들면 자연히 보존된다** — 모듈 스코프 캐싱을 두면 import-time에 1회 평가되어 `metadata.ts`의 call-time env override 테스트가 깨진다. 헬퍼가 매 호출마다 `process.env`를 읽으면, 모듈 레벨 const 호출처는 import-time, 함수 내부 호출처는 call-time으로 각자의 평가 시점이 그대로 유지된다.
3. **빌드 산출물 직접 grep이 코드 검증을 보완** — tsc/lint/test 통과는 "호출처가 헬퍼를 올바르게 읽는다"만 보장한다. 헬퍼 중앙화는 코드 레벨 변경이므로, 실제 SEO 출력 도메인은 여전히 `.next/server/app/sitemap.xml.body`·`robots.txt.body`를 직접 grep하여 종단 확인해야 한다.

## 신규 패턴

- **공개 env 기본값 SSOT 헬퍼 패턴** — 빌드 타임에 인라인되는 공개 env(`NEXT_PUBLIC_*`)의 폴백 리터럴을 여러 호출처에 복제하지 말고, 단일 상수(`DEFAULT_BASE_URL`) + 단순 함수(`getBaseUrl()`)로 중앙화한다. 함수는 모듈 캐싱 없이 매 호출마다 env를 평가하므로, 호출처는 자신의 평가 시점(import-time const / call-time 함수 내부)을 그대로 유지한 채 헬퍼를 호출한다. 도메인/기본값 변경은 SSOT 상수 1곳만 수정한다.

## Sprint 214+ 이월

- **서버 재배포 + 라이브 SEO 검증** (사용자/운영): merge ≠ 라이브 반영(빌드 자동/롤아웃 수동 ops, [project-deploy-and-domain](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-deploy-and-domain.md)). 재배포 후 `curl https://algo-su.com/sitemap.xml`·`robots.txt`로 라이브 도메인 정합 확인 <!-- doc-ref-lint: ignore -->
- **GA4 데이터 스트림 URL 정합** (사용자): GA4 admin 콘솔에서 스트림 URL을 `algo-su.com`으로 맞춤
- **GA4 admin Enhanced Measurement history page_view OFF** (사용자, Sprint 211 이월 지속)
- **GA4 프로덕션 page_view UAT** (사용자, Sprint 210/211 이월 지속)
- **운영 Sprint 196 마이그레이션 실행** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토** (Sprint 209 이월 지속)

## Critic 교차 리뷰

**R1 — CLEAN** (Codex, `codex review --base 87c983c`, codex-cli 0.130.0 / gpt-5 계열, session `019e6e92-77d6-7a33-af5c-caff700744ab`)

> "The changes centralize the base URL fallback without altering the observable behavior of the existing call sites. I did not find any introduced correctness, security, performance, or maintainability issue that warrants an inline finding."

발견 Critical / High / Medium / Low **모두 0건**. 폴백 중앙화가 기존 호출처의 관측 동작(import-time/call-time 평가 시점, env override)을 바꾸지 않는 순수 리팩토링임을 확인.
