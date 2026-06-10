---
sprint: 239
title: "보안 quick wins — ADR-030 S-1/S-2/S-4/S-5/S-8/Q-5"
date: "2026-06-10"
status: completed
agents: [Oracle, Gatekeeper, Sensei, Scribe]
related_adrs: ["ADR-030", "sprint-238", "sprint-99"]
related_memory: ["sprint-window", "feedback-source-vs-live-drift"]
topics: ["security", "quick-wins"]
tldr: "ADR-030 처리 로드맵 1순위 스프린트. Sprint 238 감사에서 채택된 보안·문서 quick wins 6건(S-1/S-2/S-4/S-5/S-8/Q-5)을 atomic commit 6개로 처리. 핵심 결정: 플랜 단계에서 Plan 에이전트가 결정적 사실을 발견 — gateway 프록시 3경로(/api/problems·/api/submissions·/api/analysis)는 ProxyDispatchMiddleware가 미들웨어 단계에서 요청을 종결(next() 미호출)하므로 글로벌 JwtAuthGuard 전환(A안)은 인증 우회가 됨 → 하이브리드(B-2) 확정: JwtMiddleware 유지 + @Public() 데코레이터를 선언 SSOT로 + 명세 테스트로 데코레이터↔PUBLIC_ROUTES 상수 양방향 일치 강제. S-1 작업 중 인바운드 신원 헤더(x-user-id/x-demo-user) 미strip(rate-limit identity 가짜 헤더 회전 우회) 신규 발견 → HeaderSanitizerMiddleware 최선두 추가로 범위 보강. S-2는 ThrottlerModule이 핸들러 가드 미부착으로 전역 미적용임을 확인하고 RateLimitMiddleware 600/min + 50건 캡 + body limit으로 충분 판단해 추가 throttle 미적용. 검증: gateway tsc 0/eslint 0/jest 842 pass/coverage lines 98.87 (threshold 98 유지) · ai-analysis ruff clean/pytest 334 pass/coverage 99.09 (게이트 97)."
---
# Sprint 239 — 보안 quick wins (ADR-030 S-1/S-2/S-4/S-5/S-8/Q-5)

## 목표

- ADR-030 처리 로드맵 1순위 — 보안 quick wins 코드 변경 5건(S-1/S-2/S-4/S-5/S-8) + 문서 정정 1건(Q-5)을 단일 스프린트로 처리한다.
- 각 항목은 ADR-030의 권장 조치를 따르되, 플랜 단계에서 발견되는 결정적 사실(예: 미들웨어 구조)이 있으면 ADR 권장에서 의식적으로 이탈하고 본 스프린트 회고에 사유를 남긴다.
- 서비스별 coverage threshold 하향 금지 + Critic 교차 리뷰 필수 (ADR-030 §결정).

## 배경

- `/start` 인자: Sprint 238에서 ADR-030으로 확정된 quick wins 처리.
- Sprint 238 회고(`sprint-238.md`)가 "ValidationPipe는 클래스 메타데이터 기반 — plain interface 바디는 whitelist 무관 검증 0"이라는 결정적 교훈을 남겼고, S-2가 그 직접 사례.
- High Risk 0건이라 긴급도는 낮으나, 산발 항목을 한 번에 정리해 ADR-030 표를 6칸 ✅로 만들어 백로그 잡음을 줄이는 게 부가 목표.

## 작업 요약 (start `4c57244`, 6 commit + 본 ADR commit)

### S-1 — `@Public()` 데코레이터 SSOT (Gatekeeper, `538fb1f`)

