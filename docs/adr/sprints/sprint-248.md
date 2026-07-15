---
sprint: 248
title: "AI 분석 문제 컨텍스트 풍부화 — 그룹 분석 문제 정보 주입 + Programmers 크롤러 모듈"
date: "2026-07-15"
status: completed
agents: [Oracle, Scout, Sensei, Curator, Critic]
related_adrs: ["sprint-247", "sprint-238", "sprint-97"]
related_memory: ["sprint-window"]
topics: ["ai-analysis", "problem", "crawler", "context-enrichment", "security"]
tldr: "AI 분석 시 코드만 주입하던 페인포인트 해소 — 두 가지 접근으로 문제 컨텍스트 풍부화. Wave B: ai-analysis 그룹 분석 엔드포인트에서 Problem Service를 조회해 problem_title/problem_description을 <problem_context> 블록으로 주입 (ADR-030 S-5 개별 분석 패턴 재활용). Wave A: problem 서비스에 Programmers 크롤러 모듈 신설 — 문제 등록 시 sourceUrl 기반 description 자동 보완 (axios+cheerio 경량 크롤링, Playwright 불필요). 크롤링 스파이크(Scout)에서 BOJ는 2026-04-28 서비스 완전 종료 확인, Programmers는 SSR로 httpx만으로 파싱 가능 확인. Critic 게이트 Findings 3건(P1 SSRF·P2 envelope unwrap·P2 catch 핸들러) 수정 후 CLEAN. multer CVE-2026-5079(HIGH) 보안 패치 병행. PR #462 머지 커밋 a7731fa. AI Analysis 353 passed·커버리지 99% / Problem 205 passed·커버리지 96.47%."
---
# Sprint 248 — AI 분석 문제 컨텍스트 풍부화

## 목표

- AI 분석 시 사용자 코드만 제공되어 AI가 문제를 역추론해야 하는 페인포인트를 해소한다.
- **Wave B**: 그룹 분석에 문제 정보(제목·설명)를 주입해 다중 제출 비교 분석 정확도를 높인다.
- **Wave A**: 문제 등록 시 `sourceUrl` 기반 Programmers 자동 크롤링으로 `description`을 채워 AI 컨텍스트 부재를 근본 해결한다.
- **Wave S (스파이크)**: httpx+BeautifulSoup4만으로 Programmers 파싱 가능 여부를 실증한다.

## 배경

- Sprint 238(ADR-030 S-5)에서 개별 분석의 `<problem_context>` 주입 패턴을 구현했으나, 그룹 분석(`/group-analysis`)에는 동일 패턴이 적용되지 않았다.
- `Problem` entity에 `sourceUrl`/`sourcePlatform` 필드가 이미 존재(Sprint 97 Programmers 이전 산물)했으나, 등록 시 자동 크롤링 로직이 없어 `description`이 대부분 비어 있었다.
- 플랫폼별 크롤링 가능성은 스파이크 선행 없이 가정할 수 없어 Scout 스파이크를 Wave A 전에 배치했다.

## 결정

### D1. 그룹 분석 문제 정보 주입 전략 — Problem Service 내부 API 조회

- 그룹 분석 요청 수신 시 `problem_id`를 이용해 Problem Service `GET /internal/{problem_id}`를 조회한다.
- 조회 실패(네트워크 오류, 문제 없음) 시 **fallback**: 경고 로그 후 문제 정보 없이 계속 진행 — 서비스 가용성 우선.
- `<problem_context>` 블록은 ADR-030 S-5 개별 분석 패턴과 동일하게 격리 — 프롬프트 인젝션 방어 포함.
- `GROUP_SYSTEM_PROMPT` / `GROUP_SQL_SYSTEM_PROMPT` 양 쪽 모두에 인젝션 방어 지침 추가.
- 아웃바운드 키: `INTERNAL_KEY_PROBLEM` (CLAUDE.md Sprint 239 Q-5 SSOT 준수).

### D2. 크롤링 범위 — Programmers 전용, 등록 시 1회 비동기

- Scout 스파이크 결과: **BOJ는 2026-04-28 채점 서비스 종료**, Programmers는 SSR로 JS 렌더링 불필요 확인.
- Playwright 금지 (Docker 이미지 ~400MB 증가, 브라우저 런타임 불허) → `axios` + `cheerio` 경량 크롤링.
- 문제 등록 시 `description` 미입력 + `sourceUrl`/`sourcePlatform` 있으면 **비동기 backfill** (fire-and-forget, 응답 블로킹 없음).
- `ALLOWED_HOSTS` 화이트리스트: `school.programmers.co.kr` 단독 + `https:` 전용 검증 → SSRF 방어.

### D3. 스파이크 선행 원칙 재확인

- 크롤링 기술 가능성 확인을 Wave A 착수 전 Wave S(Scout)로 선행하는 패턴이 올바름을 실증.
- BOJ 종료 같은 운영 변경 사항은 코드 분석이 아닌 실제 HTTP 요청으로만 확인 가능.

## 구현

### Wave S — 크롤링 스파이크 (Scout)

- BOJ `acmicpc.net/problem/1000`: HTTP 200이나 "채점 서비스 준비 중" 페이지 반환 — **서비스 종료 확인**.
- Programmers `school.programmers.co.kr/learn/courses/30/lessons/{N}`: SSR 확인, httpx 직접 요청으로 HTML 수신 성공.
  - 파싱 가능 필드: 제목(`.challenge-title`)·난이도(`[data-challenge-level]`)·설명(`div.markdown`)·제한사항·입출력 예 테이블.

### Wave B — 그룹 분석 문제 컨텍스트 주입 (ai-analysis, Oracle 직접)

