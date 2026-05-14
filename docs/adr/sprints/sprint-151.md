# Sprint 151 — 프로그래머스 SQL 문제 진입 시 에디터 언어 자동 SQL 선택

- **상태**: 완료 ✅
- **기간**: 2026-05-13 (단일 일자)
- **트리거**: 사용자 피드백
- **start_commit**: `2f68402` (Sprint 150 end)
- **end_commit**: `4313561` (Sprint 151 hotfix end)
- **머지된 PR**: 2건 (squash merge)

## 1. 배경 / 사용자 피드백

프로그래머스 SQL 카테고리 문제(MySQL/Oracle)에 사용자가 진입하면 에디터 default 언어가 `'python'` 하드코딩으로 설정되어 매번 SQL로 수동 변경해야 하는 마찰 발생. 이 마찰을 제거하라는 사용자 요청.

## 2. 결정 사항

### 2.1 스키마 결정
- Problem entity에 `category` enum 컬럼 신규 (`'ALGORITHM' | 'SQL'`, default `'ALGORITHM'`, NOT NULL)
- enum 이름: `ProblemCategory` (PascalCase, 기존 `Difficulty`/`ProblemStatus` 패턴 일치)
- enum 값: UPPER_SNAKE_CASE (백엔드 표준)
- Migration timestamp: `1709000016000` (sequential, 기존 1709000015000 다음)
- **이유**: Gateway 동기화 단계에 이미 동일 enum (`'algorithm'/'sql'`) 존재 (Sprint 108) → SSOT 일관성. tags marker보다 명시적

### 2.2 UX 결정
- Problem mount 시 `useRef` guard로 1회만 `setLanguage('sql')` 적용
- 사용자 수동 변경 후 재로드: 같은 mount 내에서는 강제 안 됨 (ref true)
- 새 페이지 mount → 새 ref → 다시 SQL (의도된 UX, 사용자 피드백 일치)
- ALGORITHM 또는 category undefined(legacy): 기존 `'python'` 유지

### 2.3 PR 전략
- 단일 feature PR + atomic commits 분리 (backend → gateway sync → frontend)
- 의존 관계 명확하므로 분할 시 frontend가 backend fallback 부채 발생 → 묶음

### 2.4 SQL 언어 식별자
- 기존 `'sql'` 단일 값 사용 (LANGUAGES 상수, Sprint 108)
- MySQL/Oracle 분리 미존재 → 단순화

## 3. 구현 흐름

### 3.1 PR #229 — 본 PR (`998ec4e`)
**11 commits, 13 files, +449/-10**

| Wave | 에이전트 | 변경 파일 | 검증 |
|------|---------|----------|------|
| Wave 1 (Backend) | architect (sonnet) | `problem.entity.ts` (+ProblemCategory enum) / `create-problem.dto.ts` (@IsEnum) / `1709000016000-AddCategoryToProblems.ts` (migration) / `problem.service.ts` (create/update 주입) | problem 170 PASS (+6) |
| Wave 2 (Gateway 동기화) | architect (sonnet) | `programmers.service.ts` (toProblemCategoryEnum 헬퍼 export, 소문자→대문자 변환) | gateway 783 PASS (+4) |
| Wave 3 (Frontend READ) | palette (opus) | `types.ts` (`Problem.category`) / `page.tsx` (useRef + useEffect ref-guarded setLanguage) / `__tests__/sql-auto-language.test.tsx` (4 시나리오 270라인) | frontend 1356 PASS (+4) |
| Wave 3 R2 (Frontend WRITE) | palette (opus) | `types.ts` (`CreateProblemData.category` + `UpdateProblemData.category`) / `AddProblemModal.tsx:675` (SQL 분기 `category: 'SQL' as const`) / `AddProblemModal.test.tsx` (+2 검증) | AddProblemModal 7/7 PASS |

### 3.2 PR #230 — Trivy hotfix (`4313561`)
**2 commits, 4 lockfile, +74/-58**

| 패키지 | 이전 → 이후 | CVE | 영향 서비스 |
|--------|------------|-----|------------|
| Next.js | 15.5.15 → 15.5.18 | CVE-2026-44578 SSRF / CVE-2026-44579 DoS / GHSA-8h8q-6873-q5fj 외 (총 9 HIGH) | frontend |
| fast-uri | 3.1.0 → 3.1.2 | CVE-2026-6321 path traversal | frontend, gateway, submission, problem |
| fast-xml-builder | 1.1.4 → 1.2.0 | CVE-2026-44665 XML Comment/CDATA Injection | gateway (transitive of fast-xml-parser 5.5.6) |

**npm audit 최종**: HIGH/CRITICAL = **0건** 전 서비스, package.json caret 그대로 (lockfile만 갱신)

## 4. Critic 라운드 (Auto-Critic 큐잉 4회)