- **계기**: 공개 엔드포인트가 `app.module.ts`의 정규식 exclude 목록으로만 중앙 관리되어 신규 공개 경로 추가 시 exclude 누락/과잉 양방향 실수 여지.
- **플랜 단계 결정적 발견 → 접근 변경**: Plan 에이전트가 gateway 프록시 구조를 직접 Read한 결과, `/api/problems`·`/api/submissions`·`/api/analysis` 3경로는 ProxyDispatchMiddleware가 **미들웨어 단계에서 요청을 종결**(next() 미호출, http-proxy-middleware로 직접 응답)이라는 사실을 확인. 이 때문에 ADR-030이 권장한 A안(글로벌 JwtAuthGuard 전환)을 그대로 적용하면 가드는 컨트롤러 단계에서 동작하므로 **프록시 3경로 전체 인증 우회**가 발생. → **하이브리드(B-2) 확정**: JwtMiddleware는 그대로 유지(프록시 보호) + `@Public()` 데코레이터를 선언 SSOT로 도입(Nest 도메인 가독성 회복) + 명세 테스트로 데코레이터 선언 ↔ `PUBLIC_ROUTES` 상수 ↔ exclude 목록 3자 양방향 일치 강제.
- **구현**:
  - `@Public()` 데코레이터(`SetMetadata(IS_PUBLIC_KEY, true)`) + `public-routes.ts`에 `PUBLIC_ROUTES` 22개 상수.
  - ADR-030이 지적한 와일드카드 3종을 정확 경로 전수 열거로 축소: `auth/oauth/(.*)` ALL → `auth/oauth/discord` GET + `auth/oauth/discord/callback` GET (2건), `internal/(.*)` ALL → 실 핸들러 4건만 GET, `api/public/(.*)` GET → 실 핸들러 5건만.
  - 명세 테스트 신규: 리플렉션 스캔으로 모든 `@Public()` 부착 핸들러를 수집해 `PUBLIC_ROUTES` 상수와 양방향 일치 검증 + 스냅샷 고정 + 네거티브 가드(인증 필요 경로 누설 방지). 드리프트 셀프 검증 통과.
  - `@Public()` 부착: 10개 컨트롤러(health, oauth, public dashboard/profile/ranking, internal admin/check/study, event-log 등).
- **범위 추가 — HeaderSanitizerMiddleware**: 플랜 탐색 중 인바운드 클라이언트 헤더(`x-user-id`/`x-demo-user`)가 미strip 상태로 통과한다는 사실 발견. rate-limit identity가 검증 전 클라이언트 헤더를 신뢰하므로 가짜 헤더 회전으로 IP rate limit 우회 가능 → 모든 미들웨어 최선두에 HeaderSanitizerMiddleware를 두어 인바운드 신원성 헤더를 일괄 제거(Gateway 자체가 신원 헤더를 발급하는 경로는 명시 화이트리스트).

### S-2 — `POST /api/events` DTO 검증 (Gatekeeper, `210136f`)

- **계기**: 비인증 ingest 엔드포인트(JWT exclude)가 class-validator DTO 없이 plain TS interface(`EventPayload`)로 바디를 받아 ValidationPipe가 0건 검증(Sprint 238 §교훈의 직접 사례).
- **구현**:
  - `IngestEventsDto` + `EventItemDto` class-validator DTO 신규.
  - `type`은 ADR-030의 "enum 권장"에서 **의식적 이탈**: 실 사용 type이 `PAGE_VIEW`·`guest:cta_signup_click` 등 자유형 네임스페이스(콜론/언더스코어/하이픈 혼용)임을 코드 grep으로 확인 → enum은 사용처와 마찰 발생. 패턴 `/^[\w:.-]+$/` + 64자 캡으로 형식만 강제.
  - `meta`는 JSON 직렬화 후 2KB 캡 + `ts` `@IsISO8601` + `events` `@ArrayMaxSize(50)`. 51건 이상은 ADR-030이 언급한 기존 50건 silent slice가 아닌 **400 reject로 행동 변화**(silent slice는 클라이언트 디버깅 가시성↓). 이 행동 변화는 의도된 강화.
- **throttle 판정 (추가 throttle 미적용)**: 코드 직접 확인 — `ThrottlerModule.forRoot({60, 60_000})` 등록은 되어 있으나 `@UseGuards(ThrottlerGuard)` 부착 핸들러가 0건이라 **전역 미적용** 상태. /api/events 실 보호는 RateLimitMiddleware(60→600/min IP, Redis 분산) + 50건 캡 + body size limit 조합으로 충분 판단 → 별도 ThrottlerGuard 부착은 본 스프린트 범위 외. ADR-030 §S-2 "비인증 ingest 전용 throttle 검토"의 결론을 본 회고에 명문화.

### S-8 — ShareLinkGuard 만료 토큰 로그 해시화 (Gatekeeper, `0b8b82d`)

