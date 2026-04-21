---
sprint: 108
title: "프로그래머스 SQL 문제 지원"
period: "2026-04-21"
status: complete
start_commit: f605c8d
end_commit: 7c7d518
---

# Sprint 108 — 프로그래머스 SQL 문제 지원

## 배경

AlgoSu는 프로그래머스 알고리즘 문제(`challenges?levels=0~5`)를 크롤링하여 정적 JSON 캐시로 관리해 왔다. 그러나 프로그래머스 SQL 고득점 Kit(`tab=sql_practice_kit`)는 별도 URL 구조(Part 단위 페이지)를 사용하므로 기존 크롤러가 수집하지 못했다.

결과적으로 게이트웨이 정적 캐시에 SQL 문제 **0건**, 제출 DTO 화이트리스트에 `'sql'` 미등록, 프론트엔드 언어 드롭다운·Monaco 하이라이팅 미지원, AddProblemModal 자동 태깅 로직 부재라는 4개의 빈 곳이 존재했다.

Sprint 108은 이 네 개의 빈 곳을 **기반 코드 확장 + 데이터 재생성**으로 채운다. 채점 방식(AI feedback 유지)과 AI 프롬프트 분기는 Sprint 109+로 이월하고, 이번 스프린트는 "검색→등록→제출→AI feedback 수신까지 파이프라인 완주"를 목표로 한다.

웨이브 구조: W1(scout 정찰) → W2(architect 코어 3모듈) → W3(palette UI) → W4(herald 크롤링) → W4.5(architect 긴급 교정) → W5(scribe ADR).

## 목표

| 항목 | 내용 | 상태 |
|------|------|------|
| SQL 데이터 수집 | 크롤러 SQL Kit 경로 추가, JSON 재생성 | ✅ 완료 (106건) |
| 제출 파이프라인 | sql 언어 화이트리스트 추가 | ✅ 완료 |
| 프론트엔드 지원 | 언어 상수·Monaco 매핑·SQL 배지 | ✅ 완료 |
| title 오염 교정 | suffix "Level N X명 완료" 전수 제거 | ✅ W4.5 완료 |
| 테스트 회귀 방어 | 전 서비스 threshold 충족 | ✅ 완료 |

---

## 결정 사항

### D1. 채점 방식 — 기존 AI feedback 유지

**결정**: SQL 실행 채점 서비스(sql-judge) 신규 도입 안 함. 기존 AI feedback 파이프라인 그대로 유지.

**근거**:
- 서비스 안정성 > 기능 완성도. SQL 실행 채점은 별도 실행 환경(DB 샌드박스) 구성과 보안 격리가 필요하며 Sprint 108 범위를 초과한다.
- AI feedback은 SQL 쿼리에 대해서도 구문·논리·스타일 피드백을 제공할 수 있다 (품질은 D2의 Known Limitation).
- 비실행 채점 아키텍처 유지로 복잡도 증가 회피.

**대안 보류**: sql-judge 서비스는 Sprint 110+ 독립 스프린트로 분리 검토.

### D2. AI 프롬프트 SQL 분기 보류

**결정**: `ai-analysis/prompt.py`에 SQL 전용 분기(`language='sql'` 시 프롬프트 변환) 추가 안 함.

**근거**:
- Sprint 108 범위 최소화. 분기 추가 시 AI 응답 품질 검증 테스트가 추가로 필요하다.
- SQL 맥락에서 AI가 "시간복잡도" 같은 알고리즘 피드백을 줄 수 있는 품질 저하는 **Known Limitation**으로 ADR에 명시하고 수용.
- Sprint 109+에서 `build_user_prompt(language)` 분기 + 평가 테스트 세트 함께 설계.

**Known Limitation**: SQL 제출 시 AI feedback 품질이 알고리즘 제출 대비 낮을 수 있음. 파이프라인 완주 자체는 정상 동작.

### D3. 크롤러 SQL Kit 경로 — Part ID 상수 직접 순회

**결정**: SQL Kit 수집을 위해 Part ID 상수 배열 `[17042, 17043, 17044, 17045, 17046, 17047]`을 직접 순회하는 `collectSqlPart(page, partId)` 함수 신규 추가.

