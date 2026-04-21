---
sprint: 111
title: "게스트 모드 구현 (예시 결과 미리보기)"
period: "2026-04-21"
status: complete
start_commit: 2247c4c
end_commit: 7c45842
---

# Sprint 111 — 게스트 모드 구현 (예시 결과 미리보기)

## 배경

비로그인 사용자가 AlgoSu의 핵심 가치(AI 코드 분석)를 OAuth 회원가입 없이 체험할 수 있는 진입로가 없었다. `/login` 페이지에는 OAuth 3종 + 데모 계정 로그인(전체 기능 둘러보기)만 제공되어, "회원가입 없이 결과만 잠깐 보고 싶다"는 잠재 사용자의 이탈이 높았다.

Sprint 111은 **세션·인증 없이** 사전 시딩된 3개 샘플 분석 결과만 보여주는 경량 게스트 모드를 도입했다. 기존 `GuestContext`(공유링크 기반)와 완전히 분리된 독립 모듈이며, 백엔드 변경은 0줄이다.

웨이브 구조: W1(Herald 프론트 구현) → W2(Gatekeeper 보안 검토) → W3(Scribe ADR + 메모리 갱신).

## 목표

| 항목 | 내용 | 상태 |
|------|------|------|
| 미들웨어 PUBLIC_PATHS 확장 | `/guest` 비인증 허용 | ✅ 완료 (W1) |
| 정적 픽스처 데이터 | `GuestSample[]` 3개 (JS/Python/SQL) | ✅ 완료 (W1) |
| 게스트 인덱스 페이지 | `/guest` — 카드 그리드 + CTA | ✅ 완료 (W1) |
| 게스트 상세 페이지 | `/guest/preview/[slug]` — ScoreGauge + 피드백 | ✅ 완료 (W1) |
| GuestNav 컴포넌트 | glassmorphism nav (로고 + 회원가입 CTA + 테마토글) | ✅ 완료 (W1) |
| 로그인 페이지 진입 링크 | "게스트로 둘러보기" 텍스트 링크 | ✅ 완료 (W1) |
| 보안 검토 | 인증 우회·XSS·Open Redirect·라우트 회귀 | ✅ 0건 블로킹 (W2) |

---

## 결정 사항

### D1. stateless 식별 — JWT/쿠키 없음, localStorage 플래그 미도입

**배경**: 플랜에는 `localStorage: algosu:guest-mode=true` 플래그가 옵션으로 언급되었으나 Herald 구현에서 미도입했다.

**선택지**:
1. localStorage 플래그 도입 (플랜대로)
2. 완전 stateless — URL 접근만으로 게스트 허용, 플래그 없음

**결정**: 선택지 2. localStorage 플래그 미도입.

**근거**: Gatekeeper 검토(A-2)에서 "상태 조작 벡터 제거"로 보안상 더 우수하다고 확인. `/guest` URL에 직접 접근하면 게스트로 인식되며, 추가 상태 관리가 필요 없다. 회원 전환 추적(이벤트 로깅)은 후속 스프린트 과제.

### D2. 정적 픽스처 3개 — 난이도·언어·주제 다양성 확보

**배경**: 게스트 샘플의 수와 종류를 결정해야 했다.

**선택지**:
1. 단일 샘플 (가장 단순)
2. 3개 샘플 — 브론즈/골드/실버, JavaScript/Python/SQL 조합
3. 5개 이상 샘플

**결정**: 선택지 2. 3개 픽스처.

| 슬러그 | 문제 | 난이도 | 언어 | 점수 |
|--------|------|--------|------|------|
| `two-sum` | LeetCode #1 Two Sum | BRONZE | JavaScript | 92 |
| `lru-cache` | LeetCode #146 LRU Cache | GOLD | Python | 88 |
| `sql-window` | 프로그래머스 부서별 급여 순위 | SILVER | SQL | 85 |

**근거**: 브론즈·실버·골드 3단계와 JavaScript·Python·SQL 3언어를 커버하면 AlgoSu가 지원하는 핵심 학습 경로를 한 번에 보여줄 수 있다. SQL은 Sprint 108~109에서 추가된 SQL 학습 경로 노출 효과도 있다.

