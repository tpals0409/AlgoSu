---
sprint: 110
title: "이월 작업 전수 처리"
period: "2026-04-21"
status: complete
start_commit: 2f238b6
end_commit: 28f8694
---

# Sprint 110 — 이월 작업 전수 처리

## 배경

Sprint 107~109를 거치며 CI 리팩토링, 프로그래머스 SQL 지원, SQL 루브릭 마감이 차례로 완료되었으나, 각 스프린트에서 본선 밖으로 밀려난 이월 항목 11건이 누적되어 있었다. 개별로는 소규모지만 모이면 기술 부채로 고착되는 패턴이었고, host-side 빌드 전환(LARGE)까지 포함하면 별도 로드맵이 필요할 수 있었다.

Sprint 110은 이 이월 목록을 단일 세션에서 전수 처리하여 **기술 부채 제로**를 달성하는 것을 목표로 했다. W1 Oracle 인라인 정찰에서 heavy deps 미사용, Monaco 이미 완료, GROUP_SYSTEM_PROMPT SQL 분기 미적용을 사전 확인하고, W2~W6까지 웨이브 병렬화로 11개 항목을 5개 커밋에 압축했다.

웨이브 구조: W1(Oracle 인라인 정찰) → W2(커버리지/CI 소규모 3건) → W3(SQL 후속 3건) → W4(블로그 2건) → W5(의존성 정리 + Coverage 게이트 2건) → W6(Blog host-side SSG 전환 1건) → W7(Scribe ADR).

## 목표

| 항목 | 내용 | 상태 |
|------|------|------|
| `pyproject.toml` branch coverage | `branch=true` 활성화 | ✅ 완료 (W2) |
| github-worker incremental 동기화 | `tsconfig.json` incremental + tsBuildInfoFile | ✅ 완료 (W2) |
| APK_CACHE_BUST 조건화 | push/PR `stable`, workflow_dispatch만 bust | ✅ 완료 (W2) |
| GROUP_SQL_SYSTEM_PROMPT 도입 | 그룹 분석 SQL 프롬프트 분기 | ✅ 완료 (W3) |
| `_parse_response` fallback E2E 검증 | 7건 테스트 (3단계 fallback + totalScore=0 + SQL 가중치) | ✅ 완료 (W3) |
| 런북 크롤러 재크롤링 주기 문서화 | `runbook-programmers-pipeline.md` 섹션 추가 | ✅ 완료 (W3) |
| 블로그 order 자동화 | slug alphabetical 결정적 보조 정렬 | ✅ 완료 (W4) |
| 블로그 시리즈 기능 | `PostMeta` series 필드 + 시리즈 네비 aside | ✅ 완료 (W4) |
| 미사용 heavy deps 제거 | react-dnd(3건) + react-slick(1건) 삭제 | ✅ 완료 (W5) |
| 서비스별 독립 coverage 게이트 | `check-coverage.mjs` SERVICE_THRESHOLDS 맵 | ✅ 완료 (W5) |
| Blog host-side SSG 전환 | Dockerfile 멀티스테이지 제거 → nginx COPY 전용 | ✅ 완료 (W6) |
| Frontend host-side 빌드 전환 | Sharp/SWC arm64 바이너리 불일치 → HARD BLOCK | ❌ 미도입 결정 (D6) |

---

## 결정 사항

### D1. `pyproject.toml` `branch=true` 활성화 — threshold 미설정

**배경**: Sprint 109 이월 항목. ai-analysis의 Python 커버리지가 라인만 측정하고 브랜치 축을 미측정했다.

**선택지**:
1. `branch=true` + threshold 즉시 설정
2. `branch=true`만 활성화, threshold는 실측 후 설정

**결정**: 선택지 2. `[tool.coverage.run] branch = true`만 추가하고 threshold는 미설정.

**근거**: 브랜치 커버리지 실측 데이터가 없는 상태에서 임의 threshold를 설정하면 CI가 불필요하게 실패할 수 있다. 1~2 스프린트 실측 후 적정값을 설정하는 것이 안전하다.

