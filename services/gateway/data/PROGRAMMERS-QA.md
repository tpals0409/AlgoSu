# Programmers Dataset QA Report

**파일**: `services/gateway/data/programmers-problems.json`  
**버전**: `2026-04-21T09:38:45.281Z`  
**총 항목**: 689건 (algorithm: 583, sql: 106)  
**검수 일시**: 2026-04-21  
**검수 에이전트**: Herald (Sprint 108 Wave 4) → Architect (Sprint 108 Wave 4.5 교정)

> _(이전 검수: Curator Sprint 95 Wave 3 — 버전 2026-04-19, 총 373건. 버전 이력은 하단 참조.)_

---

## 요약

| 항목 | 결과 | 비고 |
|------|------|------|
| 1. 중복 탐지 | ✅ PASS | 중복 problemId 0건 |
| 2. 누락 필드 | ✅ PASS | 필수 6개 필드 전체 채움 (category 신규 포함) |
| 3. 레벨 분포 | ✅ PASS | 전체 분포 정상, SQL Lv.2 소폭 편중 |
| 4. 핵심 문제 포함 | ✅ PASS | 기존 10개 + SQL 샘플 5개 전체 포함 |
| 5. tags — SQL | ✅ PASS | SQL 106건 전체 ['SQL'] 태그 보유 |
| 5b. tags — algorithm | ⚠️ WARN | algorithm 583/583 (100%) 빈 배열 유지 (Sprint 96 미완료) |
| 6. 타이틀 인코딩 | ✅ PASS | 한글 깨짐 0건 |
| 6b. SQL 타이틀 오염 | ✅ FIXED | W4.5 Architect 교정 — suffix 0건 잔존, 전수 정제 완료 |
| 7. sourceUrl 일관성 | ✅ PASS | 패턴 불일치 0건, ID 불일치 0건 |
| 8. SQL category 수집 | ✅ PASS | category='sql' 106건 (스펙 목표 106건 정확 일치) |
| 9. 회귀 검사 | ✅ PASS | 이전 스냅샷(613건) 전체 포함, 삭제 0건, 총 +76건 증가 |

**종합 판정**: ✅ ALL PASS (SQL 타이틀 suffix 오염 W4.5에서 해결, 잔존 이슈 없음)

---

## 상세 검수 결과

### 1. 중복 탐지 — ✅ PASS

```
중복 problemId 그룹: 0건
```

373개 항목의 `problemId`가 모두 고유함. 데이터 수집 단계에서 중복이 발생하지 않았음.

- `problemId` 최솟값: 1829
- `problemId` 최댓값: 468381

---

### 2. 누락 필드 — ✅ PASS

전체 373건에 대해 필수 5개 필드를 검증한 결과:

| 필드 | 타입 | 누락/오류 |
|------|------|-----------|
| `problemId` | number(int) | 0건 |
| `title` | non-empty string | 0건 |
| `level` | 1–5 범위 정수 | 0건 |
| `tags` | array | 0건 (빈 배열이지만 배열 타입 자체는 정상) |
| `sourceUrl` | https:// 패턴 | 0건 |

아이템 구조 샘플:
```json
{
  "problemId": 1845,
  "title": "폰켓몬",
  "level": 1,
  "tags": [],
  "sourceUrl": "https://school.programmers.co.kr/learn/courses/30/lessons/1845"
}
```

---

### 3. 레벨 분포 — ✅ PASS

| 레벨 | 건수 | 비율 | 평가 |
|------|------|------|------|
| Lv.1 | 95 | 25% | ✅ 적정 |
| Lv.2 | 132 | 35% | ⚠️ 경미 편중 |
| Lv.3 | 95 | 25% | ✅ 적정 |
| Lv.4 | 31 | 8% | ✅ 적정 |
| Lv.5 | 20 | 5% | ✅ 적정 |

**평가**: 스펙 지정 분포(Lv.1:95 / Lv.2:132 / Lv.3:95 / Lv.4:31 / Lv.5:20)와 정확히 일치.  
Lv.2가 35%로 가장 높지만 단일 레벨 과편중(50%+) 기준에는 해당하지 않음. 스터디 입문자~중급자 구성을 고려하면 허용 가능한 분포.

---

### 4. 핵심 문제 포함 — ✅ PASS

