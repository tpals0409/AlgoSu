---
sprint: 179
title: "프론트엔드 구글 광고(AdSense) 코드 전면 제거"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-122"]
related_memory: ["sprint-window"]
---
# Sprint 179 — 프론트엔드 구글 광고(AdSense) 코드 전면 제거

## 목표

- 광고가 실제로 들어오지 않아 `.ad-container`가 "광고" 라벨 + 빈 박스 형태로 9개 페이지 하단/사이드바에 노출되어, 광고 수익은 0인데 **빈 영역만 남아 사용자 UX를 해치는 상태**였다.
- AdSense 인프라(컴포넌트·스크립트·슬롯·CSS·env·CSP·ads.txt·i18n·법무 텍스트)를 프론트엔드에서 **전면 제거**한다. 정석 사이클(단일 작업 브랜치 + PR + Squash merge + Critic) 준수.

## 결정

### D1. 코드 제거를 넘어 광고 인프라 전체를 추적 제거 (사용자 승인)

광고 기능은 단일 컴포넌트가 아니라 여러 계층에 퍼진 인프라였다 — `AdBanner` 컴포넌트, `AD_SLOTS` 상수, `layout.tsx`의 AdSense `<Script>` 로더, `.ad-container` CSS, `common.json`의 `ad` 네임스페이스, 테스트 mock 4곳, `next.config.ts`·`ingress.yaml` CSP 허용 도메인, `.env.example` 환경변수, `public/ads.txt`(publisher 검증). "AdBanner 제거"만으로는 dead 코드/dead 권한이 남으므로, **데이터·설정·문서 전 계층을 grep 스윕으로 추적**해 제거했다.

### D2. CSP 광고 도메인을 dead permission으로 제거 (보안 강화)

`next.config.ts`(script-src/img-src/connect-src/frame-src)와 `infra/k3s/ingress.yaml`(script-src)에 열려 있던 googlesyndication/doubleclick/googleads/googletagservices/adservice 허용은 광고를 안 띄우는 한 **불필요하게 넓은 권한**이다. 광고 제거와 함께 CSP에서 걷어내 공격 표면을 좁혔다. `frame-src` 지시어는 광고 전용이었으므로 통째로 제거 → `default-src 'self'` fallback으로 더 엄격해진다.

### D3. 개인정보처리방침/법무 텍스트의 AdSense 언급 제거 (정확성, 사용자 승인)

광고를 운영하지 않게 되면 "Google에 비식별 정보 전달"·"광고 게재 목적 수집"·"AdSense 제3자 쿠키" 같은 법무 문구가 **사실과 달라진다**. 코드만 지우고 정책 텍스트를 남기면 부정확한 고지가 된다. `legal.json`(ko/en)의 section2.item5(수집 목적 "광고 게재")·section4.adsense(제3자 제공)·section5 본문(쿠키 정책)과 `privacy/page.tsx`의 해당 렌더링을 함께 제거했다. 단, section3.item2의 "표시·광고에 관한 기록(전자상거래법 6개월)"은 AdSense가 아닌 일반 법정 보존 조항이므로 보존.

## 구현

### PR #311 — 구글 광고 코드 전면 제거 (26파일 +9/-258)

- **파일 삭제(3)**: `components/ad/AdBanner.tsx`, `lib/constants/adSlots.ts`, `public/ads.txt`.
- **페이지 9곳**: LandingContent·dashboard·problems·problems/[id]·submissions·submissions/[id]/analysis·analytics·profile·studies에서 `AdBanner`/`AD_SLOTS` import + 사용 제거.
- **`layout.tsx`**: AdSense `<Script>` 블록·`adsenseEnabled`/`adsenseClientId` 상수·`import Script`·doc 주석 제거.
- **테스트 mock(4)**: studies·sql-auto-language·[locale]/page·analysis 테스트의 `AdBanner`/`adSlots` jest.mock 제거(assertion 사용처 0건이라 안전).
- **i18n/CSS**: `common.json`(ko/en) `ad` 네임스페이스, `globals.css` `.ad-container`/`::before`.
- **CSP/env**: `next.config.ts`·`ingress.yaml` 광고 도메인, `.env.example` `NEXT_PUBLIC_ADSENSE_*`.
- **법무**: `legal.json`(ko/en) 3곳 + `privacy/page.tsx` 2곳.