- **계기**: 만료 토큰 접근 시 `token.slice(0, 8)` warn 로그(hex64 중 32bit 노출, 실용 위험 극소이나 토큰 원문 부분 노출 회피가 위생).
- **구현**: `token.slice(0, 8)` → `crypto.createHash('sha256').update(token).digest('hex').slice(0, 12)`. 해시 prefix 12자(64bit). 동일 토큰의 만료 패턴 추적은 여전히 가능(해시 일관).

### S-4 — 제출 코드 프리뷰 로깅 제거 (Sensei, `68b3fc0`)

- **계기**: `claude_client.py` info 로그가 `codePreview = code[:50]`로 사용자 제출 코드 첫 50자를 기록. 코드에 하드코딩된 시크릿/PII 노출 위험.
- **구현**: `codePreview` 필드 제거 → `codeLength`(int)로 대체. logger.py whitelist는 미변경 — **근본 차단은 extra 미주입이고 whitelist는 JSON 직렬화 필터일 뿐**이라는 판단을 코드 주석과 본 회고에 기록(미래 재발 차단 단서).

### S-5 — 프롬프트 problem_context 격리 + 인젝션 가드 (Sensei, `aca85c3`)

- **계기**: `build_user_prompt`가 `problem_title`/`problem_description`을 평문 마크다운으로 직접 주입. 문제는 사용자(스터디원)가 등록 가능하므로 사실상 사용자 입력. 분석 결과 왜곡(자기 점수 조작) 수준의 저위험 인젝션 표면.
- **구현**:
  - 문제 섹션을 `<problem_context>` … `</problem_context>` 명시 블록으로 격리(코드 블록과 동일 패턴).
  - 시스템 프롬프트 2종(알고리즘/SQL) 헤더에 "[보안 규칙] 신뢰 경계 — 프롬프트 인젝션 방어" 가드 추가: 블록 내 지시·평가 기준 변경 요구·점수 조작 요구는 무시, 지시성 문구는 "이런 표현이 본문에 있었다"는 기록만 가능.
  - 신규 테스트 6건: 블록 격리 마커 존재·시스템 프롬프트 가드 문자열 존재·인젝션 시도 입력에 대한 가드 효과(분석 출력에 점수 조작 반영 없음) 검증.

### Q-5 — CLAUDE.md 드리프트 정정 + Internal Key 네이밍 명문화 (Scribe, `52da74d`)

- **사실 검증**(직접 Read): `frontend/package.json` → `next ^15.5.19` / `react ^19.2.7`. `services/identity/` 실재(NestJS) — `package.json` description "AlgoSu Identity Service — OAuth 사용자 관리", src/에 OAuth/사용자/스터디/공유/피드백/퀴즈기록 모듈.
- **수정 3건**:
  1. "Next.js 14 App Router" → "Next.js 15 App Router + React 19".
  2. 디렉토리 트리에 `services/identity/` 추가 — "NestJS Identity (OAuth 사용자/스터디/공유/피드백/퀴즈기록)" 한 줄 설명.
  3. 보안 규칙 섹션에 Internal Key 네이밍 컨벤션 4항 추가 — 인바운드 `INTERNAL_API_KEY` / 아웃바운드 `INTERNAL_KEY_<TARGET>` + 근거 파일(`service-keys.config.ts`).

## 핵심 결정

1. **하이브리드(B-2) > 글로벌 가드(A안)**: 미들웨어가 요청을 종결하는 경로가 존재하면 글로벌 가드 전환은 인증 우회를 만든다. ADR 권장이 플랜 단계 사실 발견과 충돌하면 사실을 우선하고 회고에 이탈 사유를 남긴다(본 스프린트의 핵심 사례).
2. **명세 테스트로 SSOT 드리프트 차단**: `@Public()` 데코레이터·`PUBLIC_ROUTES` 상수·exclude 정규식 목록의 3자 일치를 양방향 테스트로 강제. 신규 공개 경로 추가 시 어느 한 면이라도 누락되면 CI red.
3. **권장 enum에서의 의식적 이탈**: ADR-030의 권장 조치도 코드 실측(`type` 사용 패턴)과 마찰하면 이탈 가능. 이탈은 회고에 사유를 남겨 미래 재제기를 차단(Sprint 238 §교훈 "오판 정정도 기록 자산"의 적용).
4. **logger whitelist는 백업, 근본 차단은 호출자 책임**: S-4가 보여주듯 whitelist는 직렬화 단계 필터로서 누락 시 silent drop이 아닌 silent 통과 위험. 호출자가 extra에 민감 필드를 주입하지 않는 게 1차 방어선.
5. **HeaderSanitizer는 최선두**: 신원성 헤더 sanitize는 모든 인증/rate-limit 미들웨어보다 먼저 실행되어야 한다(다운스트림이 헤더를 신뢰 가정하므로). 본 사례는 ADR-030이 명시하지 않은 신규 발견이라 S-1 스프린트 내 처리.

