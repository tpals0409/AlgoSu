---
sprint: 97
title: "프로그래머스 전환 마무리 — 제출 파이프라인 + AI + tags 보강 + 문서"
date: "2026-04-20"
status: completed
---

# Sprint 97 — 프로그래머스 전환 마무리

## 배경
BOJ→프로그래머스 전환 3-스프린트 로드맵(Sprint 95 백엔드 인프라 → Sprint 96 프런트 UX → Sprint 97 제출·AI·문서)의 **종결 편**. Sprint 95~96에서 프로그래머스 문제를 등록·검색하는 틀은 완성되었으나, 문제 생성 이후의 파이프라인(제출 → GitHub 커밋 → AI 피드백)은 여전히 `sourcePlatform`을 모른 채 BOJ 가정으로 동작하고 있었다. 또한 Sprint 95에서 이월된 tags 빈 배열 보강, Sprint 96에서 이월된 WCAG AA 대비비 검증도 본 스프린트에서 마무리한다.

## 목표
Sprint 95~96에서 완성한 프로그래머스 UX에 맞춰 제출 파이프라인(GitHub Worker)과 AI 피드백 프롬프트가 `sourcePlatform`을 인지하도록 확장한다. Sprint 95에서 이월된 tags 공백 보강 + Sprint 96 이월 WCAG AA 검증까지 포함해 BOJ→프로그래머스 전환 3-스프린트 로드맵을 종결한다.

## 작업 요약

| # | 커밋 | 담당 | 내용 |
|---|------|------|------|
| 1 | `25f97f3` | architect | GitHub Worker `formatPlatform()` 대문자 풀네임 통일 |
| 2 | `e0a72ae` | librarian | Sprint 95 ADR 작성 |
| 3 | `7c20a62` | librarian | Sprint 96 ADR 작성 |
| 4 | `277a06c` | architect | Submission MQ event에 `sourcePlatform` 전달 |
| 5 | `5e3e55d` | palette | WCAG AA 대비비 검증 스크립트 (`check-wcag.ts`) |
| 6 | `2a9ed07` | architect | ai-analysis 프롬프트에 플랫폼 맥락 한 줄 주입 |
| 7 | `1b14a77` | scribe | GitHub Worker PROGRAMMERS 플랫폼 파일명 테스트 3건 추가 (116 tests) |
| 8 | `2969eb5` | palette | Light `--primary` `#7C6AAE`→`#715DA8` WCAG AA 4.5:1+ 확보 |
| 9 | `1544156` | architect | 프로그래머스 tags 2차 패스 크롤러 스크립트 신규 |
| 10 | `fff4b00` | scribe | ai-analysis 플랫폼별 프롬프트 맥락 주입 테스트 5건 (176 tests) |
| 11 | `44fcc12` | curator | 프로그래머스 373건 tags 보강 재수집 |
| 12 | `b77692f` | curator | Gateway `programmers.service` tags 회귀 테스트 추가 |
| 13 | `316ab92` | postman | E2E 프로그래머스 전 구간 시나리오 13건 |
| 14 | `ac85a0b` | postman | CI `e2e-programmers` job 추가 (PR 병렬 실행) |
| 15 | `e98e5d6` | curator | 크롤러 `SKIP_KEYWORDS` 확장 +6 + 셀렉터 검증 강화 |
| 16 | `ba4c086` | curator | 프로그래머스 tags 재수집 — 노이즈 정제 |
| 17 | `aea6811` | architect | Python 요구 버전 `3.13→3.12` 완화 (`pyproject.toml`) |
| 18 | `bce4a0b` | architect | `ruff>=0.4.0` 업그레이드 (`requirements-dev.txt`) |

## 수정 내용

### GitHub Worker — formatPlatform 대문자화
- `github-push.service.ts:254-266`: `formatPlatform()` map의 모든 값을 대문자 풀네임으로 통일 (`'PROGRAMMERS'`, `'LEETCODE'`, `'SOFTEER'`, `'SWEA'`). 이전에 `'Programmers'`처럼 대소문자가 혼재했던 것을 정규화
- 파일명 형식: `{weekFolder}/{PLATFORM}_{problemNumber}_{title}.{ext}` → `PROGRAMMERS_1845_폰켓몬.py`
- `extractProblemNumber()` (L272-276): 프로그래머스 URL(`/learn/courses/30/lessons/{id}`)의 마지막 세그먼트에서 문제 번호 정상 추출 확인 (회귀 테스트 포함)
- 테스트: `github-push.service.spec.ts`에 PGM 파일명 2건 + `worker.spec.ts` mock 1건 추가 → **116 tests ALL PASS**