### 4.1 Wave 1+2 Auto-Critic R1
- session: `019e1eeb-1fdb-71a0-879c-fea828bb6efb`
- P0/P1 0건, **P2 1건**: gateway → problem-service write path에서 `category` 미전달 → SQL 문제 silent ALGORITHM 저장 위험
- 해결: Wave 3 R2에서 정확한 진입점(AddProblemModal) 발견 후 일괄 처리

### 4.2 Wave 3 Auto-Critic R1
- session: `019e1ef2-96f4-7953-9e68-87e5071c09f9`
- P0/P1 0건, **P2 1건**: 동일 본질 — `AddProblemModal.tsx:675` `allowedLanguages: ['sql']`은 전달하나 `category: 'SQL'` 미전달
- Codex가 정확한 진입점 식별 (Wave 1+2 P2의 구체화)
- 해결 경로 명시: `CreateProblemData` 타입 + `AddProblemModal` payload + 테스트 보강

### 4.3 Wave 3 R2 Auto-Critic
- session: `019e1efa-8ae4-7df3-859b-b7e189b884d9`
- ✅ **Critical/High/Medium 0건, 머지 가능**
- Low 2건 (선택): 테스트명 mismatch, UpdateProblemData.category 선제 확장 (둘 다 차단 아님)
- Codex 원문: "I did not find a discrete regression or blocking issue in the modified lines"

### 4.4 Hotfix Auto-Critic
- session: `019e1f14-e88e-75a3-a266-1e7abfe8c8ba`
- ✅ **머지 가능, 도입된 결함 0건**
- 추가 관찰: gateway `xml-naming@0.1.0` 신규 transitive (NaturalIntelligence MIT, 위험 없음), Next.js patch 3단계 점프 SWC 바이너리 전 플랫폼 일관

## 5. 검증

### 5.1 PR #229 (본 PR)
- problem 170 / gateway 783 / frontend 1356 tests PASS
- ESLint / tsc --noEmit / Next.js + NestJS build 클린
- CI: 30 pass / 0 fail / 9 skip, mergeStateStatus CLEAN
- merged at 2026-05-13T01:47:30Z, mergeCommit `998ec4e`

### 5.2 main push CI 실패 + Hotfix
- run `25773141824` (main push @ `998ec4e`): **Trivy Scan frontend + gateway 실패** (HIGH 9 + 1)
- 원인: Trivy DB 갱신으로 신규 CVE 노출 (Sprint 151 변경과 **무관**)
- **Sprint 150 교훈 #1 직접 재현**: paths filter로 PR 단계 Trivy SKIPPING → main push 후 image build + fresh DB로 노출

### 5.3 PR #230 (Hotfix)
- frontend 1356 / gateway 783 tests PASS (회귀 없음)
- CI: 30 pass / 0 fail / 9 skip, MERGEABLE/CLEAN
- merged at 2026-05-13T02:15:21Z, mergeCommit `4313561`

### 5.4 main push CI (Hotfix 후) — 본질 검증
- run `25774076614` (main push @ `4313561`):
  - **state=completed | conclusion=success**
  - **38 jobs pass / 0 fail**
  - **Trivy Scan 8 services 전부 SUCCESS** (frontend/gateway/submission/problem/identity/ai-analysis/blog/github-worker)
- main green 회복 ✅

## 6. 회귀 차단 본질 8 레이어 (Sprint 145~150 누적 패턴 계승)

| # | 레이어 | 위치 |
|---|--------|------|
| 1 | Backend entity enum | `problem.entity.ts` ProblemCategory |
| 2 | Backend DTO 검증 | `create-problem.dto.ts` @IsEnum |
| 3 | Backend migration | `1709000016000-AddCategoryToProblems.ts` |
| 4 | Backend service 주입 | `problem.service.ts` create/update |
| 5 | Gateway 동기화 변환 | `programmers.service.ts` toProblemCategoryEnum() |
| 6 | Frontend type | `types.ts` (Problem + CreateProblemData + UpdateProblemData) |
| 7 | Frontend WRITE payload | `AddProblemModal.tsx` SQL 분기 category 전달 |
| 8 | Frontend READ 자동 선택 | `page.tsx` ref-guarded useEffect |

**8차원째 누적 확장** — Sprint 145(metric) → 146(label) → 147(panel-title+variable) → 148(rule-label+dashboard-structure) → 149(regex-robustness) → 150(submission service problem context 폴백) → **151(Problem schema + Frontend integration 6 레이어 + 추가 Gateway 변환 + Hotfix 의존성 보안)**

## 7. 신규 패턴