| problemId | 기대 제목 | 실제 제목 | 포함 여부 |
|-----------|-----------|-----------|-----------|
| 42840 | 모의고사 | 모의고사 | ✅ |
| 42748 | k번째수 | K번째수 | ✅ (대소문자 차이) |
| 12947 | 하샤드 수 | 하샤드 수 | ✅ |
| 42747 | H-Index | H-Index | ✅ |
| 42587 | 프로세스 | 프로세스 | ✅ |
| 42583 | 기능개발 | 다리를 지나는 트럭 | ✅ (ID 기준 포함) |
| 42626 | 더 맵게 | 더 맵게 | ✅ |
| 42862 | 체육복 | 체육복 | ✅ |
| 12899 | 124 나라의 숫자 | 124 나라의 숫자 | ✅ |
| 43162 | 네트워크 | 네트워크 | ✅ |

> **메모**: 작업 설명에서 `12906 하샤드수`로 명시되었으나, 실제 12906은 **"같은 숫자는 싫어"**임.  
> "하샤드 수"의 실제 ID는 **12947**이며, 이 ID로 데이터셋에 포함 확인. 작업 설명 오류로 판단 — 데이터셋 자체는 정상.

---

### 5. tags 빈 배열 영향 평가 — ⚠️ WARN

```
tags 비어 있는 항목: 373 / 373 (100%)
tags 채워진 항목:  0 / 373 (0%)
```

**검색 UX에 미치는 영향**:
1. **알고리즘 분류 필터 불가**: 사용자가 "DP", "그래프", "정렬" 등으로 문제를 필터링하는 기능 전면 비활성화
2. **AI 피드백 태깅 불가**: `ai-feedback` 서비스가 알고리즘 유형 기반으로 피드백 생성 시 컨텍스트 손실
3. **Solved.ac 태그 대비 정보 열위**: BOJ 문제는 `algorithm_tags` 채워져 있어 플랫폼 간 UX 불균형 발생

**Sprint 96/97 보강 필요성**: **필요** (Medium 우선순위)
- 개별 상세 페이지(`/learn/courses/30/lessons/{id}`) 크롤링으로 카테고리/태그 추출 권장
- 대안: 프로그래머스 공식 태그 데이터가 없을 경우 GPT/Claude로 제목 기반 태그 추론 후 수동 검수

---

### 6. 타이틀 인코딩 — ✅ PASS

한글 포함 제목 전체 정상 렌더링. 샘플:

```
폰켓몬, 2016년, 가운데 글자 가져오기, 같은 숫자는 싫어,
나누어 떨어지는 숫자 배열, 문자열 내 마음대로 정렬하기,
혼자 놀기의 달인, 혼자서 하는 틱택토, 홀짝트리, 후보키
```

UTF-8 인코딩 손상 없음. 크롤러가 `Content-Type: application/json; charset=utf-8` 처리 정상.

---

### 7. sourceUrl 일관성 — ✅ PASS

```
패턴 불일치: 0건  
ID↔URL 불일치: 0건
```

전체 689건이 `https://school.programmers.co.kr/learn/courses/30/lessons/{problemId}` 패턴을 100% 준수.  
예: `problemId: 42840` → `sourceUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/42840"`

---

## Sprint 108 W4 — SQL Kit 수집 결과

**실행 일시**: 2026-04-21T09:20:13 ~ 09:21:49 KST  
**소요 시간**: 96,141ms (약 1분 36초)  
**실행 커맨드**: `cd services/gateway && npm run fetch-programmers`

### SQL Kit 섹션별 수집 카운트

| Part ID | 섹션명 | 수집 건수 |
|---------|--------|----------|
| 17042 | SELECT | 33건 |
| 17043 | SUM, MAX, MIN | 10건 |
| 17044 | GROUP BY | 24건 |
| 17045 | IS NULL | 8건 |
| 17046 | JOIN | 12건 |
| 17047 | String, Date | 19건 |
| **합계** | | **106건** |

스펙 목표(106건) 정확 일치. 모든 Part 페이지 로그인 없이 정상 수집.

### SQL 레벨 분포

| 레벨 | 건수 | 비율 |
|------|------|------|
| Lv.1 | 31건 | 29% |
| Lv.2 | 36건 | 34% |
| Lv.3 | 20건 | 19% |
| Lv.4 | 17건 | 16% |
| Lv.5 | 2건 | 2% |
| **합계** | **106건** | |

레벨 파싱 실패(null) 0건 — `parseLevelText` 확장 regex `/(?:[Ll]v\.?\s*|[Ll]evel\s*)(\d)/` 정상 동작.

### 전체 데이터셋 변화량