### D2. `github-worker/tsconfig.json` incremental 동기화

**배경**: 다른 NestJS 서비스(gateway, submission, problem)는 이미 `incremental: true`를 사용하지만, github-worker만 누락되어 있었다.

**선택지**:
1. 현행 유지 (github-worker만 full rebuild)
2. incremental + tsBuildInfoFile 추가

**결정**: 선택지 2. `"incremental": true`, `"tsBuildInfoFile": "./dist/tsconfig.tsbuildinfo"` 추가.

**근거**: 다른 서비스와의 일관성 확보 + 로컬 개발 시 incremental build 속도 이점. 위험 요소 없음.

### D3. APK_CACHE_BUST 조건화

**배경**: `ci.yml`의 APK_CACHE_BUST가 매 빌드마다 cache bust를 수행하여, push/PR에서도 불필요하게 APK 캐시를 무효화했다.

**선택지**:
1. 항상 bust (현행)
2. workflow_dispatch input `apk_bust=true`일 때만 bust, 나머지는 `stable`

**결정**: 선택지 2. `APK_BUST_VALUE` 환경변수를 workflow_dispatch input 조건에 따라 분기.

**근거**: push/PR 빌드에서 APK 캐시를 재사용하면 CI 시간을 절약할 수 있다. 실제로 APK bust가 필요한 경우(Alpine 패키지 업데이트)는 수동 dispatch로 한정된다.

### D4. GROUP_SQL_SYSTEM_PROMPT + `get_group_system_prompt(language)` 도입

**배경**: Sprint 109에서 `get_system_prompt(language)` 패턴을 도입했으나, 그룹 분석(`group_analyze`)에는 SQL 분기가 미적용이었다(Sprint 109 이월 low).

**선택지**:
1. 이월 유지 (그룹 분석 SQL 사용 빈도 낮음)
2. `get_system_prompt` 패턴을 재사용하여 `get_group_system_prompt(language)` 도입

**결정**: 선택지 2. `prompt.py`에 `GROUP_SQL_SYSTEM_PROMPT` 상수 + `get_group_system_prompt(language)` 함수 추가, `claude_client.py`와 `main.py`에서 연결.

**근거**: Sprint 109 D2에서 확립한 `get_*_prompt(language)` 패턴을 그대로 재사용하므로 구현 비용이 최소. 사용 빈도가 낮더라도 SQL 제출 시 그룹 분석이 알고리즘 루브릭을 적용하는 것은 논리적 불일치.

### D5. Blog host-side SSG 전환 실행

**배경**: Sprint 106 이후 "host-side 빌드 전환"이 이월되어 왔다. Blog는 Next.js SSG(Static Site Generation)로 `npm run build` 산출물이 순수 HTML/CSS/JS이므로 플랫폼 종속성이 없다.

**선택지**:
1. Docker 멀티스테이지 유지 (현행)
2. GHA에서 `npm run build` → Docker는 nginx COPY 전용

**결정**: 선택지 2. Sensei 선자문에서 SSG 산출물의 아키텍처 무관성을 확인(PASS). Dockerfile을 nginx COPY 전용으로 축소하고, ci.yml의 build-blog 잡에 `actions/setup-node` + `npm ci` + `npm run build` 삽입. `.dockerignore` 신규 작성으로 Docker context를 `out/` + `nginx.conf`로 한정.

**근거**: Docker 빌드 레이어에서 `npm ci` + `npm run build`를 제거하면 이미지 빌드 시간 단축 + 레이어 캐시 효율 향상. SSG 산출물은 순수 정적 파일이므로 host ↔ container 아키텍처 불일치 문제 없음.

### D6. Frontend host-side 빌드 HARD BLOCK

**배경**: Blog와 동일하게 Frontend도 host-side 빌드를 시도할 수 있으나, Frontend는 `sharp`(이미지 최적화)와 `@swc/core`(SWC 컴파일러)가 arm64 네이티브 바이너리를 포함한다.

