---
sprint: 112
title: "Sprint 111 이월 3건 처리 (micro-sprint)"
period: "2026-04-21"
status: complete
start_commit: 7c45842
end_commit: a42716f
---

# Sprint 112 — Sprint 111 이월 3건 처리 (micro-sprint)

## 배경

Sprint 111 마감 시 Gatekeeper 보안 검토에서 INFO 수준 권고 3건이 발견되어 LOW 이월로 분류되었다. 사용자 요청("이월작업까지 완성해")에 따라 별도 micro-sprint로 즉시 처리한다.

3건 모두 변경 규모가 매우 작고(1~3줄), 보안·아키텍처 영향이 없으며, 백엔드 변경 0줄이라 Oracle 디스패치 오버헤드를 회피하고 직접 처리 방식을 선택했다.

## 목표

| 항목 | 내용 | 상태 |
|------|------|------|
| A-1 CodeBlock SQL 지원 | LANG_MAP에 `sql: 'sql'` 추가 | ✅ 완료 |
| A-2 sitemap에 /guest 추가 | priority 0.9, monthly | ✅ 완료 |
| A-3 게스트 → 회원 전환 추적 | EventTracker 재사용 (CTA 클릭 이벤트) | ✅ 완료 |

---

## 결정 사항

### D1. CodeBlock LANG_MAP 직접 추가 (Palette 협의 생략)

**배경**: Sprint 111 W2 Gatekeeper INFO A-1: sql-window 샘플의 `language: 'sql'`이 LANG_MAP에 없어 'text' 폴백되어 syntax highlighting 미적용 상태였다.

**선택지**:
- (A) Palette에 디자인 토큰 영향 검토 후 추가
- (B) Herald가 단순 데이터 매핑 추가 (Palette 협의 생략) ← **선택**

**선택**: (B) — LANG_MAP은 디자인 토큰이 아닌 Prism 언어 식별자 매핑이며, 신규 색상·폰트·스타일 변경 없음. 1줄 데이터 추가로 Palette 협의 비용 부적합.

**결과**: `frontend/src/components/ui/CodeBlock.tsx` LANG_MAP에 `sql: 'sql'` 1줄 추가. SQL 샘플 syntax highlighting 정상화.

---

### D2. robots.txt는 변경하지 않음, sitemap만 갱신 (게스트 페이지 인덱싱 허용)

**배경**: Sprint 111 W2 Gatekeeper INFO A-2: 게스트 페이지의 검색 엔진 인덱싱 정책이 미결 상태였다.

**선택지**:
- (A) `/guest`에 noindex 적용 (내부 미리보기 취급)
- (B) `/guest` 인덱싱 허용 + sitemap 등재 (마케팅 funnel 진입점 취급) ← **선택**
- (C) robots.txt에 `/guest` 명시적 allow 라인 추가

**선택**: (B) — 게스트 모드는 본질적으로 회원 가입 유입 funnel의 진입점이며, 검색 노출은 마케팅 목적과 정확히 일치한다. 현 robots.ts는 이미 `/`를 allow하고 `/api/`, `/auth/`, `/callback`만 disallow하므로 `/guest`는 자동으로 허용 상태. robots.ts 변경 불필요. sitemap에 `/guest` 항목만 추가하여 SEO 신호 강화.

**결과**: `frontend/src/app/sitemap.ts`에 `${baseUrl}/guest` 항목 추가 (priority 0.9, changeFrequency monthly). robots.ts는 변경 없음.

---

### D3. EventTracker 인프라 재사용 — 백엔드 추가 0줄

**배경**: Sprint 111 W2 Gatekeeper INFO A-3: 게스트 → 회원 전환 funnel 추적이 미구현 상태였다. 별도 스프린트 편성 권고가 있었으나, 기존 EventTracker 인프라를 확인한 결과 매우 가벼운 재사용으로 충분히 처리 가능했다.

**선택지**:
- (A) 신규 백엔드 이벤트 엔드포인트 추가
- (B) GA/PostHog 등 외부 분석 도구 도입
- (C) 기존 `eventTracker` (`/api/events` 공개 엔드포인트) 재사용 ← **선택**

**선택**: (C) — `frontend/src/lib/event-tracker.ts`에 이미 BUFFER 5/FLUSH 30s 기반 클라이언트 + `/api/events` 엔드포인트(공개)가 구축되어 있고, `EventTrackerProvider`가 모든 페이지의 PAGE_VIEW를 자동 추적 중이다. 게스트 페이지 진입은 PAGE_VIEW로 이미 자동 측정되며, sessionId로 funnel 분석이 가능하다. CTA 클릭 의도성만 추가로 추적하면 정확도 보강 충분.

**결과**:
- `GuestNav.tsx` 회원가입 버튼: `eventTracker?.track('guest:cta_signup_click', { meta: { from: 'nav' } })`
- `guest/preview/[slug]/page.tsx` GuestCtaBanner 회원가입 버튼: `eventTracker?.track('guest:cta_signup_click', { meta: { from: 'preview_banner' } })`
- 서버 컴포넌트(GuestPage 인덱스, GuestFooter)는 PAGE_VIEW로 충분 — onClick 추가로 인한 'use client' 강제 회피.

---

## 산출물

| 파일 | 변경 | 설명 |
|------|------|------|
| `frontend/src/components/ui/CodeBlock.tsx` | +1 | LANG_MAP에 sql 추가 |
| `frontend/src/app/sitemap.ts` | +1 | /guest sitemap 등재 |
| `frontend/src/components/guest/GuestNav.tsx` | +2 | eventTracker import + onClick CTA 추적 |
| `frontend/src/app/guest/preview/[slug]/page.tsx` | +2 | eventTracker import + onClick CTA 추적 |
| **합계** | **+6 / -0** | 4 파일, 1 커밋 (a42716f) |

## 검증

- `npx tsc --noEmit`: 0 에러
- `npx next lint` (변경 파일): 신규 warning 0건 (CodeBlock의 78줄 inline-style warning은 pre-existing)
- 빌드 영향: 동일 — /guest 청크 크기 변화 미미 (eventTracker는 이미 번들에 포함)

## 교훈

- **micro-sprint의 가치**: Sprint 111의 LOW 이월 3건이 합산 6줄 변경. 별도 스프린트 편성보다 즉시 후속 처리가 효율적. ADR 1건 + 커밋 1건으로 마감.
- **인프라 재발견의 효과**: A-3 "게스트 전환 추적"이 별도 스프린트 권고였으나 EventTracker + EventTrackerProvider 인프라를 재발견하여 onClick 2건만으로 처리. 신규 백엔드/외부 도구 도입 0건.
- **Oracle 디스패치 회피 기준**: 변경 규모가 5줄 미만 + 보안/아키텍처 영향 없음 + 단일 도메인일 때 직접 처리가 디스패치보다 효율적.

## 이월 항목

없음 — Sprint 111의 INFO 3건 전량 마감.

## 후속 처리 필요 (MEMORY.md 상시)

- SWR/React Query 도입 (프론트 데이터 페칭 표준화)
- Redis 통계 캐시 (대시보드 통계 DB 직접 조회 → 캐시 전환)
- problem.tags JSON 컬럼 전환 + seed 데이터 확충
