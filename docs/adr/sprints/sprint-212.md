---
sprint: 212
title: "NEXT_PUBLIC_BASE_URL 도메인 정합 + SEO 점검 (algosu.kr → algo-su.com)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-210", "sprint-211"]
related_memory: ["sprint-window", "project-deploy-and-domain"]
topics: ["frontend", "seo", "i18n", "config"]
tldr: "프로젝트 config의 NEXT_PUBLIC_BASE_URL이 죽은 도메인 algosu.kr(HTTP 000)을 가리키고 Dockerfile에 이 변수가 미주입되어, 프로덕션 빌드가 코드 폴백 algosu.kr을 번들에 인라인 → 라이브(algo-su.com)의 sitemap/robots/canonical/hreflang/OG가 죽은 도메인을 가리키는 SEO 실손해를 교정했다. 코드 폴백 4곳 + JSDoc 예제 + 테스트 단언 + .env.example을 algo-su.com으로 정합하고, GA4/AdSense 선례대로 Dockerfile에 ENV NEXT_PUBLIC_BASE_URL을 명시 주입(암묵 폴백 의존 제거)했다. 빌드 산출물 sitemap.xml/robots.txt가 algo-su.com을 출력함을 직접 검증."
---
# Sprint 212 — NEXT_PUBLIC_BASE_URL 도메인 정합 + SEO 점검 (algosu.kr → algo-su.com)

## 목표

- 실 라이브 도메인(`algo-su.com`)과 불일치하는 `NEXT_PUBLIC_BASE_URL` 기본값(`algosu.kr`)을 정합한다.
- sitemap / robots / canonical / hreflang / Open Graph 등 SEO 산출물이 죽은 도메인을 가리키는 문제를 교정한다.
- 프로덕션 빌드가 올바른 도메인을 번들에 인라인하도록 보장한다.

## 배경

Sprint 210 GA4 통합 작업 중, 실 서비스 도메인은 **`algo-su.com`**(HTTP 200)인 반면 프로젝트 설정 `frontend/.env.example`의 `NEXT_PUBLIC_BASE_URL`은 `https://algosu.kr`(HTTP 000, 응답 없음)로 되어 있는 불일치가 발견되었다 ([sprint-210](./sprint-210.md), [project-deploy-and-domain](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-deploy-and-domain.md)). <!-- doc-ref-lint: ignore -->

조사 결과 두 가지 문제 층위가 확인되었다.

1. **코드 폴백 드리프트** — `process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr'` 폴백이 4곳에 중복되어 있고 모두 죽은 도메인을 기본값으로 사용:
   - `src/app/sitemap.ts:14` — sitemap URL + ko/en hreflang
   - `src/app/robots.ts:13` — sitemap.xml 링크
   - `src/app/[locale]/layout.tsx:32` — `metadataBase` (모든 OG/twitter URL 기준)
   - `src/lib/i18n/metadata.ts:40` — canonical + hreflang alternates
2. **Dockerfile 미주입** — 프로덕션 `frontend/Dockerfile`에 `NEXT_PUBLIC_BASE_URL`이 주입되지 않아, 빌드 타임에 코드 폴백 `algosu.kr`이 그대로 번들에 인라인됨. 즉 **현재 라이브의 SEO 산출물이 죽은 도메인을 가리키고 있었다** (SEO 실손해 — canonical 권한 분산, sitemap/robots 비-라이브 도메인 크롤링 유도).

JSON-LD 구조화 데이터와 명시적 og:image는 코드에 없어 본 작업 범위 밖이다.

## 결정

### D0. 폴백 교정 + Dockerfile 명시 주입 (Option B)

두 가지 접근이 검토되었다.

- **옵션 A**: 코드 폴백 기본값만 `algo-su.com`으로 교정. 프로덕션은 폴백을 통해 올바른 도메인을 얻지만 **암묵적**.
- **옵션 B**: 폴백 기본값 교정 + Dockerfile에 `ENV NEXT_PUBLIC_BASE_URL` 명시 주입. GA4(`G-NMNVNCKW37`)·AdSense 선례와 일관된 **명시적** 주입 + dev/test/비-Docker 빌드까지 안전한 기본값 보장.

**결정: 옵션 B.** 폴백만 고치면 프로덕션 도메인이 암묵적(Dockerfile만 봐서는 알 수 없음)이고, Dockerfile만 고치면 dev/test 기본값과 `.env.example`이 불일치한다. 두 변경 모두 저렴하므로 양쪽을 정합한다. `NEXT_PUBLIC_BASE_URL`은 공개 클라이언트 값(번들에 인라인되어 브라우저 노출)이므로 SealedSecret이 불요하다 — GA4 측정 ID·AdSense client ID와 동일한 공개값 선례.

### D1. dev/demo 목 이메일은 범위 제외