**선택지**:
1. Frontend도 host-side 전환 시도
2. HARD BLOCK — Docker buildx 유지

**결정**: 선택지 2. Sensei 선자문에서 Sharp/SWC arm64 네이티브 바이너리가 GHA runner(linux/amd64) ↔ Docker 타겟 아키텍처 간 불일치를 일으킬 수 있음을 확인. Sprint 106 [C] 패턴의 3번째 재현.

**근거**: Blog(SSG, 순수 정적)와 달리 Frontend는 `next start` 서버 모드로 동작하며 네이티브 바이너리 의존성이 있다. host-side에서 빌드한 `node_modules`를 다른 아키텍처 컨테이너에 복사하면 런타임 crash 위험. 이는 이월이 아닌 **미도입 결정**이다.

---

## 웨이브 실행 기록

| 웨이브 | 에이전트 | 작업 | 커밋 |
|--------|----------|------|------|
| W1 | Oracle (인라인) | heavy deps/Monaco/GROUP_SYSTEM_PROMPT 정찰 | — |
| W2 | Architect (3병렬) | pyproject.toml branch=true, tsconfig incremental, APK_CACHE_BUST 조건화 | `4b245df` |
| W3 | Architect + Sensei | GROUP_SQL_SYSTEM_PROMPT, fallback E2E 테스트 7건, 런북 크롤러 주기 | `7789e79` |
| W4 | Architect + Scribe | 블로그 order 자동화, 시리즈 기능 도입 | `d38dcb0` |
| W5 | Architect | react-dnd/react-slick 제거, 서비스별 coverage 게이트 | `01f8283` |
| W6 | Architect (Sensei 선자문) | Blog host-side SSG 전환, Frontend HARD BLOCK 결정 | `28f8694` |
| W7 | Scribe | 마감 ADR | — |

---

## 산출물 및 변경 파일 목록

| 파일 | 작업 | 웨이브 | 설명 |
|------|------|--------|------|
| `services/ai-analysis/pyproject.toml` | 수정 | W2 | `[tool.coverage.run] branch = true` 추가 |
| `services/github-worker/tsconfig.json` | 수정 | W2 | `incremental: true` + `tsBuildInfoFile` 추가 |
| `.github/workflows/ci.yml` | 수정 | W2, W6 | APK_CACHE_BUST 조건화 (W2) + Blog host-side build 삽입 (W6) |
| `services/ai-analysis/src/prompt.py` | 수정 | W3 | GROUP_SQL_SYSTEM_PROMPT + `get_group_system_prompt(language)` 추가 |
| `services/ai-analysis/src/claude_client.py` | 수정 | W3 | `group_analyze`에서 `get_group_system_prompt(language)` 호출 연결 |
| `services/ai-analysis/src/main.py` | 수정 | W3 | `group_analyze` → `get_group_system_prompt` 파라미터 전달 |
| `services/ai-analysis/tests/test_claude_client.py` | 수정 | W3 | TestParseResponseFallback 7건 추가 (3단계 fallback + totalScore=0 + SQL 가중치) |
| `services/ai-analysis/tests/test_prompt.py` | 수정 | W3 | GROUP_SQL_SYSTEM_PROMPT + `get_group_system_prompt` 테스트 추가 |
| `docs/runbook-programmers-pipeline.md` | 수정 | W3 | 문제 목록 크롤러 재크롤링 주기 섹션 추가 |
| `blog/src/lib/posts.ts` | 수정 | W4 | `PostMeta` series/seriesOrder 필드 + `getSeriesPosts()` + order 자동화 (slug alphabetical) |
| `blog/src/components/post-page.tsx` | 수정 | W4 | 시리즈 aside 네비게이션 추가 |
| `frontend/package.json` | 수정 | W5 | react-dnd(3건) + react-slick(1건) 의존성 제거 |
| `frontend/package-lock.json` | 수정 | W5 | 제거된 의존성 lock 반영 (−174줄) |
| `scripts/check-coverage.mjs` | 수정 | W5 | SERVICE_THRESHOLDS 맵 + 서비스별 독립 게이트 도입 |
| `blog/Dockerfile` | 수정 | W6 | 멀티스테이지 제거 → nginx COPY 전용 |
| `blog/.dockerignore` | 신규 | W6 | Docker context를 `out/` + `nginx.conf`로 한정 |