**근거**:
- Scout W1 정찰 결과: SQL Kit 진입 후 `/parts/{id}` 6개로 분기하며 각 Part가 단일 스크롤 페이지(페이지네이션 없음). 상수 배열 직접 순회가 동적 링크 파싱보다 단순하고 안정적.
- `?page=N` 루프 불필요. 각 Part 내 전체 문제가 단일 페이지에 노출됨.
- 기존 `extractCards` 앵커 셀렉터(`a[href*="/learn/courses/30/lessons/"]`) SQL Part 페이지에서도 호환됨.

### D4. 레벨 파싱 regex 확장

**결정**: `parseLevelText` regex `/[Ll]v\.?\s*(\d)/` → `/(?:[Ll]v\.?\s*|[Ll]evel\s*)(\d)/`

**근거**:
- Scout W1 정찰 결과: 알고리즘 챌린지 페이지는 "Lv. 1" 표기, SQL Part 페이지는 "Level 1" 표기. 두 형식이 혼재.
- 기존 regex는 "Level N" 형식 파싱 불가 → 레벨값 `null` 폴백 발생 위험.
- 확장 regex 적용 후 Herald W4 실측에서 SQL 106건 level=null 0건 확인.

**사후 검증**: Herald W4 → SQL level 분포 Lv1:31 / Lv2:36 / Lv3:20 / Lv4:17 / Lv5:2 / null:0.

### D5. category 필드 도입 — ProgrammersRawItem

**결정**: `ProgrammersRawItem`에 `category?: 'algorithm' | 'sql'` 선택 필드 추가. `loadFromFile()`에서 미존재 시 `'algorithm'` 기본값 처리(legacy 호환).

**근거**:
- `sourcePlatform`은 플랫폼(BOJ/PROGRAMMERS) 구분용으로 의미가 다르다. 카테고리 구분을 위한 별도 필드 필요.
- 기존 613건 JSON에는 `category` 필드 없음 → `item.category ?? 'algorithm'` 으로 legacy 호환 유지.
- `matchesQuery()` sql 토큰 검색 경로도 `category === 'sql'` 기반으로 보강.

### D6. submission DTO 화이트리스트 — sql 추가

**결정**: `ALLOWED_LANGUAGES`에 `'sql'` 추가. 알파벳 순 재정렬(`rust → sql → swift`).

**근거**:
- DTO 레벨 차단 해제로 SQL 쿼리 제출 파이프라인 활성화.
- class-validator 기반 화이트리스트이므로 미등록 언어(`unknown_lang`)는 여전히 거부됨.
- 단위 테스트 2건(허용/거부) 추가, submission 전체 239건 회귀 없음.

### D7. Frontend sql 언어 상수 — Monaco 내장 SQL 모드 활용

**결정**: `LANGUAGES`에 `{ value: 'sql', label: 'SQL' }` 추가. `MONACO_LANG_MAP`에 `sql: 'sql'` 추가(Monaco 내장 SQL 모드).

**근거**:
- Monaco Editor는 SQL 언어를 공식 내장 지원 → 커스텀 언어 정의 불필요.
- `LANGUAGES` 배열과 `MONACO_LANG_MAP` 객체가 분리된 SSOT 구조이므로 양쪽 동시 추가 필요.

### D8. AddProblemModal SQL 자동 태깅

**결정**: `isSqlProblem(p)` — `category === 'sql'` OR `tags.includes('SQL')` 이중 체크. 해당 시 `allowedLanguages: ['sql']`, `tags: mergeSqlTag()` 적용, SQL 배지 노출.

**근거**:
- UX 일관성. 사용자가 SQL 문제 등록 시 언어를 수동 선택하거나 SQL 태그를 수동 추가하는 부담 제거.
- `--primary-soft`(배경) / `--primary`(텍스트) 기존 디자인 토큰 재사용 → 신규 토큰 추가 없음.
- WCAG AA 텍스트 대비비 4.5:1+ 충족(`--primary`: `#715DA8` Light / `#A08CD6` Dark).
- algorithm 문제: 기존 동작 100% 유지(allowedLanguages 미전송).

### D9. SQL 타이틀 suffix 오염 — W4.5 긴급 교정

**결정**: `stripSqlTitleSuffix(rawTitle: string): string` 순수 함수 도입. regex: `/\s+Level\s+\d+.*$/`. `collectSqlPart` 내 title 정제 적용.

