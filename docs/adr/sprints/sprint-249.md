---
sprint: 249
title: "AI 분석 난이도 컨텍스트 + 구조화 파싱 — difficulty/level 주입 + Problem 구조화 필드"
date: "2026-07-15"
status: completed
agents: [Oracle, Conductor, Sensei, Curator, Critic]
related_adrs: ["sprint-248", "sprint-238", "sprint-97"]
related_memory: ["sprint-window", "sprint-249-ssot-drift"]
topics: ["ai-analysis", "problem", "submission", "crawler", "difficulty", "structured-content"]
tldr: "Sprint 248 AI 컨텍스트 풍부화 2차 확장. Wave C: Submission entity에 difficulty/level 컬럼 추가(TypeORM 마이그레이션) → 제출 생성 시 Problem Service에서 복사 저장 → ai-analysis _build_difficulty_context()로 난이도별 루브릭 보정 주입. Wave D: Problem entity에 inputDescription/outputDescription/constraints/examples 구조화 필드 추가 + TypeORM 마이그레이션 → Programmers 크롤러 구조화 파싱 확장(입출력 예시 테이블·제약조건 분리) → ai-analysis <structured_content> 블록 주입. Wave C PR #464 머지 커밋 6882dc7 / Wave D PR #465 커밋 b5b1fbb+87ee8bb. Submission 388 passed·98.69% / AI Analysis 379 passed·98.89% / Problem 213 passed·96.79%. Critic 게이트: Wave D P2 example 셀 sanitize 누락 → 수정 후 CLEAN."
---
# Sprint 249 — AI 분석 난이도 컨텍스트 + 구조화 파싱

## 목표

- **Wave C**: AI 분석 프롬프트에 난이도(`difficulty`/`level`) 컨텍스트를 주입해 브론즈·플래티넘 기대치 차이를 루브릭에 반영한다.
- **Wave D**: Programmers 크롤러를 확장해 입출력 예시·제약조건을 구조화 필드로 분리 저장하고, AI 프롬프트에 `<structured_content>` 블록으로 주입한다.
- Sprint 248에서 문제 제목·설명만 주입하던 한계를 극복해 AI가 문제의 전체 스펙을 참조할 수 있도록 한다.

## 배경

- Sprint 248에서 그룹 분석 문제 컨텍스트 주입(Wave B)과 Programmers 크롤러(Wave A)를 완료했으나, 두 가지 한계가 남았다.
  1. **난이도 컨텍스트 부재**: AI가 브론즈 난이도 코드와 플래티넘 난이도 코드를 동일 기준으로 평가함 — 루브릭 보정 불가.
  2. **description 전문(全文) 주입**: 크롤링된 원문 HTML을 통째로 주입 — 입출력 예시와 제약조건이 자연어 설명에 뭉쳐 AI 파싱 비용 증가.
- `Submission` entity에 `difficulty`/`level` 필드가 이미 존재한다는 가정이 있었으나, Wave C 착수 전 실측 확인 → 실제로 없었음 (마이그레이션 필요).

## 결정

### D1. 난이도 컨텍스트 — Submission 복사 저장 방식

- Problem entity의 `difficulty`/`level`을 AI 분석 요청 시마다 조회하는 대신, **제출 생성 시점에 Submission에 복사 저장**하는 방식을 선택.
- 이유: 분석 요청 시 Problem Service 추가 호출을 피하고, 제출 당시 난이도를 스냅샷으로 보존.
- Submission 마이그레이션: `difficulty VARCHAR(20) NULL`, `level INT NULL` 컬럼 추가.
- ai-analysis `_build_difficulty_context()`: 레벨과 난이도에 따라 루브릭 보정 문구 생성 (브론즈·실버·골드·플래티넘·다이아 5단계 + Programmers 레벨 5단계).

### D2. 구조화 파싱 — Problem entity 별도 필드 + 크롤러 확장

- `Problem` entity에 `inputDescription TEXT NULL`, `outputDescription TEXT NULL`, `constraints TEXT NULL`, `examples TEXT NULL` 4개 구조화 필드 추가.
- Programmers 크롤러(`crawler.service.ts`) 확장: `div.markdown` 파싱 시 입출력 예시 테이블(`.example-io`) + 제약조건(`<h5>`)을 별도 파싱 → 구조화 필드에 저장.
- ai-analysis `<structured_content>` 블록: 구조화 필드가 있을 때만 `<input_spec>`, `<output_spec>`, `<constraints>`, `<examples>` 서브블록 주입 — ADR-030 S-5 프롬프트 인젝션 방어 패턴 재활용.

### D3. Critic P2 — example 셀 sanitize 적용

- `_format_examples()` 함수가 입출력 예시 테이블 셀 값을 `_sanitize_problem_field()` 없이 직접 주입 → `<problem_context>` 태그 포함 시 프롬프트 경계 파괴 위험.
- 수정: 헤더 + 모든 셀 값에 `_sanitize_problem_field()` 적용.
- 테스트 2건 추가: 일반 sanitize + 태그 포함 악성 셀 차단.

## 구현

### Wave C — difficulty/level 컨텍스트 주입 (ai-analysis + submission, Oracle 직접)

| 파일 | 변경 내용 |
|------|----------|
| `submission/src/submission/submission.entity.ts` | `difficulty`/`level` nullable 컬럼 추가 |
| `submission/src/database/migrations/…AddDifficultyLevel.ts` | TypeORM 마이그레이션 |
| `submission/src/submission/submission.service.ts` | `create()` 시 ProblemServiceClient 응답에서 difficulty/level 저장 |
| `ai-analysis/src/prompt.py` | `_build_difficulty_context()` 신설 + `build_user_prompt()` 파라미터 추가 |
| `ai-analysis/src/worker.py` | difficulty/level 메시지 필드 추출 → `analyze_code()` 전달 |
| `ai-analysis/tests/` | 테스트 업데이트 |