### Submission — MQ event sourcePlatform 전달
- `mq-publisher.service.ts:28-33`: `SubmissionEvent` interface에 `sourcePlatform?: string` 추가
- `saga-orchestrator.service.ts`: AI analysis 큐 발행부에서 Problem 조회 결과의 `sourcePlatform` 전달
- ai-analysis Worker가 MQ event에서 `sourcePlatform`을 읽어 프롬프트에 전달

### ai-analysis — 프롬프트 플랫폼 맥락 주입
- `prompt.py`: `_build_platform_context()` 함수 신규 — `BOJ`이면 표준 입출력/시간복잡도, `PROGRAMMERS`이면 solution() 함수 시그니처/반환값/에지 케이스 맥락 한 줄 prepend
- `SYSTEM_PROMPT`는 공통 유지 (변경 최소화, Jinja2 미도입)
- `main.py:288-291`: `GroupAnalysisRequest`에 `source_platform: str | None = None` 추가
- `worker.py:191-315`: MQ event에서 `sourcePlatform` 추출하여 프롬프트 함수에 전달
- 테스트: `test_prompt.py` BOJ/PROGRAMMERS/None 4건 + `test_worker.py` MQ sourcePlatform 1건 → **176 tests ALL PASS**

### Gateway — tags 크롤러 + 373건 재수집
- `scripts/fetch-programmers-tags.ts` 신규: Playwright chromium headless로 개별 문제 상세 페이지 breadcrumb 파싱. 300~500ms jitter, 429 시 exponential backoff, 드라이런 옵션
- `BREADCRUMB_SELECTORS`: 7개 cascade로 셀렉터 우선순위 탐색
- `SKIP_KEYWORDS`: 12개 — 최상위 네비게이션 범주 + UI 라벨 노이즈 (`도움말`, `컴파일 옵션`, `전체보기`, `로그인`, `마이페이지`)
- `programmers-problems.json`: 373건 tags 보강 완료 (Zod 검증 통과). PCCP 2025 12건은 breadcrumb 미존재로 미분류 폴백
- `programmers.service.spec.ts`: tags 회귀 테스트 추가

### Frontend — WCAG 스크립트 + Light --primary 조정
- `scripts/check-wcag.ts` 신규: globals.css에서 CSS 변수 파싱, WCAG 2.1 상대 휘도 공식으로 대비비 산출 (의존성 0)
- 검증 페어: Light/Dark × `--primary on --bg-alt` / `--text on --bg-card` / `--text on --bg-alt` — 총 6쌍
- Light `--primary` `#7C6AAE`→`#715DA8` 변경: 기존 4.07:1 → 변경 후 4.51:1 (AA 4.5:1+ 충족)
- `package.json`: `check:wcag` 스크립트 등록

### E2E — Jest 통합 13건 + CI job
- `tests/e2e/programmers-full-flow.spec.ts`: 프로그래머스 문제 생성 → 제출 → GitHub 커밋(`PROGRAMMERS_1845_폰켓몬.py`) → AI 피드백 플랫폼 맥락 포함 — 전 구간 assertion
- 외부 의존성: GitHub API / Claude API는 MSW 스텁으로 차단
- `.github/workflows/ci.yml`: `e2e-programmers` job 추가 (PR 병렬 실행)

### P1 해결 — Python 호환성
- `pyproject.toml`: `requires-python = ">=3.13"` → `">=3.12"` 완화 (Docker 이미지 `python:3.12-slim` 대응)
- `requirements-dev.txt`: `ruff>=0.4.0` 업그레이드 (Python 3.12 호환)

## 검증 결과

Gatekeeper 보고서 (`gatekeeper-task-20260420-003115-r5-gatekeeper.md`) 기준:

| 항목 | 결과 |
|---|---|
| 전체 테스트 | **2,445 tests ALL PASS** |
| Gateway (50 suites) | ✅ PASS |
| GitHub Worker (116 tests) | ✅ PASS (PGM 신규 3건 포함) |
| ai-analysis (176 tests) | ✅ PASS (플랫폼 맥락 5건 포함) |
| Frontend (1,153 tests) | ✅ PASS |
| E2E (13 tests) | ✅ PASS |
| 커버리지 | 전 서비스 60%+ (최소 69.7% branch) |
| `tsc --noEmit` | ✅ 0 error |
| ESLint `no-console:'error'` | ✅ 0 위반 |
| Ruff `T20` | ✅ 0 위반 |
| WCAG AA (6/6 쌍) | ✅ 전부 4.5:1+ PASS |
| P1 (Python 호환성) | ✅ architect `aea6811` + `bce4a0b`에서 해결 |

## 결정