**변경 통계**: 16 files changed, 428 insertions(+), 204 deletions(−)

**커밋 목록** (5건):
- `4b245df` — chore(ci): Sprint 110 W2 — 커버리지/CI 소규모 번들 3건
- `7789e79` — feat(ai-analysis): Sprint 110 W3 — SQL 후속 번들 3건
- `d38dcb0` — feat(blog): Sprint 110 W4 — 블로그 order 자동화 + 시리즈 기능 도입
- `01f8283` — chore(frontend,ci): Sprint 110 W5 — 미사용 의존성 제거 + 서비스별 coverage 게이트
- `28f8694` — feat(blog,ci): Sprint 110 W6 — Blog host-side SSG 빌드 전환

---

## 교훈

### 1. Sensei 선자문 — Sprint 106 패턴 3번째 재현

W6에서 Blog host-side 전환과 함께 Frontend도 동일 전환을 시도할 수 있었으나, Sensei 선자문으로 Sharp/SWC arm64 네이티브 바이너리 불일치를 사전 감지하여 HARD BLOCK을 결정했다. Sprint 106 [C]에서 처음 발견된 "host-side 빌드 시 네이티브 바이너리 아키텍처 불일치" 패턴이 3번째로 재현되었다. **구현 0줄의 결정**이 런타임 crash를 방지하는 가치를 반복 입증했다.

### 2. Explore 에이전트 오판 교정 — 탐색 결과는 실측 교차 검증 필수

W1에서 react-dnd/react-slick을 "미의존"으로 보고했지만, 실측에서 `package.json`에 등재되어 있음을 확인했다. 탐색 에이전트가 "코드에서 import하지 않음"과 "프로젝트에 존재하지 않음"을 혼동한 사례. **탐색 에이전트의 보고는 항상 `package.json`/`import` 실측으로 교차 검증**해야 한다.

### 3. 이월 전수 처리의 효과 — 기술 부채 제로 달성

11개 이월 항목을 단일 스프린트에서 처리하여 Sprint 107~109 누적 기술 부채를 제로로 만들었다. 웨이브 병렬화(W2 3병렬, W3 3건 번들 등)로 LARGE 항목(W6 Blog host-side)까지 흡수할 수 있었다. 이월 항목이 3 스프린트 이상 누적되면 전수 처리 스프린트를 편성하는 것이 효과적이다.

### 4. 이월 항목 사전 실측이 스코프 정확도를 높임

Monaco dynamic import가 이월 목록에 있었지만, W1 정찰에서 `CodeEditor.tsx:27`에 이미 구현되어 있음을 확인하여 스코프에서 제외했다. 이월 항목을 착수 전에 실측하면 불필요한 작업을 제거하고, 실제 처리가 필요한 항목에 집중할 수 있다.

---

## 이월 항목

**없음.**

Sprint 107~109 이월 전량 완료. Sprint 108+ "Frontend host-side 빌드 전환"은 D6 HARD BLOCK으로 **미도입 결정**(이월 아님).

---

## 관련 문서

- `docs/adr/sprints/sprint-109.md` — 선행 스프린트 (SQL 학습 경험 마감)
- `docs/adr/sprints/sprint-106.md` — host-side 빌드 전환 시드 원본
- `services/ai-analysis/src/prompt.py` — GROUP_SQL_SYSTEM_PROMPT, get_group_system_prompt()
- `services/ai-analysis/tests/test_claude_client.py` — TestParseResponseFallback 7건
- `scripts/check-coverage.mjs` — SERVICE_THRESHOLDS 서비스별 독립 게이트
- `blog/Dockerfile` — nginx COPY 전용 (host-side SSG 전환 결과)
- `blog/.dockerignore` — Docker context 최소화
