---
sprint: 95
title: "프로그래머스 데이터셋 + Gateway 외부 연동"
date: "2026-04-20"
status: completed
---

# Sprint 95 — 프로그래머스 데이터셋 + Gateway 외부 연동

## 배경
백준(BOJ) 서비스 종료로 AlgoSu 문제 제공처를 프로그래머스로 전환해야 한다. 전환 범위가 백엔드·프런트·제출 파이프라인에 걸쳐 광범위해 **3개 스프린트 로드맵**(Sprint 95 백엔드 인프라 → Sprint 96 프런트 UX → Sprint 97 제출·문서)으로 분할. 본 스프린트는 1단계로, **사용자 가시 변화 0**을 원칙으로 백엔드 인프라만 선행 구축한다.

## 목표
- 프로그래머스 문제 메타데이터를 사전 큐레이션된 JSON으로 번들링해 검색 UX의 외부 API 의존성 제거
- Gateway에 BOJ(Solved.ac)와 **대칭 구조**의 외부 엔드포인트 `/api/external/programmers/*` 구축
- DTO `sourcePlatform`을 `@IsIn(['BOJ','PROGRAMMERS'])`로 강화해 플랫폼 허용값 명시
- 기존 BOJ 경로 회귀 0건 보장

## 작업 요약
| 커밋 | 담당 | 내용 |
|---|---|---|
| `adad5cf` | architect | ProgrammersService/Controller 골격 + external.module.ts 등록 + DTO `@IsIn` 확장 |
| `60b7925` | librarian | 데이터 번들링 결정 ADR (`docs/adr/sprint-95-programmers-dataset.md`) |
| `e460b79` | postman | Playwright 기반 크롤러 스크립트 + 초기 데이터셋 373건 |
| `18b3932` | curator | 데이터 품질 QA 리포트 (`PROGRAMMERS-QA.md`) |
| `2578ae0` | gatekeeper | 검증 리포트 + 749 tests PASS + BOJ 회귀 무결성 |
| `aff4b47` | Oracle | DTO 타입 강화 후속: `problem.service.spec.ts` 동기화 |

## 수정 내용

### Gateway 외부 모듈
- `services/gateway/src/external/programmers.service.ts` — JSON 기동 시 로드, `Map<problemId, Info>` 메모리 캐시, `fetchProblem`/`searchProblem` — SolvedacService 인터페이스 대칭
- `services/gateway/src/external/programmers.controller.ts` — `GET /problem/:problemId`, `GET /search?query=&page=`, Swagger `External — Programmers`
- `services/gateway/src/external/external.module.ts` — ProgrammersService/Controller 등록(기존 Solvedac 병치)
- 데이터 봉투 구조: `{ version: ISO8601, items: ProgrammersProblemInfo[] }` + 레거시 배열 하위 호환(`isDataEnvelope()` 타입 가드)

### 크롤러 & 데이터셋
- `services/gateway/scripts/fetch-programmers-problems.ts` — Playwright chromium headless로 `/learn/challenges?levels=N&order=acceptance_desc&page=M` 순회. 레벨별 독립 페이지네이션, 신규 항목 0개 시 종료, 300~500ms 랜덤 딜레이, HTML/URL 로깅 금지
- `services/gateway/data/programmers-problems.json` — **373건** 수집 (Lv.1:95 / Lv.2:132 / Lv.3:95 / Lv.4:31 / Lv.5:20), 42840(모의고사) 포함, zod 런타임 검증 통과

### DTO
- `services/problem/src/problem/dto/create-problem.dto.ts` — `SOURCE_PLATFORMS = ['BOJ','PROGRAMMERS'] as const` 추출, `@IsIn(SOURCE_PLATFORMS)` 적용, 타입 export
- DB 마이그레이션 **불필요** (기존 `source_platform` VARCHAR(50) 유지)

### 테스트 동기화
- `services/problem/src/problem/problem.service.spec.ts` L156/L414/L422 — 가상 플랫폼 리터럴('LeetCode','Codeforces') → `'PROGRAMMERS'` 교체. sourceUrl은 `@IsUrl` 검증만 걸려있어 최소 변경 원칙으로 유지