`src/contexts/AuthContext.tsx:107`(`dev@algosu.kr`)·`src/components/layout/AppLayout.tsx:512`(`demo@algosu.kr`)의 목 이메일은 SEO와 무관한 내부 식별자다. 데모 배너 노출 조건이 `user?.email === 'demo@algosu.kr'` 동등 비교에 의존하므로, 한쪽만 수정하면 배너가 파손된다. **본 작업 범위에서 의도적으로 제외**한다.

### D2. 의존성 무변경 — npm install 금지

본 작업은 문자열 리터럴 교정 + Dockerfile ENV 1줄 추가뿐으로 신규 npm 패키지가 없다. [sprint-210](./sprint-210.md)의 lockfile prune 재발을 차단하기 위해 `npm install`을 실행하지 않으며, `package.json`/`package-lock.json`을 변경하지 않는다. 검증은 `npm ci`로 CI 환경을 재현한다.

## 구현

### Phase A — 코드 폴백 정합 (Architect)

`'https://algosu.kr'` → `'https://algo-su.com'`:

- `src/app/sitemap.ts:14` — `BASE_URL` 폴백
- `src/app/robots.ts:13` — `BASE_URL` 폴백
- `src/app/[locale]/layout.tsx:32` — `metadataBase` 폴백
- `src/lib/i18n/metadata.ts:40` — `baseUrl` 폴백
- `src/lib/i18n/metadata.ts:27~31` — `buildLocaleAlternates` JSDoc 예제 (문서 정확성)

### Phase B — 테스트 단언 정합 (Architect)

`src/lib/i18n/__tests__/metadata.test.ts` — 환경 변수 미설정 시 기본값 단언:

- L32: `expect(result?.canonical).toBe('https://algo-su.com/')`
- L38: `x-default` 단언 `'https://algo-su.com/problems'`

### Phase C — 설정/빌드 정합 (Architect)

- `.env.example:5` — `NEXT_PUBLIC_BASE_URL=https://algo-su.com`
- `Dockerfile` — GA4 ENV 블록 다음에 `ENV NEXT_PUBLIC_BASE_URL=https://algo-su.com` 추가 (빌드 타임 번들 인라인)

### Phase D — Critic R1 후속: 법무 연락처 이메일 정합

초기 SEO grep은 `src`·`.env.example`·`Dockerfile`만 점검해 `messages/` 디렉토리를 놓쳤다. Critic R1(Codex)이 `messages/ko/legal.json:50`·`messages/en/legal.json:50`의 개인정보처리방침 §7 연락처가 죽은 도메인 `privacy@algosu.kr`(메일 수신 불가)을 그대로 노출하고 있음을 포착했다. 이는 내부 식별자가 아닌 **사용자 노출 법무 연락처**이므로 도메인 정합 범위에 해당한다.

사용자 결정에 따라 단순 도메인 치환(`privacy@algo-su.com`)이 아닌 실 운영 이메일 `tpalsdlapfnd@gmail.com`으로 교체했다 (메일박스 존재가 보장된 주소 — 도메인 일치보다 실제 수신 가능성 우선). 내부 dev/demo 목 이메일 2건은 D1대로 범위 제외.

## 검증

Oracle 직접 검증 (`npm ci` 기반 CI 환경 재현):

- `npm ci` → EXIT=0, 1064 패키지 (lockfile 무변경 — 의존성 드리프트 없음)
- `npx tsc --noEmit` → EXIT=0, 오류 0건
- `npx next lint` (raw) → EXIT=0. SEO 변경 파일(sitemap/robots/metadata/layout) 신규 warning 0건 (기존 UI 컴포넌트·hooks의 inline-style / exhaustive-deps warning만 잔존, 본 변경과 무관)
- `npx next build` → EXIT=0, ✓ Compiled 8.4s
- `npx jest --coverage` → EXIT=0, 1390 PASS / 0 FAIL, 글로벌 임계값(lines 83 / branches 71 / functions 82 / statements 81) 충족

### 빌드 산출물 도메인 검증 (직접)

```
.next/server/app/sitemap.xml.body:
  <loc>https://algo-su.com/</loc>
  <xhtml:link rel="alternate" hreflang="ko" href="https://algo-su.com/" />
  <xhtml:link rel="alternate" hreflang="en" href="https://algo-su.com/en/" />

.next/server/app/robots.txt.body:
  Sitemap: https://algo-su.com/sitemap.xml
```

- SEO 산출물(sitemap/robots)에서 `algosu.kr` 잔존 **0건**, 모두 `algo-su.com`
- 초기 grep은 SEO 코드만 점검했으나 Critic R1이 `messages/{ko,en}/legal.json`의 사용자 노출 법무 연락처를 추가 포착 → Phase D에서 정합. **최종적으로** `frontend` 내 `algosu.kr` 잔존은 dev/demo 목 이메일 2건만(D1 의도적 제외)

### ADR 인덱스 게이트

- `node scripts/check-adr-index-count.mjs --strict` → 영구 8 / 토픽 1 / sprint **150**
- `node scripts/check-adr-en-coverage.mjs --lint` → **159/159 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max 2.19% (임계 8% 이내)

## 교훈