**근거**:
- Herald W4 실측 결과: SQL 106건 전체 title에 "Level 1 94,495명 완료" 형식의 suffix 포함. SQL Part 페이지의 앵커가 제목+레벨+완료자수를 묶는 컨테이너 구조로 `anchor.textContent` 전체 수집됨.
- 비블로커이나 106건 전체 UX 영향이 크므로 Sprint 109+ 이월 대신 같은 스프린트에서 즉시 교정.
- 순수 함수 분리: 크롤러 스크립트 내 1줄 regex로 끝낼 수 있었으나 `export` + 단위 테스트 가능 구조로 분리. 향후 프로그래머스 UI 변경 시 regex 수정 용이성 확보.
- **교정 결과**: W4.5 재크롤링(92,631ms) 후 suffix 잔존 0건.

---

## 팩트 대조표 (Scribe 검증, W1~W5 전 리포트 직접 Read)

| # | 팩트 항목 | 기대값 | 실측값 (출처) | 일치 |
|---|-----------|--------|--------------|------|
| 1 | SQL Kit 총 문제 수 | 106 | 106 (scout W1 예상, herald W4 실측) | ✅ |
| 2 | Part별 수집 (섹션별 건수) | SELECT:33 / SUM,MAX,MIN:10 / GROUP BY:24 / IS NULL:8 / JOIN:12 / String,Date:19 | SELECT:33 / SUM,MAX,MIN:10 / GROUP BY:24 / IS NULL:8 / JOIN:12 / String,Date:19 (herald W4) | ✅ |
| 3 | 크롤러 실행 시간 | W4: 96,141ms / W4.5: 92,631ms | W4: 96,141ms (herald W4) / W4.5: 92,631ms (architect W4.5) | ✅ |
| 4 | JSON 총 건수 | 이전 613 → 이후 689 (+76) | 613 → 689 (+76건) (herald W4) | ✅ |
| 5 | algorithm 재분류 | 613 → 583 (-30) | 613 → 583 (-30건, 삭제 아닌 sql 재분류) (herald W4) | ✅ |
| 6 | SQL level 분포 | Lv1:31 / Lv2:36 / Lv3:20 / Lv4:17 / Lv5:2 / null:0 | Lv.1:31 / Lv.2:36 / Lv.3:20 / Lv.4:17 / Lv.5:2 / null:0 (herald W4) | ✅ |
| 7 | tags 'SQL' 포함 | 106/106 (전수) | 106/106 전체 확인 (herald W4) | ✅ |
| 8 | gateway 테스트 | 760 passed | 760 passed (architect W4.5) | ✅ |
| 9 | submission 테스트 | 239 passed | 239 passed (architect W2) | ✅ |
| 10 | frontend 테스트 | 1238 passed | 1238 passed (palette W3) | ✅ |
| 11 | frontend coverage | lines 86.93% / branches 76.47% | lines 86.93% / branches 76.47% (palette W3) | ✅ |
| 12 | 커밋 수 (Sprint 108) | **6** | **7** — a7d7b34·e9ef013·9f1d343(architect W2) / b096190(palette W3) / 6bb92af(herald W4) / 86a9ad0·7c7d518(architect W4.5) | ⚠️ |
| 13 | title suffix 잔존 | 0건 | 0건 (architect W4.5 전수 확인) | ✅ |

### 팩트 불일치 — 항목 12: 커밋 수

**기대값**: 6  
**실측값**: 7

**원본 리포트 인용**:
- architect W2 (task-20260421-175127): `c1: a7d7b34`, `c2: e9ef013`, `c3: 9f1d343` — **3건**
- palette W3 (task-20260421-180723): `SHA: b096190` — **1건**
- herald W4 (task-20260421-181921): `SHA: 6bb92af` — **1건**
- architect W4.5 (task-20260421-183324): `c1: 86a9ad0`, `c2: 7c7d518` — **2건**

합계: 3 + 1 + 1 + 2 = **7건**. Oracle 작업 지시서의 "6" 수치는 오기재(목록 나열과 불일치). 실제 커밋 수는 7건으로 기록.

---

## 산출물 및 변경 파일 목록