- PR #464 squash merge → **`6882dc7`** (2026-07-15)
- **Submission**: 388 passed · Branches 98.69% ≥ 98%
- **AI Analysis**: 359 passed · TOTAL 99%+
- 보안 패치 동봉: `multer` CVE-2026-5079 — submission 서비스 2.1.1 → 2.2.0 (Sprint 248에서 problem만 패치, submission 누락 수정)

### Wave D — 구조화 파싱 + AI 주입 (problem + ai-analysis, Oracle 직접)

| 파일 | 변경 내용 |
|------|----------|
| `problem/src/problem/problem.entity.ts` | `inputDescription`/`outputDescription`/`constraints`/`examples` 4 필드 추가 |
| `problem/src/database/migrations/…AddStructuredContentToProblems.ts` | TypeORM 마이그레이션 |
| `problem/src/crawler/crawler.service.ts` | 구조화 파싱 확장 (입출력 예시 테이블·제약조건 분리) |
| `ai-analysis/src/prompt.py` | `_format_examples()` + `<structured_content>` 블록 (입출력·제약조건) |
| `ai-analysis/src/worker.py` | structured content 필드 추출 + `analyze_code()` 전달 |
| `ai-analysis/src/claude_client.py` | 구조화 데이터 파라미터 추가 |
| `ai-analysis/src/main.py` | Problem Service 조회 시 structured fields 전달 |
| 테스트 다수 | ai-analysis 138줄↑ + problem 163줄↑ 신규 케이스 |

- Wave D 커밋: `b5b1fbb` (Wave D 본체) · `ac70dbd` (ruff 자동 정렬) · `87ee8bb` (Critic P2 sanitize 수정)
- **AI Analysis**: 379 passed · TOTAL 98.89% ≥ 98%
- **Problem**: 213 passed · Branches **96.79%** ≥ 96% · Functions 98.61% ≥ 98%
- **ESLint**: Errors 0

### Critic 게이트 (Wave D)

| 등급 | 내용 | 수정 |
|------|------|------|
| **P2** example 셀 sanitize 누락 | `_format_examples()` — 셀 값에 `_sanitize_problem_field()` 미적용 → 악성 태그로 프롬프트 경계 파괴 가능 | 헤더·셀 전체 sanitize 적용 + 테스트 2건 추가 (`87ee8bb`) |

- Wave C Critic 게이트: **CLEAN** (Findings 0건)
- Wave D Critic 게이트: P2 1건 수정 후 **CLEAN**

## 검증

| 항목 | Wave C | Wave D |
|------|--------|--------|
| **CI** | ✅ 38/38 PASS | ✅ 38/38 PASS |
| **Submission** | 388 passed · 98.69% | — |
| **AI Analysis** | 359 passed | 379 passed · 98.89% |
| **Problem** | — | 213 passed · Branches 96.79% |
| **Critic** | ✅ CLEAN | ✅ CLEAN (P2 수정 후) |
| **PR** | #464 → `6882dc7` | #465 → `b5b1fbb`+`87ee8bb` |

## 교훈

1. **Submission 마이그레이션은 entity 실측 필수.** `difficulty`/`level`이 이미 있다는 가정 → 실제로 없었음 → 마이그레이션 필요. "이미 있다"는 추정은 코드 grep으로 확인 후 착수.
2. **구조화 필드 분리가 AI 프롬프트 효율을 높인다.** description 전문 주입보다 `<input_spec>`·`<output_spec>`·`<constraints>` 서브블록이 AI 파싱 명확성을 개선 — Sprint 248 교훈(패턴 재활용)의 연장.
3. **sanitize는 새로운 포맷팅 함수마다 명시적으로 적용해야 한다.** `_format_examples()`가 `_sanitize_problem_field()` 없이 셀 값을 그대로 주입 → Critic이 P2로 지적. 새 포맷터 함수 추가 시 "입력 신뢰 불가" 원칙: 모든 외부 데이터는 sanitize 통과 후 프롬프트에 주입.
4. **동일 스프린트 내 멀티 서비스 CVE 패치는 전수 확인이 필요하다.** Sprint 248에서 ai-analysis/problem만 multer 패치 → submission 누락 → Wave C CI Trivy FAIL. 멀티 서비스 취약점 패치 시 `find . -name "package.json" | xargs grep "multer"` 전수 grep 선행.
5. **ruff format 자동 정렬은 커밋 전 항상 실행.** Wave D 초기 커밋 후 CI `Quality — ai-analysis` ruff format FAIL → 별도 커밋으로 수정. `ruff format .` + `ruff check .`를 커밋 훅 또는 커밋 직전 체크리스트에 포함.

## 이월

- **Sprint 250 (예정)** — SSOT 드리프트 결정: CLAUDE.md Sprint 239 Q-5 아웃바운드 키 규정(`INTERNAL_KEY_<TARGET>`) vs 코드 실제 패턴(`<SERVICE>_SERVICE_KEY`) — (B) 문서 개정 방향 확정 후 Scribe ADR.
- GA4 Enhanced Measurement OFF · GA4 프로덕션 UAT · 서버 재배포 + 라이브 SEO 검증 (이월 지속).
- 🔴 보안: ANTHROPIC_API_KEY 재로테이션 (사용자 보류 중).