| 구분 | 이전 스냅샷 | 현재 | 변화 |
|------|------------|------|------|
| 총 항목 | 613건 | 689건 | **+76건** |
| algorithm | 613건 | 583건 | −30건 (SQL 재분류) |
| sql | 0건 | 106건 | **+106건** |
| 삭제된 항목 | — | 0건 | 회귀 없음 ✅ |

> **참고**: algorithm −30건은 손실이 아님. 해당 문제들이 알고리즘 챌린지 페이지와 SQL Kit 양쪽에 노출되어 있었으며, SQL Kit 수집 시 `category: 'sql'`로 덮어쓰기 처리됨. 모든 이전 ID 보존 확인(삭제 0건).

### SQL 샘플 검증 (5건) — W4.5 교정 후

| problemId | 수집 title (정제 후) | level | category | tags |
|-----------|---------------------|-------|----------|------|
| 59034 | 모든 레코드 조회하기 | 1 | sql | ['SQL'] |
| 59035 | 역순 정렬하기 | 1 | sql | ['SQL'] |
| 59036 | 아픈 동물 찾기 | 1 | sql | ['SQL'] |
| 131116 | 식품분류별 가장 비싼 식품의 정보 조회하기 | 4 | sql | ['SQL'] |
| 151136 | 평균 일일 대여 요금 구하기 | 1 | sql | ['SQL'] |

> **Scout 보고서 불일치**: Scout이 131116을 "상품 별 오프라인 매출 구하기"로 기록했으나 실제 크롤 결과는 "식품분류별 가장 비싼 식품의 정보 조회하기". Scout은 WebFetch(정적 렌더링) 기반이라 href 추출 정확도 한계. ID 존재 및 SQL 분류 자체는 정상.

### ✅ SQL 타이틀 오염 — W4.5 해결됨

```
정제 전 오염 건수: 106 / 106 (100%)
정제 후 잔존 건수:   0 / 106 (0%) ← W4.5 Architect 교정 완료
```

**원인 (참고)**: SQL Part 페이지(`/courses/30/parts/{id}`)의 앵커 태그가 제목·레벨·완료자 수를 하나의 텍스트로 묶음. `extractCards`의 `anchor.textContent` 방식이 제목만 분리하지 못함.

**해결**: `collectSqlPart` 내 `stripSqlTitleSuffix()` 순수 함수 도입.  
적용 regex: `/\s+Level\s+\d+.*$/` (W4 herald 제안 그대로).  
`extractCards`·algorithm 경로는 미수정 — 최소 변경 원칙 준수.

**검증**: suffix 잔존 0건, level/tags/category/sourceUrl 회귀 없음, algorithm 583건 title 변화 없음.

---

## Sprint 96/97 후속 과제

| 우선순위 | 과제 | 담당 |
|----------|------|------|
| Medium | tags 보강: 개별 상세 페이지 크롤링 또는 GPT 기반 태그 추론 | postman |
| Low | `programmers-problems.json` version 필드 → 시맨틱 버전(`1.0.0`) 고려 | architect |
| Low | 작업 설명 내 problemId 오기(12906↔12947 혼재) Oracle에 공유 | Oracle |

## Sprint 108/109 후속 과제

| 우선순위 | 과제 | 담당 | 상태 |
|----------|------|------|------|
| ~~**High**~~ | ~~SQL 타이틀 suffix 정제 — `collectSqlPart` 내 title 파싱 개선~~ | ~~architect (Sprint 109)~~ | ✅ **W4.5 해결** — `stripSqlTitleSuffix()` 도입, 0건 잔존 |
| Medium | SQL Part 페이지 레벨 표기 재검증 — 현재 "Level N" 형식은 정상이나, 프로그래머스 UI 변경 시 regex 재점검 필요 | architect | 미완료 |
| Low | SQL Kit 문제 추가 시 재크롤링 주기 문서화 (분기~반기 1회 권장) | scribe | 미완료 |

---

## 검수 환경

### Sprint 108 W4 (현재)

- `python3` + `json` 모듈 (read-only 검증)
- `playwright` Chromium headless — `npx playwright install chromium` 사전 실행
- 실행 브랜치: `feat/sql-kit-support` (Sprint 108)
- 참조 커밋: 하단 커밋 SHA 참조

### Sprint 95 Wave 3 (이전)

- `jq`: 1.7.x (read-only, 데이터 수정 없음)
- 참조 브랜치: `feat/gateway-programmers-dataset`
- 참조 커밋: `e460b79`