| 파일 | 작업 | 웨이브 | 설명 |
|------|------|--------|------|
| `services/gateway/scripts/fetch-programmers-problems.ts` | 수정 | W2/W4.5 | SQL Kit 수집 경로(collectSqlPart), regex 확장, stripSqlTitleSuffix 추가 |
| `services/gateway/scripts/fetch-programmers-problems.spec.ts` | 신규 | W4.5 | stripSqlTitleSuffix 단위 테스트 4건 (scripts 전용) |
| `services/gateway/src/external/programmers.service.ts` | 수정 | W2 | category 스키마, matchesQuery sql 경로, 응답 노출 |
| `services/gateway/src/external/programmers.service.spec.ts` | 수정 | W2 | SQL fixture 2건, 신규 테스트 4건, count 업데이트 |
| `services/gateway/data/programmers-problems.json` | 재생성 | W4/W4.5 | 689건 (algorithm:583, sql:106), title suffix 제거 완료 |
| `services/gateway/data/PROGRAMMERS-QA.md` | 수정 | W4/W4.5 | SQL Kit 수집 결과·교정 이력 섹션 추가 |
| `services/submission/src/submission/dto/create-submission.dto.ts` | 수정 | W2 | sql 화이트리스트 추가 |
| `services/submission/src/submission/dto/create-submission.dto.spec.ts` | 신규 | W2 | sql 허용 + unknown_lang 거부 단위 테스트 2건 |
| `frontend/src/lib/constants.ts` | 수정 | W2 | LANGUAGES에 sql 추가 |
| `frontend/src/lib/api.ts` | 수정 | W3 | ProgrammersSearchItem.category 타입 추가 |
| `frontend/src/components/submission/CodeEditor.tsx` | 수정 | W2 | MONACO_LANG_MAP에 sql 추가 |
| `frontend/src/lib/__tests__/constants.test.ts` | 수정 | W2 | 언어 수 9→10, sql 테스트 추가 |
| `frontend/src/components/ui/AddProblemModal.tsx` | 수정 | W3 | SQL 자동 태깅 로직 + SQL 배지 + 헬퍼 함수 |
| `frontend/src/components/ui/__tests__/AddProblemModal.test.tsx` | 수정 | W3 | SQL 배지 2건 + 자동 태깅 2건 테스트 추가 |

커밋 목록:
- `a7d7b34` — feat(gateway): add SQL kit crawling path + category schema
- `e9ef013` — feat(submission): allow sql in language whitelist
- `9f1d343` — feat(frontend): add sql to language list + monaco map
- `b096190` — feat(frontend): add SQL auto-tagging + badge in AddProblemModal
- `6bb92af` — chore(gateway): regenerate programmers-problems.json with SQL kit (106 problems)
- `86a9ad0` — fix(gateway): strip level/completion suffix from SQL problem titles
- `7c7d518` — chore(gateway): regenerate programmers-problems.json with clean SQL titles

---

## 교훈

### 1. Scout 정찰의 실효성 — regex 불일치 사전 발견

W1 scout이 알고리즘 페이지("Lv. N")와 SQL Part 페이지("Level N")의 레벨 표기 차이를 미리 발견했다. 정찰이 없었다면 크롤러 실행 후 `level=null` 폴백이 106건 발생하고 herald W4 결과 검증에서야 발견됐을 것이다. 사전 정찰이 regex 확장 시점을 W2 설계 단계로 앞당겼다.

### 2. Atomic Commit 분리의 가치 — W4.5 교정 시 영향 범위 격리

Architect W2가 크롤러/submission/frontend 3개 모듈을 각 1개 커밋으로 분리했다. W4.5 교정에서 크롤러 스크립트만 패치하면서 영향 범위를 `fetch-programmers-problems.ts` 단일 파일로 격리할 수 있었다. 단일 거대 커밋이었으면 submission/frontend 코드가 뒤섞여 리뷰 비용이 컸을 것이다.

### 3. 크롤러 결과 샘플 검증의 필요성 — title suffix 즉각 발견

Herald W4가 JSON 재생성 후 샘플 3건(59034·59035·59036)을 수동 확인하여 "Level 1 94,495명 완료" suffix 오염을 즉각 발견했다. 카운트/category/level 통계 검증만 했다면 오염이 PR 리뷰 단계까지 누락됐을 수 있다. **샘플 title 검증을 크롤러 실행 체크리스트에 추가**.