### D3. 게스트 라우트 — AppLayout 미사용, 독립 GuestNav

**배경**: App Router에서 게스트 라우트가 인증이 필요한 AppLayout(Sidebar, SessionProvider 등)을 우회해야 했다.

**선택지**:
1. 기존 AppLayout을 조건부로 인증 스킵
2. `/guest` 그룹에 독립 레이아웃 + GuestNav

**결정**: 선택지 2. `/app/guest/` 라우트 그룹에 별도 레이아웃, `GuestNav.tsx` 신규.

**근거**: AppLayout은 `SessionProvider`, `useSession`, `Sidebar` 등 인증 의존 컴포넌트를 포함한다. 조건부 스킵은 기존 인증 흐름에 사이드 이펙트를 줄 수 있으므로, 독립 레이아웃이 관심사 분리 측면에서 안전하다. `glass-nav` 토큰과 기존 `Logo`, `next-themes` 재사용으로 신규 Palette 토큰 추가 없음.

### D4. AI 실시간 호출 금지 — 정적 픽스처만 허용

**배경**: 일부 검토에서 rate-limited API로 실시간 AI 분석을 제공하는 안이 논의됐다.

**선택지**:
1. rate-limited 실시간 AI 호출 (IP 기반 제한)
2. 사람이 작성한 정적 픽스처만 (LLM 호출 0)

**결정**: 선택지 2. 정적 픽스처만.

**근거**: 비용·보안·레이턴시 3중 부담이 있다. 게스트 모드의 목적은 AI 분석 결과의 "형태"를 미리보기하는 것이지, 실제 분석을 제공하는 것이 아니다. 정적 픽스처는 실제 AI 분석문보다 더 잘 다듬어진 모범 답안을 제공할 수 있고, 서버 자원 소모가 없다.

---

## 보안 검토 결과 (Gatekeeper W2)

블로킹 이슈 0건. 전체 PASS.

| 항목 | 결과 |
|------|------|
| 미들웨어 라우트 가드 경계 조건 | /guestXYZ, /guest-admin 차단 확인 |
| 보호 라우트 회귀 | /dashboard → /login?redirect=... 정상 |
| API 호출 부재 | fetch/authApi/token 참조 0건 |
| XSS 벡터 | dangerouslySetInnerHTML 없음, Prism 자동 이스케이프 |
| Open Redirect | sanitizeRedirect() 로직 무변경 |
| 기존 GuestContext 분리 | import 교차 없음 |
| slug Path Traversal | GUEST_SAMPLES.find() → notFound(), 파일시스템 접근 없음 |
| 번들 크기 | /guest First Load 184 kB (200 KB 미만 통과) |

**권고 사항 (INFO — 비블로킹):**
- A-1: CodeBlock LANG_MAP에 `sql: 'sql'` 미등록 → text 폴백 (후속 1줄 추가 권장)
- A-2: robots.txt / noindex 정책 미결 (후속 SEO 스프린트 시 결정)
- A-3: sourceUrl 하드코딩 안전. 동적 소싱 전환 시 allowlist 필수

---

## 웨이브 실행 기록

| 웨이브 | 에이전트 | 작업 | 커밋 |
|--------|----------|------|------|
| W1 | Herald | 미들웨어 패치 + 픽스처 데이터 + 라우트 + GuestNav + 로그인 링크 (9파일) | `7c45842` |
| W2 | Gatekeeper | 보안 검토 (코드 변경 없음) | — |
| W3 | Scribe | Sprint 111 ADR + sprint-window/MEMORY.md 갱신 | — |

---

## 산출물 및 변경 파일 목록