## 검증 결과
| 항목 | 결과 |
|---|---|
| Gateway 유닛 테스트 (50 suites / **749 tests**) | ✅ PASS |
| Gateway `tsc --noEmit` | ✅ 오류 0 |
| Gateway ESLint (src + scripts) | ✅ 오류 0 |
| Problem `problem.service.spec.ts` (35 tests) | ✅ PASS (초기 FAIL → Oracle 수정) |
| BOJ 회귀 (`solvedac.{service,controller}.ts` diff) | ✅ 0줄 변경 |
| 데이터 품질(중복/누락/인코딩/대표문제 포함) | ✅ 6 PASS / 1 WARN(tags) |

## 결정
- **사전 JSON 번들링 > 실시간 파싱/비공식 API**: 공식 API 부재 + Cloudflare JA3 차단(Sprint 83 전례) + 문제 풀 유한(373건)/갱신 빈도 낮음. 운영 안정성 우선
- **검색 API도 번들링 기반**: Solvedac과 대칭되는 `search` 엔드포인트를 인-메모리로 제공 → Sprint 96 프런트에서 동일 UX로 구현 가능
- **Lv.1~5 ↔ BRONZE~DIAMOND 1:1 매핑**: 디자인 토큰 0줄 수정으로 기존 `Difficulty` enum·스타일 토큰 재사용
- **DTO `@IsIn` 강화**: 자유 문자열 허용에서 허용값 제한으로 전환. 입력 경계에서 불일치를 조기 차단. DB는 VARCHAR 유지 → Expand-Contract 불필요
- **브랜치 규율 복원**: architect가 실수로 main에 직접 커밋했던 adad5cf를 `feat/gateway-programmers-dataset` 브랜치로 이동 후 main 리셋(로컬 단계). "main 직접 push 금지" 규칙 준수

## 교훈
- **외부 메타데이터 소스 선택은 "갱신 빈도 × 가용 API 품질"로 결정**한다. 프로그래머스처럼 증가 빈도 낮고 공식 API 없는 대상은 사전 번들링이 실시간 파싱보다 총비용이 낮다
- **대규모 전환 작업은 단일 스프린트에 몰지 말고 독립 배포 가능한 단위로 분할**한다. 단일 스프린트 플랜 초안이 데이터 인프라 + 백엔드 + 프런트 + 제출 + 문서까지 몰아넣어 회귀·QA 리스크가 커졌고, 사용자 피드백으로 3-스프린트 로드맵으로 재설계
- **Oracle 디스패치 파이프라인은 의존성 분석을 Wave로 관리**할 때 효과적이다. scout→postman→curator 체인과 librarian 병렬 배치가 자연스러웠음
- **DTO 타입 강화는 반드시 기존 spec 파일의 리터럴도 함께 업데이트**해야 한다. `@IsIn([...])` + `as const` 도입 시 해당 타입을 참조하는 모든 테스트의 하드코딩 문자열이 TS2322 후보. gatekeeper Wave 3에서 조기 검출됨
- **tmux pane 리소스는 세션 장기 유지 시 누수된다**. oracle dispatch 시 stale pane/lock 정리는 상시 필요. 좀비 세션이 lock만 남기는 사례(architect/gatekeeper)는 panes.json과 locks 디렉토리를 교차 검증해서 정리해야 한다
- **크롤러 건수 목표는 실제 가용 풀 확인 후 재조정**한다. scout 추정 600~800 vs 실제 373 — 3가지 정렬 교차검증으로 전체 공개 풀임을 확정. 목표를 고수하기보다 실용 충분성으로 수용

## 이월 항목 (Sprint 96~97)
- **tags 빈 배열 보강**: 373건 전체 tags 미수집. 개별 문제 상세 페이지 breadcrumb 크롤링으로 후속 수집 (postman, Sprint 96 또는 97)
- **프런트 UX 적용**: `programmersApi`, `useProgrammersSearch` 훅, `AddProblemModal` 플랫폼 토글 (Sprint 96)
- **GitHub Worker 확장**: `formatPlatform()` `'programmers' → 'PROGRAMMERS'` 케이스 + 파일명 `prg_` 접두어 (Sprint 97)
- **AI 피드백 프롬프트**: `sourcePlatform` 동적 주입 (Sprint 97)
