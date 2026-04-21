---
sprint: 109
title: "SQL 학습 경험 마감"
period: "2026-04-21"
status: complete
start_commit: 972ca49
end_commit: bc6758d
---

# Sprint 109 — SQL 학습 경험 마감

## 배경

Sprint 108은 프로그래머스 SQL 문제를 "검색 → 등록 → 제출 → AI feedback 수신"까지 파이프라인으로 완주시켰다. 그러나 두 가지 품질 부채가 남았다.

1. **D2 Known Limitation**: AI 프롬프트가 SQL 제출에도 알고리즘 루브릭("시간 복잡도", "공간 복잡도" 등)을 그대로 적용하여 SQL 맥락과 어긋나는 피드백을 생성할 수 있었다.
2. **Herald medium 후속**: `parseLevelText` regex가 확장되었지만 경계값 테스트가 4건(stripSqlTitleSuffix 전용)에 불과하여, 향후 프로그래머스 UI 변경 시 regression 방어가 미흡했다.

Sprint 109는 이 두 가지를 단일 세션에서 닫아 프로그래머스 SQL 지원의 **질적 완성**을 달성한다.

웨이브 구조: W1(Oracle 인라인 정찰) → W2-c1(Architect: SQL 루브릭) → W2-c2(Architect: regex 테스트) → W3(Sensei 검증) → W2.5(Architect: 긴급 교정) → W4(Scribe ADR).

## 목표

| 항목 | 내용 | 상태 |
|------|------|------|
| AI 프롬프트 SQL 분기 | `get_system_prompt(language)` + SQL_SYSTEM_PROMPT 도입 | ✅ 완료 |
| 가중치 SSOT 추출 | `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` + `get_weights(language)` | ✅ 완료 (W2.5) |
| `_parse_response` fallback 교정 | 하드코딩 가중치 → `get_weights(language)` 1줄 교체 | ✅ 완료 (W2.5) |
| parseLevelText 경계값 테스트 | 13건 추가 (Lv/Level/★/fallback/우선순위/범위) | ✅ 완료 |
| 전 서비스 테스트 회귀 방어 | threshold 충족 | ✅ 완료 |

---

## 결정 사항

### D1. JSON 스키마 호환성 유지

**결정**: SQL 루브릭도 동일 5개 카테고리명(`correctness`, `efficiency`, `readability`, `structure`, `bestPractice`) + 동일 JSON 응답 스키마를 사용한다. 프론트엔드 파싱 변경 0.

**근거**:
- 기존 프론트엔드 파서는 카테고리 `name` 필드 기반으로 렌더링한다. 카테고리명을 바꾸면 프론트엔드 수정이 필요하여 Sprint 범위를 초과한다.
- `timeComplexity` → "예상 쿼리 실행 방식 (Full Table Scan, Index Scan 등)", `spaceComplexity` → "임시 테이블/정렬 버퍼 사용 여부 (Using Temporary 등)"로 **의미만 재해석**하여 필드명은 유지.
- 프론트엔드 코드 변경 0건으로 하위 호환성 완전 유지.

### D2. 시스템 프롬프트 선택 함수 도입

**결정**: `prompt.py`에 `get_system_prompt(language: str) -> str` 함수 추가. `claude_client.py` L96에서 `system=SYSTEM_PROMPT` 하드코딩 → `system=get_system_prompt(language)` 호출로 교체.

**근거**:
- 기존 `_build_platform_context()` 분기 패턴과 동일한 구조. `analyze_code(language=)` 파라미터가 이미 존재하므로 새 인자 추가 없이 자연스러운 확장.
- `sql` → `SQL_SYSTEM_PROMPT`, 그 외 → `SYSTEM_PROMPT` 반환. 대소문자 무관(`language.lower()`).
- 향후 언어별 프롬프트 추가 시 `get_system_prompt`에 분기 추가만으로 확장 가능.

### D3. SQL 가중치 조정

**결정**: SQL 카테고리 가중치를 알고리즘과 차별화.

| 카테고리 | 알고리즘 | SQL | 차이 |
|----------|----------|-----|------|
| correctness | 30% | 30% | - |
| efficiency | 25% | 20% | -5% |
| readability | 15% | 15% | - |
| structure | 15% | 15% | - |
| bestPractice | 15% | 20% | +5% |

**근거**:
- SQL에서는 알고리즘적 효율성보다 **ANSI SQL 준수, 윈도우 함수 활용, 안티패턴 회피** 같은 모범 사례가 학습 가치가 높다.
- `efficiency` 5%를 `bestPractice`로 이전하여 SQL 도메인 특성 반영.
- 두 가중치 세트 모두 합계 100% 검증 (테스트에서 `abs(sum - 1.0) < 1e-9` 확인).