| 파일 | 작업 | 웨이브 | 설명 |
|------|------|--------|------|
| `frontend/src/middleware.ts` | 수정 | W1 | PUBLIC_PATHS에 '/guest' 추가 (1줄) |
| `frontend/src/data/guest-samples/index.ts` | 신규 | W1 | GuestSample 타입 + GUEST_SAMPLES 배열 |
| `frontend/src/data/guest-samples/samples/two-sum.ts` | 신규 | W1 | Two Sum 샘플 (BRONZE/JavaScript, 점수 92) |
| `frontend/src/data/guest-samples/samples/lru-cache.ts` | 신규 | W1 | LRU Cache 샘플 (GOLD/Python, 점수 88) |
| `frontend/src/data/guest-samples/samples/sql-window.ts` | 신규 | W1 | 부서별 급여 순위 샘플 (SILVER/SQL, 점수 85) |
| `frontend/src/components/guest/GuestNav.tsx` | 신규 | W1 | 게스트 전용 glassmorphism nav |
| `frontend/src/app/guest/page.tsx` | 신규 | W1 | 게스트 인덱스 — 히어로 + 샘플 카드 그리드 |
| `frontend/src/app/guest/preview/[slug]/page.tsx` | 신규 | W1 | 게스트 상세 — ScoreGauge + CodeBlock + 피드백 + 하단 배너 |
| `frontend/src/app/(auth)/login/page.tsx` | 수정 | W1 | "게스트로 둘러보기" text-text-3 링크 추가 |

**변경 통계**: 9 files changed, 892 insertions(+), 1 deletion(−)

**커밋 목록** (1건):
- `7c45842` — feat(frontend): 게스트 모드 구현 — 정적 픽스처 기반 샘플 분석 미리보기

---

## 교훈

### 1. stateless 설계의 보안 이점

플랜에 localStorage 플래그가 옵션으로 포함되어 있었지만, Herald가 구현하지 않은 것이 Gatekeeper 검토에서 "상태 조작 벡터 제거"로 더 우수하다는 평가를 받았다. URL 기반 라우트 접근만으로 게스트를 식별하는 완전 stateless 방식이 게스트 모드처럼 읽기 전용 미리보기에는 최적이다.

### 2. 백엔드 0줄 제약의 설계 명확성

"백엔드 변경 0줄"이라는 명시적 제약이 설계를 단순하게 유지시켰다. 실시간 AI 호출 검토를 자연스럽게 차단하고, 정적 픽스처라는 올바른 방향으로 집중할 수 있었다.

### 3. 기존 컴포넌트 재사용 — 신규 Palette 토큰 없음

ScoreGauge, CodeBlock, DifficultyBadge, parseFeedback() 등 기존 컴포넌트와 `glass-nav`, `text-text-3` 등 기존 토큰 전량 재사용으로 Palette 협의 없이 단일 웨이브에서 구현 완료했다. Sprint 계획 단계에서 "신규 토큰/Palette 컴포넌트 추가 금지" 제약을 명시한 효과다.

### 4. CodeBlock SQL 폴백 — 미등록 언어는 사전 점검 필수

sql-window 샘플의 `language: 'sql'`이 CodeBlock의 LANG_MAP에 없어 text 폴백으로 처리되었다. 픽스처 언어 결정 시점에 CodeBlock 지원 언어 목록을 사전 확인했다면 방지할 수 있었던 문제다. 향후 새 언어 샘플 추가 시 LANG_MAP 등록 여부를 먼저 확인해야 한다.

---

## 이월 항목

| 항목 | 내용 | 우선순위 |
|------|------|---------|
| CodeBlock SQL 지원 | LANG_MAP에 `sql: 'sql'` 추가 (1줄) | LOW |
| robots.txt / noindex 정책 | 게스트 페이지 인덱싱 결정 | LOW |
| 게스트 전환 추적 | /guest → 회원가입 이벤트 로깅 | LOW |

---

## 관련 문서

- `docs/adr/sprints/sprint-110.md` — 선행 스프린트 (이월 전수 처리)
- `frontend/src/middleware.ts` — PUBLIC_PATHS 게스트 패치
- `frontend/src/data/guest-samples/` — GuestSample 타입 + 3개 픽스처
- `frontend/src/app/guest/` — 게스트 라우트 그룹
- `frontend/src/components/guest/GuestNav.tsx` — 게스트 전용 nav