1. **Auto-Critic R1 → R2 동일 본질 정밀화 패턴** — Wave 1+2 AC가 일반론(write path), Wave 3 AC가 정확한 진입점(AddProblemModal)으로 식별. 두 시각 통합으로 R2 단일 위임에 정확한 변경 위치 도달
2. **Frontend WRITE/READ 분리 진단** — 사용자 피드백은 READ 시나리오지만 작동의 prerequisite는 WRITE 흐름 (admin 등록 시 category 'SQL' 저장). 본 PR이 양쪽 모두 닫음으로써 본질 충족
3. **palette 진입점 자율 평가** — create/edit page는 사용자 시나리오 빈도 낮음 평가 → 본 PR 범위 외 결정 (overscope 회피, 후속 선택)
4. **Sprint 150 교훈 #1 직접 재현 → 즉시 hotfix 표준화** — paths filter로 PR-단계 SKIP / main-단계 실행되는 job(Trivy)에서 main push 후 노출되는 부채에 대한 표준 대응. 이번 사이클이 재현 사례 + 즉시 lockfile-only hotfix로 응답하는 표준 워크플로 확정
5. **Auto-Critic 자동 큐잉 4회의 짧은 사이클** — 동일 PR 내 Wave 분할 + R2 + hotfix 모두에 자동 큐잉. 인간 개입 없이 R1/R2 결과 즉시 반영. 단일 일자 / 2 PR / Auto-Critic 4회 / 모두 clean 종료

## 8. 교훈

1. **사용자 피드백 본질은 표면을 넘어 데이터 흐름 양쪽 닫음** — "SQL 진입 시 자동 SQL"은 READ 표면이나 prerequisite WRITE 흐름이 닫혀야 작동. 사용자 피드백 처리 시 표면 + prerequisite 동시 분석 필수
2. **paths filter 우회 부채는 main push 시점에서만 노출 — 즉시 hotfix가 표준** — Sprint 150 교훈 #1 검증. PR CI green이 main green 보장 아님. main push CI 실패 즉시 별개 hotfix PR로 응답하는 패턴이 표준 (대기/연기 X)
3. **Trivy DB 갱신으로 인한 dependency CVE 노출은 lockfile-only 대응 가능** — package.json caret 범위 그대로, lockfile만 `npm install`/`npm update`로 갱신하여 patch-level 자동 적용. breaking change 위험 거의 없음. 표준 hotfix 패턴
4. **Auto-Critic R1 시각 다르면 R2가 정밀화** — Wave 1+2 AC vs Wave 3 AC 동일 본질 P2를 다른 시각(일반론 vs 정확한 진입점)으로 적발. 두 시각 통합 시 R2 단일 위임으로 정확한 변경 위치 도달 가능 (Sprint 146 R1 1건 → R2 2건 추가 적발 패턴 변형)
5. **Auto-Critic Codex 교차 검증의 가치 재확인** — 4회 호출 모두 정확한 P2 적발 또는 clean 판정. P0/P1 적발 0건 + 본질 미충족 P2 정확한 식별 → 머지 직전 안전망 역할 충실. **본 사이클로 Auto-Critic 자동 큐잉 정책(Sprint 117~)의 효과 강력 검증**

## 9. Sprint 152 이월 시드

### UAT 사용자 직접 (Oracle 작업 외)
- **시드 #5**: 프로그래머스 재제출 채점 통과 확인 (8 스프린트 누적, 본 PR로 SQL 자동 선택 UAT 자연스럽게 포함됨)
- **시드 #9**: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합

### 후속 (선택, 본 PR 범위 외)
- create/edit page.tsx category UI 추가 (palette 평가: 사용자 시나리오 빈도 낮음 → 본 PR 범위 외)
- Programmers URL 자동 카테고리 추론 (sourceUrl 패턴 매칭으로 admin 입력 마찰 감소)
- 기존 SQL 문제 데이터 백필 (수동 ADMIN 작업 또는 import 스크립트 — 신규 SQL 문제는 자동 적용)
- Sprint 150 후보 미해소 3건 (`.claude-tools/` Oracle 디스패치 도구 정리 / CI paths filter 우회 부채 점검 자동화 / prom-client default metric stale 점검)

## 10. 메트릭

| 항목 | 값 |
|------|-----|
| 기간 | 2026-05-13 (단일 일자) |
| origin/main | `2f68402` → **`4313561`** |
| 머지된 PR | 2건 (#229 본 PR / #230 hotfix) |
| 본 PR commits | 11 (squash 1) |
| Hotfix commits | 2 (squash 1) |
| 변경 파일 (본 PR) | 13 (+449 / -10) |
| 변경 파일 (hotfix) | 4 lockfile (+74 / -58) |
| Auto-Critic 호출 | 4회 (R1×3 + R2 hotfix) — 모두 P0/P1 0건 |
| 회귀 차단 레이어 | 8 (Sprint 145~150 누적 패턴 8차원째) |
| 브랜치 규율 | 17 스프린트 연속 준수 (main 직접 commit 0건) |
| 테스트 | problem 170 / gateway 783 / frontend 1356 PASS |
| main CI 최종 | run `25774076614` SUCCESS, 38 pass / 0 fail, Trivy 8 service 전부 SUCCESS ✅ |