### 1. formatPlatform 대문자 풀네임 통일
**맥락**: BOJ는 이미 대문자 `'BOJ'`로 저장되는데 프로그래머스만 `'Programmers'`처럼 혼재하면 파일명 일관성이 깨진다.
**결정**: 모든 플랫폼을 대문자 풀네임으로 통일 (`'PROGRAMMERS'`, `'LEETCODE'`, `'SOFTEER'`, `'SWEA'`). GitHub 커밋 파일명에 그대로 사용.

### 2. AI 프롬프트 한 줄 주입 (SYSTEM_PROMPT 유지, Jinja2 미도입)
**맥락**: 플랫폼별로 분석 관점이 다르다 (BOJ=표준입출력/복잡도, PGM=solution 함수 시그니처). 프롬프트 분기가 필요하되 템플릿 엔진 도입은 과도하다.
**결정**: `_build_platform_context()` 함수로 유저 프롬프트 선두에 한 줄 맥락만 prepend. SYSTEM_PROMPT는 공통 유지. Jinja2 미도입 — 현재 2개 플랫폼으로 if/elif가 명료하고, 의존성 증가 없이 유지보수 가능.

### 3. tags 크롤러 2차 패스 분리
**맥락**: 1차 크롤러(`fetch-programmers-problems.ts`)는 목록 페이지에서 문제 메타데이터(id/title/level)를 수집한다. tags는 개별 상세 페이지 breadcrumb에만 존재하므로 별도 2차 패스가 필요하다.
**결정**: 별도 스크립트(`fetch-programmers-tags.ts`)로 분리. 1차 크롤러 책임(목록 수집) 유지, 2차 패스는 독립 실행·이터레이션 가능. SKIP_KEYWORDS로 노이즈 필터링, 셀렉터 cascade로 HTML 구조 변경에 대응.

### 4. WCAG 검증 스크립트화
**맥락**: Sprint 96에서 대비비 수동 검증이 이월되었다. 수동 눈검사는 반복성이 없고 토큰 변경 시 회귀를 잡지 못한다.
**결정**: `check-wcag.ts` 스크립트로 자동화. 의존성 0 (WCAG 2.1 상대 휘도 공식 자체 구현), globals.css CSS 변수 직접 파싱, CI에서 `check:wcag`로 자동 실행. 임계 미달 시 exit 1.

## 교훈

- **크롤러 셀렉터 cascade에서 UI 라벨 오염 가능**: PCCP 2025 문제에서 `'도움말'`, `'컴파일 옵션'` 등 사이드 메뉴 라벨이 breadcrumb로 오인 추출됨. `SKIP_KEYWORDS` + 미분류 폴백 패턴을 확립하여 반복 이터레이션이 가능한 구조로 설계
- **Light `--primary` 4.07:1 미달**: `#7C6AAE`가 `--bg-alt`(`#F4F3F0`) 위에서 WCAG AA 4.5:1 미달. 디자인 토큰 변경 시 WCAG 사전 검증 CI를 반드시 포함해야 한다. `#715DA8`로 조정하여 4.51:1 확보
- **Python Docker 환경과 로컬 호환 이슈**: `pyproject.toml`의 `requires-python >= 3.13`이 Docker `python:3.12-slim` 이미지와 충돌. CI/로컬/Docker 세 환경의 Python 버전 하한을 일치시켜야 함

## 이월 항목

- **PCCP 2025 12건 미분류 폴백**: breadcrumb이 존재하지 않는 문제. 별도 스프린트에서 셀렉터 보강 또는 수동 태깅
- **CodeEditor.tsx `#7C6AAE` 하드코딩 3건**: Herald 토큰 참조로 전환 필요
- **Register UI 이식**: `/register`, `/register/profile`, `/register/github` (Sprint 95~96 로드맵 이월)
- **NotFound 404 페이지 UI 이식**: Sprint 95~96 로드맵 이월
- **`SolvedProblem` → `ExternalProblem` 리네이밍**: 안정화 후 리팩토링 스프린트에서 처리

## 로드맵 종결

BOJ→프로그래머스 전환 3-스프린트 로드맵이 완료되었다:

| 스프린트 | 범위 | 상태 |
|----------|------|------|
| Sprint 95 | 백엔드 인프라 — Gateway 외부 연동 + 데이터셋 373건 | ✅ 완료 |
| Sprint 96 | 프런트 UX — 플랫폼 토글 + `useProgrammersSearch` + 기본값 전환 | ✅ 완료 |
| Sprint 97 | 제출 파이프라인 + AI + tags + WCAG + E2E + 문서 | ✅ 완료 |

프로그래머스 문제의 전 생명주기 — 검색 → 등록 → 제출 → GitHub 커밋(`PROGRAMMERS_{id}_{title}.{ext}`) → AI 피드백(플랫폼 맥락 인지) — 가 정상 동작하며, 2,445 tests ALL PASS + WCAG AA 6/6 PASS로 검증되었다.