| 파일 | 변경 내용 |
|------|----------|
| `src/config.py` | `problem_service_url` / `problem_service_key` 환경변수 추가 |
| `src/prompt.py` | `build_group_user_prompt()` — `problem_title`/`problem_description` 파라미터 추가, `<problem_context>` 블록 격리 주입 |
| `src/main.py` | `/group-analysis` 엔드포인트 — Problem Service 조회 + fallback 로직 |
| `tests/test_prompt.py` | 신규 5건 (컨텍스트 주입·미주입·sanitize 검증) |
| `tests/test_main.py` | 신규 2건 (Problem Service 성공·실패 시나리오) |

- 커밋: `bd33185`
- 테스트: 353 passed / 커버리지 TOTAL **99%**

### Wave A — Programmers 크롤러 모듈 (problem, Oracle 직접)

| 파일 | 변경 내용 |
|------|----------|
| `src/crawler/crawler.service.ts` | ALLOWED_HOSTS 화이트리스트 + axios+cheerio Programmers SSR 파싱 |
| `src/crawler/crawler.module.ts` | 모듈 등록 |
| `src/problem/problem.module.ts` | CrawlerModule 임포트 |
| `src/problem/problem.service.ts` | `create()` 후 비동기 크롤링 트리거 (`.catch()` 포함) |
| `src/crawler/crawler.service.spec.ts` | 신규 5건 (플랫폼 판별·파싱·오류 처리·SSRF 차단) |
| `src/problem/problem.service.spec.ts` | 신규 2건 (크롤링 트리거·조기 반환) |

- 커밋: `d7b11ef`, `20a4f28` (커버리지 수정)
- 테스트: 198 → 205 passed / 커버리지 Branches **96.47%** / Functions **98.61%**

### Critic 게이트 Findings 수정 (커밋 `95e34dd`)

| 등급 | 내용 | 수정 |
|------|------|------|
| **P1** SSRF | `crawler.service.ts` — `sourceUrl` 무검증 외부 요청 | `ALLOWED_HOSTS` 화이트리스트 + `https:` 전용 검증 |
| **P2** envelope unwrap | `main.py` — Problem Service 응답 `{data: problem}` 직접 필드 접근 | `prob_data.get("data", prob_data)` unwrap 후 추출 |
| **P2** catch 핸들러 | `problem.service.ts` — fire-and-forget unhandled rejection | `.catch()` 추가 + Error/비-Error 2케이스 분기 |

### 보안 패치 (커밋 `86cc2ec`)

- `multer` 2.1.1 → **2.2.0** — CVE-2026-5079 (HIGH) 보안 패치.

## 검증

- **CI**: 38 checks PASS / 0 FAIL
- **AI Analysis**: 353 passed · TOTAL 99% · main.py 100% · prompt.py 100%
- **Problem**: 205 passed · Statements 99.02% · Branches **96.47%** ≥ 96% · Functions **98.61%** ≥ 98% · Lines 99.13%
- **ESLint**: Errors 0 (tsc pre-existing baseUrl deprecation은 Sprint 246 확인 기지 이슈, 변경 범위 무관)
- **Critic (Codex gpt-5.5)**: Findings 3건(P1·P2·P2) 전부 수정 → **CLEAN**
- **PR #462** squash merge → `a7731fa` (2026-07-15T08:58:11Z)

## 교훈

1. **스파이크 선행이 Wave A 설계를 구체화한다.** BOJ 종료를 코드 분석이 아닌 실제 HTTP 요청으로 발견 — 크롤링 범위를 "BOJ+Programmers"에서 "Programmers 전용"으로 조정하는 근거가 됨. Sprint 243 "스파이크 선행이 블로커를 싸게 닫는다" 패턴 재확인.
2. **ADR-030 S-5 패턴 재활용이 안전한 컨텍스트 주입을 보장한다.** 개별 분석의 `<problem_context>` 격리 블록을 그룹 분析에 동일하게 적용함으로써 프롬프트 인젝션 방어가 자동으로 따라옴 — 보안 패턴 재사용의 가치.
3. **SSRF는 크롤러 첫 구현 시 항상 체크 포인트다.** Critic이 `sourceUrl` 무검증을 P1으로 지적 — 외부 URL 직접 요청 코드에는 도메인 화이트리스트가 기본 요건임을 재확인.
4. **fire-and-forget catch 누락은 비동기 코드의 공통 함정.** P2 `.catch()` 지적은 "성공 경로만 테스트하면 오류 경로의 unhandled rejection을 놓친다"는 교훈 — 비동기 backfill 패턴에서 반드시 `.catch()` 쌍을 확인할 것.
5. **Problem Service 응답 envelope를 코드에서 명시적으로 unwrap하라.** `{ data: problem }` 구조를 직접 접근 시 `undefined` 오류 — 내부 API 응답 형식을 항상 실측 후 설계에 반영.

## 이월

- **Sprint 249** — Wave C: Submission entity에 `difficulty`/`level` 복사 + AI 분석 프롬프트 난이도 컨텍스트 주입 (루브릭 보정). Wave D: 크롤링 데이터 구조화(입출력 예시·제약조건 → 별도 필드 파싱) + 구조화 데이터 프롬프트 주입.
- **운영**: aether-gitops `ANTHROPIC_API_KEY` SealedSecret 유효 여부 확인 + `PROBLEM_SERVICE_URL`/`INTERNAL_KEY_PROBLEM` SealedSecret 신규 추가 필요 (ai-analysis Wave B 환경변수).
- GA4 Enhanced Measurement OFF · GA4 프로덕션 UAT · 서버 재배포 + 라이브 SEO 검증 (이월 지속).