## Critic 사이클

`codex review --base main` 1라운드 (session `019e4560-0a28-72c3-8a5e-c4ecfcab8f52`): **0건** — "변경이 AdSense 스크립트 로딩·배너 사용·슬롯 상수·스타일·ads.txt·CSP 허용·번역/법무 카피를 일관되게 제거하며, 빌드/런타임을 깨뜨릴 잔여 참조가 없음". 머지 가능.

## 검증

### 로컬
- `tsc --noEmit` 통과.
- ESLint 0 errors / 0 warnings.
- jest 1361 통과 / 0 실패 (test case 변동 없음 — mock 선언만 제거).
- 커버리지: Lines 86.88%(≥83), Branches 78.19%(≥71), JEST_EXIT=0.
- 잔여 참조 grep 스윕(adsense/adsbygoogle/googlesyndication/pagead/doubleclick/AD_SLOTS/AdBanner/ad-container): 소스 0건.

### CI
- PR #311 전 job green.

## 결과

- **머지**: origin/main `838e51c` → `464836f` (PR #311 squash merge, 작업 브랜치 삭제).
- **순변경**: 26파일 +9/-258 (3파일 완전 삭제).

## 신규 패턴

- **기능 제거 = 촉수 추적**: 한 기능을 지우려면 컴포넌트뿐 아니라 그것이 뻗은 모든 계층(env, CSP, 생성 파일, i18n, 법무 텍스트, 인프라 매니페스트)을 추적해야 한다. 코드 import 그래프만 따라가면 CSP·법무·env 같은 비-import 참조를 놓친다 — infra/messages/docs까지 포함한 grep 스윕이 필수.
- **기능 제거 시 법무/정책 텍스트 동반 갱신**: 사용자 대면 기능을 제거하면 그것을 설명하던 개인정보처리방침/약관도 함께 갱신해야 정확성이 유지된다. 코드 제거와 정책 제거는 한 PR로 묶는다.
- **빈 조건부 UI는 무(無) UI보다 나쁘다**: 광고 로드 실패 시 빈 박스를 남기는 UI는 차라리 영역이 없는 것보다 사용자 경험을 해친다. 들어오지 않는 외부 의존 콘텐츠 영역은 빈 채로 두지 말고 제거한다.

## 교훈

- **"코드 지우기"가 사실 인프라 제거였다**: 단순히 컴포넌트 1개를 지우는 작업으로 보였으나, 착수 탐색에서 9페이지·layout·CSP(2곳)·env·법무(5곳)·생성 파일까지 26개 파일에 걸친 인프라임이 드러났다. 제거 작업도 추가 작업만큼 데이터 흐름/설정 흐름 전수 추적이 필요하다.
- **dead permission은 보안 부채**: 광고를 안 띄우는데 CSP에 광고 도메인이 열려 있던 것은 불필요한 공격 표면이었다. 기능 제거는 권한 축소(공격 표면 감소)의 기회다.

## 이월 항목 (Sprint 180+)

- **UAT 사용자 직접**: 각 페이지 하단/사이드바 빈 광고 영역 소멸 확인 / privacy 페이지 AdSense 문구 제거 확인 / `/en` 법무 페이지 정합 + Sprint 160~178 누적.
- 기타 후속(sprint-178 §이월 계승): coverage-gate skipped 허용 제거, post-merge pre-deploy gate, prom-client 점검 자동화, `.claude-tools/` Phase 2 삭제, `(adr)` layout 분할, Programmers URL 자동 카테고리 추론, 기존 SQL 문제 데이터 백필 등.