### 4. PR 전 UX 교정 결단 — 'Sprint 마감 품질 > 속도'

Herald W4가 "비블로커"로 분류하고 Sprint 109 후속으로 제안했지만, Oracle은 106건 전체 UX 영향을 고려해 같은 스프린트에서 즉시 교정을 결단했다. 알려진 품질 저하를 Known Issue로 이월하지 않는 판단. W4.5 추가 비용(1개 웨이브, 2개 커밋, 92초 재크롤링)이 Sprint 109에서 교정하는 비용보다 작다고 판단됨.

### 5. AI 프롬프트 분기 보류의 정당성

SQL 맥락에서 프롬프트 분기를 추가하면 AI 응답 품질 검증 테스트 세트가 필요하다. Sprint 108 범위 초과. Known Limitation으로 명시하고 Sprint 109+에서 `build_user_prompt(language)` 분기 + 평가 기준 함께 설계하는 방식이 더 견고하다.

### 6. stripSqlTitleSuffix 순수 함수 분리의 설계 이득

크롤러 스크립트 내 1줄 인라인 regex로도 동작했을 교정이지만, Architect W4.5가 `export` 가능한 순수 함수로 분리하고 단위 테스트 4건을 추가했다. 프로그래머스 UI가 suffix 형식을 변경하더라도 regex 수정 → 테스트 확인 사이클로 대응 가능. **크롤러 유틸리티 함수도 테스트 가능 단위로 분리**하는 패턴으로 정착.

---

## 이월 항목 (Sprint 109+)

### Sprint 108 신규 이월

- **AI 프롬프트 SQL 분기** (D2): `ai-analysis/prompt.py`에 `language='sql'` 분기 추가 + SQL 응답 품질 평가 테스트 세트 설계. Known Limitation 해제.
- **SQL Part 레벨 표기 regex 재점검** (Medium): 프로그래머스 UI 변경 시 "Level N" 이외 표기 등장 가능성 대비 모니터링. `parseLevelText` regex 확장 이력 유지.
- **SQL Kit 재크롤링 주기 문서화** (Low): SQL Kit 문제 추가 빈도(분기~반기 1회 수준) 기준 재크롤링 주기를 `PROGRAMMERS-QA.md`에 명시.

### Sprint 106/107에서 승계된 이월 (변화 없음)

- **host-side 빌드 전환**: Blog/Frontend `npm run build` → GHA cache → Docker COPY 전용 (진정한 L2 달성 경로). 세부는 `memory/sprint-106-deferred-items.md` 참조.
- APK_CACHE_BUST 조건화, NestJS tsc incremental, Monaco dynamic import, heavy deps audit
- ai-analysis `pyproject.toml` `branch=true` 활성화 (Python branches 축 실측)
- `scripts/check-coverage.mjs` 서비스별 독립 게이트 도입
- submission/problem/identity lcov 실측 수집
- 블로그 포스트 `order` 필드 자동화 (date 기반 정렬 전환 검토)

---

## 관련 문서

- `services/gateway/data/PROGRAMMERS-QA.md` — SQL Kit 수집 검수 이력
- `services/gateway/scripts/fetch-programmers-problems.ts` — 크롤러 구현 (collectSqlPart, stripSqlTitleSuffix)
- `frontend/src/components/ui/AddProblemModal.tsx` — SQL 자동 태깅 구현
- `memory/project-programmers-migration.md` — Sprint 95~97 BOJ→프로그래머스 이전 로드맵 (참조)
- `/Users/leokim/.claude/plans/glistening-roaming-bear.md` — 승인된 플랜
- 에이전트 결과 리포트:
  - scout W1: `~/.claude/oracle/inbox/scout-task-20260421-174340.md`
  - architect W2: `~/.claude/oracle/inbox/architect-task-20260421-175127.md`
  - palette W3: `~/.claude/oracle/inbox/palette-task-20260421-180723.md`
  - herald W4: `~/.claude/oracle/inbox/herald-task-20260421-181921.md`
  - architect W4.5: `~/.claude/oracle/inbox/architect-task-20260421-183324.md`