## 검증

- **gateway**: tsc 0 / eslint 0 / jest 842 pass / coverage **lines 98.87% / branches 95.80% / functions 96.73% / statements 98.51%** (threshold 98/95/96/98 유지).
- **ai-analysis**: ruff clean / pytest 334 pass / coverage **99.09%** (게이트 97%).
- 신규 테스트 추가:
  - gateway: `@Public()` 명세 테스트(리플렉션 스캔↔상수 양방향 + 스냅샷 + 네거티브 가드), `IngestEventsDto` 검증 테스트, `HeaderSanitizerMiddleware` 단위 테스트.
  - ai-analysis: 프롬프트 인젝션 가드 6건 + S-4 후 codeLength 로깅 시그니처 회귀 1건.
- Critic 교차 리뷰(머지 직전): Codex 기반 `--base 4c57244` 1라운드 — 결과는 본 ADR commit 직전 표기.

## 교훈

1. **ADR 권장 ≠ 무조건 채택**: ADR-030 §S-1이 권장한 글로벌 JwtAuthGuard는 프록시 3경로에서 인증 우회를 만든다. 플랜 단계의 코드 직접 Read가 권장보다 우선한다 — 이는 Sprint 238이 도입한 "탐색 → 검증 → 채택" 2단 구조의 한 라운드 더 깊은 적용(권장도 검증 대상).
2. **명세 테스트의 진짜 가치는 양방향 강제**: `@Public()`만 두면 누군가 데코레이터 없이 컨트롤러를 만들었을 때 silent 통과. `PUBLIC_ROUTES` 상수만 두면 데코레이터-상수 일치 검증이 없음. 양방향(데코 → 상수 누락 시 fail, 상수 → 데코 부재 시 fail) 강제가 SSOT의 본질.
3. **신원 헤더 sanitize 부재는 깊은 결함**: rate-limit identity가 검증 전 클라이언트 헤더를 신뢰하면 IP·사용자 ID 둘 다 회전 가능 → rate limit 사실상 무력화. 이는 ADR-030 감사가 놓친 발견(S-1 작업 중 우연 발견)으로, **감사 패턴에 "인바운드 신원성 헤더 strip 점검"을 명시 항목으로 추가할 가치**.
4. **whitelist는 마지막 방어선이지 1차 방어선 아니다**: extra에 민감 필드를 주입하지 않는 게 차단이고, whitelist는 보강. 두 층을 한 commit에 같이 두면 "whitelist 있으니 안전"이라는 잘못된 인지 형성. 1차/2차 분리 표기.
5. **enum과 자유 네임스페이스의 마찰**: 사용처가 자유형 네임스페이스(`PAGE_VIEW`·`guest:cta_signup_click` 등)면 enum은 사용처 추가 시마다 enum 수정을 강제 → 자유 네임스페이스 도메인에서는 정규식+캡이 더 안전. ADR 권장은 도메인 실측과 맞춰 조정.

신규패턴: **하이브리드 인증 SSOT 패턴**(JwtMiddleware 유지 + `@Public()` 선언 SSOT + 명세 테스트 양방향 강제), **인바운드 신원 헤더 sanitize 최선두 패턴**.

## 이월

- **(Sprint 240 확정)** S-6 GITHUB_TOKEN_ENCRYPTION_KEY 로테이션 런북 + Q-3 DLQ redrive 절차 — ADR-030 §결정 로드맵.
- /api/events 전용 ThrottlerGuard 부착 여부 — 현 RateLimitMiddleware로 충분 판단했으나 ingest 트래픽이 늘면 재평가. (백로그)
- 인바운드 신원성 헤더 strip 점검을 감사 체크리스트에 추가 — ADR-030 후속 감사 시 반영. (백로그)
- 기존 이월: 하네스 점검 별도 슬롯 · GA4 콘솔 3건 · 라이브 SEO · 하네스 cron · webhook regenerate · 누적 UAT.