1. **공개 env 폴백의 도메인 드리프트는 사일런트 SEO 실손해** — `NEXT_PUBLIC_BASE_URL`처럼 빌드 타임에 번들로 인라인되는 공개 변수는, Dockerfile에 미주입되면 코드 폴백이 그대로 프로덕션에 박힌다. 폴백이 죽은 도메인을 가리켜도 빌드/테스트는 통과하므로 런타임·CI 신호 없이 라이브 SEO만 조용히 손상된다. 라이브 도메인 변경 시 `NEXT_PUBLIC_*` 폴백과 Dockerfile 주입을 동시에 점검해야 한다.
2. **폴백 기본값 + 명시 주입은 둘 다 정합해야 한다** — 폴백만 고치면 프로덕션 도메인이 암묵적이고, Dockerfile만 고치면 dev/test·`.env.example`이 불일치한다. 공개 env는 (a) 코드 폴백을 실 기본값으로, (b) Dockerfile에 명시 주입, 두 층을 함께 맞춰야 드리프트가 재발하지 않는다.
3. **동일 폴백 리터럴 4곳 중복은 재드리프트 위험** — `?? 'https://...'` 폴백이 sitemap/robots/layout/metadata 4곳에 복제되어 있어, 도메인 변경 시 한 곳을 놓치면 부분 정합으로 끝난다. 빌드 산출물 grep(`algosu.kr` 잔존 0건)으로 전수 정합을 검증하는 것이 안전하다. (중앙화는 Sprint 213+ 후보)
4. **빌드 산출물 직접 검증이 코드 검증을 보완** — tsc/lint/test 통과는 "코드가 올바른 폴백을 읽는다"만 보장한다. 실제 SEO 효과는 `.next/server/app/sitemap.xml.body`·`robots.txt.body`를 직접 grep하여 출력 도메인을 확인해야 종단 보장된다.

## 신규 패턴

- **공개 env 도메인 정합 패턴** — 라이브 도메인 변경 시 (a) 모든 코드 폴백 기본값 교정, (b) Dockerfile `ENV` 명시 주입, (c) `.env.example` 정합, (d) 빌드 산출물 grep으로 전수 검증 4단계를 함께 수행. 폴백·주입 한쪽만 고치면 암묵/불일치 드리프트.
- **SEO 산출물 빌드 검증 패턴** — sitemap/robots/canonical 변경 시 `.next/server/app/sitemap.xml.body`·`robots.txt.body`를 직접 읽어 출력 도메인·hreflang을 확인. 코드 레벨 검증(폴백 값)과 산출물 레벨 검증(실제 출력)을 분리.

## Sprint 213+ 이월

- **서버 재배포 + 라이브 검증** (사용자/운영): merge ≠ 라이브 반영(빌드 자동/롤아웃 수동 ops, [project-deploy-and-domain](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-deploy-and-domain.md)). 재배포 후 `curl https://algo-su.com/sitemap.xml`·`robots.txt`로 라이브 도메인 정합 확인 <!-- doc-ref-lint: ignore -->
- **GA4 데이터 스트림 URL 정합** (사용자): GA4 admin 콘솔에서 스트림 URL을 `algo-su.com`으로 맞춤
- **폴백 리터럴 중앙화 검토** (Sprint 213+ 후보): 4곳 중복 폴백을 단일 헬퍼(`getBaseUrl()`)로 중앙화하여 재드리프트 차단
- **GA4 admin Enhanced Measurement history page_view OFF** (사용자, Sprint 211 이월 지속)
- **GA4 프로덕션 page_view UAT** (사용자, Sprint 210/211 이월 지속)
- **운영 Sprint 196 마이그레이션 실행** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토** (Sprint 209 이월 지속)

## Critic 교차 리뷰

**R1 — P3 1건** (Codex, `codex review --base ae25f51`)

> "[P3] Correct the remaining algosu.kr inventory — `docs/adr/sprints/sprint-212.md:101`. This verification note is inaccurate: `frontend/messages/en/legal.json` and `frontend/messages/ko/legal.json` still contain the user-facing `privacy@algosu.kr` contact address, so the remaining frontend occurrences are not limited to the two dev/demo mock emails."

런타임 코드/설정 변경은 의도(도메인 전환)와 일관됨(no blocking). 유일한 지적은 SEO 코드 grep이 놓친 `messages/{ko,en}/legal.json`의 사용자 노출 법무 연락처가 죽은 도메인을 유지한다는 **비블로킹 P3** 1건. → **Phase D에서 근본 해소**(사용자 지정 운영 이메일로 교체) + 본 ADR 인벤토리 정정.

**R2 — CLEAN** (Codex, `codex review --base ae25f51`, Phase D 반영 후 재검토)

> "The changes consistently update the public base URL fallbacks, Docker build-time environment, examples, and tests to the new domain. I did not find a discrete regression or blocking issue in the modified lines."

발견 Critical / High / Medium / Low **모두 0건**. R1 P3가 Phase D에서 해소됨을 확인.