### D4. Fallback 가중치 SSOT 추출 (W3 Sensei 발견 → W2.5 교정)

**결정**: `prompt.py`에 `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` 상수 딕셔너리 + `get_weights(language: str)` 함수 추가. `claude_client.py`의 `_parse_response` 시그니처를 `(raw_text, language="python")`으로 확장하고, L203-209의 하드코딩 가중치를 `get_weights(language)` 1줄로 교체.

**근거**:
- Sensei W3 검증에서 발견: `_parse_response` L203-209에 알고리즘 전용 가중치(`correctness: 0.30, efficiency: 0.25, ...`)가 하드코딩되어 있어, SQL 제출의 `totalScore=0` fallback 시에도 알고리즘 가중치가 적용되는 버그.
- 프롬프트 본문의 가중치와 코드 가중치의 **정합성 문제** → SSOT 상수 추출로 구조적 해결.
- `language` 기본값 `"python"` → 기존 호출(`test_parse_total_score_zero_with_categories_recalculates` 등)은 `ALGORITHM_WEIGHTS` 사용으로 기존 기대값 유지.

---

## 팩트 대조표 (Scribe 검증)

| # | 팩트 항목 | 기대값 | 실측값 (출처) | 일치 |
|---|-----------|--------|--------------|------|
| 1 | 커밋 수 (972ca49..HEAD) | 3 | 3 (`git log --oneline`) | ✅ |
| 2 | 변경 파일 수 | 5 | 5 (`git diff --stat`: prompt.py, claude_client.py, test_prompt.py, fetch-programmers-problems.ts, fetch-programmers-problems.spec.ts) | ✅ |
| 3 | 삽입/삭제 | 321+/15- | 321 insertions, 15 deletions (`git diff --stat`) | ✅ |
| 4 | test_prompt.py 테스트 추가 | 19건 (TestSqlSystemPrompt 6 + TestGetSystemPrompt 5 + TestWeights 8) | 19건 (L138-249 실측) | ✅ |
| 5 | parseLevelText 테스트 추가 | 13건 | 13건 (fetch-programmers-problems.spec.ts L44-109 실측) | ✅ |
| 6 | 총 테스트 추가 | 32건 | 32건 (19 + 13) | ✅ |
| 7 | Sprint 108 D2 Known Limitation 해소 | YES | YES — `get_system_prompt("sql")` → SQL_SYSTEM_PROMPT 반환 확인 | ✅ |
| 8 | `_parse_response` language 파라미터 | 추가, default="python" | L149 `language: str = "python"` 확인 | ✅ |
| 9 | `get_weights("sql")` → SQL_WEIGHTS | is SQL_WEIGHTS | test_prompt.py L235-236 확인 | ✅ |
| 10 | parseLevelText export | export function | L120 `export function parseLevelText` 확인 | ✅ |
| 11 | Level 타입 export | export type | L65 `export type Level` 확인 | ✅ |
| 12 | SQL_WEIGHTS 합계 | 1.0 | correctness 0.30 + efficiency 0.20 + readability 0.15 + structure 0.15 + bestPractice 0.20 = 1.00 | ✅ |
| 13 | ALGORITHM_WEIGHTS 합계 | 1.0 | correctness 0.30 + efficiency 0.25 + readability 0.15 + structure 0.15 + bestPractice 0.15 = 1.00 | ✅ |

---

## 산출물 및 변경 파일 목록

| 파일 | 작업 | 웨이브 | 설명 |
|------|------|--------|------|
| `services/ai-analysis/src/prompt.py` | 수정 | W2-c1/W2.5 | SQL_SYSTEM_PROMPT 상수, get_system_prompt(), ALGORITHM_WEIGHTS, SQL_WEIGHTS, get_weights() 추가 |
| `services/ai-analysis/src/claude_client.py` | 수정 | W2-c1/W2.5 | system= 하드코딩 → get_system_prompt(language), _parse_response(language=) 파라미터 확장, 가중치 SSOT 연동 |
| `services/ai-analysis/tests/test_prompt.py` | 수정 | W2-c1/W2.5 | TestSqlSystemPrompt 6건 + TestGetSystemPrompt 5건 + TestWeights 8건 = 19건 추가 |
| `services/gateway/scripts/fetch-programmers-problems.ts` | 수정 | W2-c2 | parseLevelText + Level 타입에 export 추가 |
| `services/gateway/scripts/fetch-programmers-problems.spec.ts` | 수정 | W2-c2 | parseLevelText 경계값 테스트 13건 추가 |

커밋 목록:
- `918409d` — feat(ai-analysis): SQL 전용 루브릭 + get_system_prompt 분기
- `69b02cb` — test(gateway): parseLevelText 경계값 테스트 보강
- `bc6758d` — fix(ai-analysis): fallback 가중치 SSOT 추출 — language별 분기

---

## 교훈

### 1. Scout 역할 유연화 — Oracle 인라인 정찰의 효율성

W1에서 Oracle이 scout 에이전트를 별도 디스패치하지 않고 직접 코드 구조를 파악했다. Sprint 108의 scout은 프로그래머스 SQL Kit **페이지 탐색**(UX 정찰)이 핵심이었지만, Sprint 109는 `prompt.py` 루브릭 구조 / `claude_client.py` 호출 패턴 / `parseLevelText` regex 상태 같은 **코드 구조 분석**이 핵심이었다. 코드 분석 정찰은 Oracle이 인라인으로 흡수하는 것이 에이전트 왕복 비용을 절감한다.

### 2. Sensei 검증의 실효성 — 드라이 리뷰가 버그를 사전 발견

W3 Sensei가 SQL 루브릭의 품질과 JSON 스키마 호환성을 검증하던 중, `_parse_response` L203-209의 fallback 가중치가 알고리즘 전용으로 하드코딩되어 있는 문제를 발견했다. 이 버그는 SQL 제출에서 `totalScore=0` 응답이 올 때만 발현되므로, 일반 테스트에서는 드러나지 않았을 것이다. **코드 변경 없는 드라이 리뷰 웨이브**가 실질적인 버그 발견 가치를 입증했다.

### 3. Sprint 내 긴급 교정 결단 — W2.5 패턴의 재현

Sprint 108 W4.5(title suffix 교정)와 동일한 패턴. W3 Sensei가 발견한 fallback 가중치 버그를 Sprint 110+으로 이월하지 않고, W2.5로 즉시 교정했다. 교정 비용(1개 웨이브, 1개 커밋)이 별도 스프린트에서 컨텍스트를 재구성하는 비용보다 작다는 판단. **알려진 품질 결함은 같은 스프린트에서 닫는다**는 원칙의 2회 연속 적용.

### 4. SSOT 원칙 — 프롬프트 본문과 코드 가중치의 정합성

SQL_SYSTEM_PROMPT 본문에 "correctness 30%, efficiency 20%, ..." 가중치가 명시되고, `_parse_response`의 fallback 계산에도 동일 가중치가 필요하다. 이 두 곳이 독립적으로 유지되면 불일치 위험이 상존한다. `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` 상수를 `prompt.py`에 SSOT로 추출하고, 프롬프트 본문의 가중치와 테스트(`test_sql_efficiency_differs_from_algorithm`)로 교차 검증하는 구조를 확립했다.

---

## 이월 항목 (Sprint 110+)

### Sprint 109 신규 이월

- **`_parse_response` fallback E2E 검증**: fallback이 실제 Claude API 응답(totalScore=0 케이스)에서 정상 동작하는지 E2E 검증. 로컬 Python 3.10+ 환경 필요.
- **GROUP_SYSTEM_PROMPT SQL 분기**: 현재 그룹 분석(`group_analyze`)에는 SQL 루브릭 미적용. 그룹 분석 자체가 SQL에서 사용 빈도가 낮아 우선순위 Low.

### Sprint 108에서 승계된 이월 (변화 없음)

- **SQL Kit 재크롤링 주기 문서화** (Low): `PROGRAMMERS-QA.md`에 재크롤링 주기 명시.
- **host-side 빌드 전환**: Blog/Frontend `npm run build` → GHA cache → Docker COPY 전용 (LARGE — 별도 스프린트). 세부는 `memory/sprint-106-deferred-items.md` 참조.
- 소규모 번들: APK_CACHE_BUST 조건화 / NestJS tsc incremental / Monaco dynamic import / heavy deps audit / ai-analysis `pyproject.toml` `branch=true` 활성화 / `scripts/check-coverage.mjs` 서비스별 독립 게이트 도입.
- 블로그 `order` 자동화, 시리즈 심화편 옵션.

---

## 관련 문서

- `services/ai-analysis/src/prompt.py` — SQL_SYSTEM_PROMPT, get_system_prompt(), ALGORITHM_WEIGHTS, SQL_WEIGHTS, get_weights()
- `services/ai-analysis/src/claude_client.py` — get_system_prompt(language) 호출, _parse_response(language) 분기
- `services/ai-analysis/tests/test_prompt.py` — SQL 관련 테스트 19건
- `services/gateway/scripts/fetch-programmers-problems.ts` — parseLevelText export, Level 타입 export
- `services/gateway/scripts/fetch-programmers-problems.spec.ts` — parseLevelText 경계값 테스트 13건
- `docs/adr/sprints/sprint-108.md` — 선행 스프린트 (D2 Known Limitation 원본)
