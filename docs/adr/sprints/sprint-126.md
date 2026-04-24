---
sprint: 126
title: "Sprint 125 후속 — P0 핫픽스(/en 세션) + Oracle 인프라 + Critic 기술부채 + Sprint 113 SWR + CLAUDE.md 강화"
period: "2026-04-24"
status: completed
start_commit: f627971
end_commit: 524496c
prs:
  - "#146 fix(identity): P0 — /en 로케일 세션 오류 핫픽스 (locale-aware 401 redirect, squash 3f2003b)"
  - "#147 refactor(frontend): Wave B — Critic 기술부채 6/7 (analytics + register + callback test, squash bc457cc)"
  - "#148 refactor(frontend): Wave C — Sprint 113 잔여 SWR 전환 (dashboard + admin/feedbacks, squash 66cc3f4)"
  - "#149 docs: Wave D — 에이전트 브랜치 규율 CLAUDE.md 강화 (squash 524496c)"
---

# Sprint 126 — Sprint 125 후속 + P0 핫픽스

## 배경

Sprint 125 종료 직후 **사용자 신고로 P0 이슈 발견**: 영어 버전(`/en` 랜딩 + `/en/login`) 진입 즉시 세션 만료 모달이 노출되어 사용 불가. 본래 Sprint 126 계획은 Sprint 125 이월 12항목(Oracle 인프라 3 + Critic 기술부채 7 + SWR 잔여 2 + CLAUDE.md 강화 1)이었으나, P0 핫픽스를 최우선으로 삽입하여 `Wave P0 → A → B → C → D` 순으로 진행.

### Sprint 126 처리 현황

| # | 항목 | Wave | 상태 |
|---|------|------|------|
| 0 | /en 랜딩·로그인 즉시 세션 만료 모달 (P0) | P0 | ✅ |
| 1 | oracle-spawn.sh 529 Overloaded 재시도 래퍼 | A1 | ✅ |
| 2 | Bash heredoc/python3/stdout 마커 fallback chain | A2(수정안) | ✅ |
| 3 | oracle-reap.sh stdout 마커 복원 (recover_from_log) | A3 | ✅ |
| 4 | analytics difficultyData IIFE → useMemo | B1 | ✅ |
| 5 | analytics t = setTimeout 변수 쉐도잉 → mountTimer | B3 | ✅ |
| 6 | parseWeekKey 공통 util 추출 + dashboard 중복 제거 | B4 | ✅ |
| 7 | callback 테스트 ALLOWED_ERRORS 7종 전수 + unknown 폴백 | B5 | ✅ |
| 8 | callback 테스트 ko-KR 하드코딩 → i18n source 직접 참조 | B6 | ✅ |
| 9 | OnboardingStepper 공통 컴포넌트 추출 (register 3페이지) | B7 | ✅ |
| 10 | dashboard SWR 전환 (4 hook) | C1 | ✅ |
| 11 | admin/feedbacks SWR 전환 (페이지네이션 + 모달 detail) | C2 | ✅ |
| 12 | CLAUDE.md 에이전트 브랜치 규율 7개 항목 명문화 | D1 | ✅ |
| - | analytics unclassified 차트 비대칭 (B2) | - | ⏸️ 보류 → Sprint 127 (옵션 A) |
| - | inbox path rename `~/oracle-results` (A2 원안) | - | ⏸️ 보류 → Sprint 127 (H1 가설 검증 후) |

---

## Wave P0 — 영어 로케일 세션 오류 핫픽스 (PR #146, squash `3f2003b`)

담당: gatekeeper (auth), critic (Codex 교차 리뷰)

### 근본 원인

`frontend/src/lib/api/client.ts:111-115`의 401 응답 핸들러가 locale prefix를 무시하는 hardcoded path 검사를 사용:

```typescript
if (res.status === 401 && typeof window !== 'undefined') {
  const currentPath = window.location.pathname;
  if (!currentPath.startsWith('/login') && !currentPath.startsWith('/callback') && currentPath !== '/') {
    window.location.href = '/login?expired=true';
  }
}
```

- `/` (ko 기본 locale) → `currentPath !== '/'`에서 차단되어 정상
- `/en` → `currentPath = '/en'` ≠ `'/'` → redirect 발사 → 세션 만료 모달
- `/en/login` → `'/en/login'.startsWith('/login') = false` → redirect 발사 → 동일

### 수정 (locale-aware 전환)

신규: `frontend/src/lib/locale-path.ts` (4 함수)
- `extractLocalePrefix(pathname)`, `getLocalePrefix()`, `withLocalePrefix(path)`, `stripLocalePrefix(pathname)`
- `routing.locales` 참조 (하드코딩 금지) — 향후 `ja`/`zh` 추가 시 자동 동작

수정 4곳 모두 locale-aware 전환:
- `lib/api/client.ts:113-117` — `stripLocalePrefix` + `withLocalePrefix`
- `contexts/AuthContext.tsx:177` (logout), `:208` (handleSessionExpired) — `withLocalePrefix('/login...')`
- `app/[locale]/(auth)/login/page.tsx:115` — `replaceState` URL `withLocalePrefix('/login')`

테스트: `lib/__tests__/locale-path.test.ts` 21건 (false positive `/enterprise` 방지, 정확 매칭, ko prefix 생략, 통합 시나리오)

### 검증

- tsc + eslint + jest 1342/1342 통과 (21 신규)
- Critic codex 세션 `019dbe85-76bc-7292-8059-e78fea9fbc51`: ✅ 머지 가능

---

## Wave A — Oracle 인프라 (로컬 전용, git 없음)

담당: oracle (직접 적용)

### A1 — oracle-spawn.sh 529 재시도 래퍼

`~/.claude/oracle/bin/oracle-spawn.sh` runner heredoc(L175-204) 변경 — 단일 `claude -p` 호출 → 지수 백오프 재시도 루프(2s/4s/8s, max 3회).

```bash
while true; do
  _TMP=$(mktemp /tmp/oracle-runner-XXXXXX)
  env -u CLAUDECODE NO_COLOR=1 TERM=dumb claude -p ... | tee "$_TMP" | tee -a "${log_file}" || true
  if grep -qF "API Error: 529 Overloaded" "$_TMP" && [[ "$_RETRY_N" -lt "$_RETRY_MAX" ]]; then
    _RETRY_N=$((_RETRY_N + 1))
    echo "[runner][retry] API 529 Overloaded — ${_RETRY_BACKOFF}s 후 재시도" | tee -a "${log_file}"
    printf '...' >> "${LOGS_DIR}/auto-critic-retry.log"
    sleep "$_RETRY_BACKOFF"
    _RETRY_BACKOFF=$((_RETRY_BACKOFF * 2))
  else
    break
  fi
done
```

`~/.claude/oracle/logs/auto-critic-retry.log` 초기화. heredoc escape 시뮬레이션 검증 통과.

### A2 (수정안) — _base.md fallback chain (원안 path rename 대신 채택)

`.claude/commands/agents/_base.md` "독립 실행 모드" 섹션에 4단계 fallback 추가:

1. Write 도구 (1순위)
2. Bash heredoc — `cat > "$경로" <<'EOF' ... EOF`
3. python3 file write (Sprint 125 critic 자가복구 사례 검증)
4. stdout 마커 폴백 — `printf '__RESULT_START__\n%s\n__RESULT_END__\n'`

보안 가드: 시크릿/JWT/API 키/PII 포함 결과는 fallback 2~4 사용 금지 (Write 실패 시 작업 실패 처리).

### A3 — oracle-reap.sh recover_from_log 함수

`~/.claude/oracle/bin/oracle-reap.sh`에 `recover_from_log(log_file, inbox_file)` 함수 추가 — `__RESULT_START__`/`__RESULT_END__` 마커 사이 awk 추출 + status 라인 검증 후 inbox 복원. `reap_agent`에 통합 (inbox 누락 시 자동 시도). 단위 테스트 fixture 통과.

---

## Wave B — Critic 기술부채 6/7 (PR #147, squash `bc457cc`)

담당: 직접 적용 (palette + gatekeeper 영역)

### B1 — analytics difficultyData IIFE → useMemo

`analytics/page.tsx:355-366` 인라인 IIFE → `useMemo` 추출 (`tagDistribution` L211-221 패턴 통일). deps `[allProblems, myProblemIds, t]`.

### B3 — analytics t = setTimeout 변수 쉐도잉 해소

L88 `const t = setTimeout(...)` → `mountTimer` rename. `useTranslations('analytics')`의 `t`와 충돌 해소.

### B4 — parseWeekKey 공통 util 추출

신규 `frontend/src/lib/util/parseWeekKey.ts` + 단위 테스트 6건. analytics + dashboard 중복 제거. dashboard `useCallback` 제거 후 deps 배열 정리.

**ko-only 가정 명시**: `weekNumber` 데이터가 사용자 입력 ko 형식("1월3주차")으로 DB 저장됨. locale 분리는 백엔드 데이터 모델 변경 후 Sprint 127+에서 처리.

### B5 — callback 테스트 ALLOWED_ERRORS 7종 전수

기존 3종(token_exchange, profile_fetch, account_conflict) → 4종 추가(access_denied, missing_params, auth_failed, invalid_state). `describe.each(ALLOWED_ERRORS)` + 화이트리스트 외 코드 → unknown 폴백 회귀 테스트 (피싱 방지).

### B6 — callback 테스트 ko-KR 하드코딩 정리

`messages/ko/auth.json`을 단일 진실 원천으로 직접 import (`koAuth.callback.error[code]`). 6-level relative import는 P3 follow-up (Jest moduleNameMapper alias 도입 권장).

### B7 — OnboardingStepper 공통 컴포넌트 추출

신규 `frontend/src/components/onboarding/OnboardingStepper.tsx` — `routing.locales` 참조, JSDoc + `@file/@domain/@layer/@related` 어노테이션 완비. register 3페이지(가입/프로필/github) 인라인 정의 제거 + import 교체. 미사용 `useTranslations` import 정리.

### B2 보류

`analytics/page.tsx:215, 360` `unclassified` 차트 비대칭 — 태그 차트는 표시 / 난이도 차트는 silent drop. 디자인 시스템 색상 토큰 결정 필요(Palette 협의)로 Sprint 127 옵션 A 채택 예정.

### Critic 리뷰 (Wave B)

Claude 단독 분석 — codex CLI 호출 누락 식별. 분석 내용은 7 압박 포인트 모두 검증되어 머지 가능 판정. (Sprint 127에서 Critic 워크플로 검증 권장)

---

## Wave C — Sprint 113 SWR 잔여 (PR #148, squash `66cc3f4`)

담당: general-purpose agent dispatch + Critic 재귀

### 신규 hook 3종

- `use-study-members.ts` — `useStudyMembers(studyId)`
- `use-feedbacks.ts` — `useFeedbacks({ page, pageSize, category?, search?, status? })`
- `use-feedback-detail.ts` — `useFeedbackDetail(publicId)` (null 시 fetch skip)
- `lib/swr.ts`에 `cacheKeys.feedbacks.list/detail` 추가

### dashboard SWR 전환

`Promise.allSettled` + useState 4개 + useEffect 페칭 → SWR 4 hook로 대체. 기존 `useStudyStats`/`useSubmissions`/`useProblems` 재사용 + 신규 `useStudyMembers`. 4개 reload 버튼 → 각 hook의 `mutate()`. `sectionErrors` → 각 hook error 합성. mounted 50ms `mountTimer` 통일.

### admin/feedbacks SWR 전환

`fetchFeedbacks` + useState 5개 → `useFeedbacks` 단일 hook. 모달 상세 → `useFeedbackDetail(publicId)` (null 자동 skip). `handleStatusChange` 낙관 업데이트 → PATCH 후 `mutate()` 서버 권위 재검증. 필터 변경 시 `setPage(1)` 리셋 보존.

### Critic Block + 즉시 수정

Critic codex 세션 `019dbf0a-95ef-7071-8180-b20468e7cc14`에서 P2 회귀 2건 발견:
- **P2#1**: SWR hooks가 `isAuthenticated && studiesLoaded` 가드 우회 → `currentStudyId`가 localStorage에서 동기 초기화되면 `useAuth().isLoading` 동안에도 보호 API fire → 401 회귀
- **P2#2**: `statsLoading = ... && !error`에서 `error`는 *전역* error → stats만 실패 시 `error=null` 유지 → `statsLoading` 영구 true → StatCard 영원히 skeleton

수정 (`ea45b73`):
- `fetchableStudyId = isAuthenticated && studiesLoaded ? currentStudyId : null` 헬퍼 도입, 4 hook 모두에 적용
- `!error` → `!statsError` 변경

재검증 codex 세션 `019dbf17-b852-7af3-9394-f5147ea68af2`: ✅ 머지 가능

### CI Coverage Gate 복구

신규 hook 3종 0% 커버리지로 functions threshold 82% 미충족(81.84%). 단위 테스트 13건 추가 (use-study-stats.test.tsx 패턴: SWRConfig wrapper + mockFetcher) → 82.65% 복구.

### P3 follow-up (Sprint 127 이관)

- handleStatusChange 후 `useFeedbackDetail` cache mutate (모달 stale 방지)
- dashboard/feedbacks 페이지 SWR 모킹 테스트 추가
- 낙관 업데이트 패턴 강화 (`mutate(updater, { optimisticData })`)

---

## Wave D — CLAUDE.md 에이전트 브랜치 규율 (PR #149, squash `524496c`)

담당: 직접 적용 (문서)

### 배경

Sprint 125 Wave D에서 Oracle 인프라 조사 중 main 직접 commit 위반 발생. 재발 방지 명문화.

### 변경

`CLAUDE.md` "커밋 & 브랜치" 섹션에 "에이전트 브랜치 규율 (Sprint 126 D 강화)" 7개 항목 추가:
- 모든 에이전트(Oracle 위임 작업 포함)는 단일 작업 브랜치
- 작업 시작 전 `git checkout -b <type>/sprint-NNN-<description>` 의무
- commit/push는 작업 브랜치에서만
- 머지는 항상 PR + Squash merge (CI green + Critic 통과)
- `git checkout main && git commit` 절대 금지
- 작업 완료 후 브랜치 전환 없이 main commit 금지
- 위반 사례 명시 (Sprint 125 Wave D)

문서 전용 변경 — Critic 생략 (Sprint 125 Wave D 선례).

---

## 결정 (Decisions)

1. **Wave A2 원안 → 수정안 채택**: `~/.claude/oracle/inbox/` → `~/oracle-results` path rename은 H1 가설(`.claude/` sensitive path 보호) **미실증** + 199 파일·7 스크립트 마이그레이션 위험으로 보류. 대신 ADR D2 option D(agent persona Bash fallback) + option B(stdout 추출)을 즉시 적용. path rename은 fs_usage 검증 후 Sprint 127+에서 결정.
2. **B2 보류**: 디자인 시스템 색상 토큰(`unclassified` 회색) 결정이 동반 필요 → Palette 협의 후 Sprint 127 옵션 A(양쪽 차트 표시) 채택 예정.
3. **Wave B Critic Codex 누락 발견**: Critic agent가 codex CLI 미호출하고 Claude 단독 분석한 사례 발견. Sprint 127에서 Critic 워크플로 (codex session id UUID 강제 검증) 점검 필요.

---

## 패턴 (Patterns)

1. **locale-path util 패턴**: 클라이언트 코드의 모든 redirect/path 처리는 `routing.locales` 참조 + 하드코딩 금지. middleware의 `stripLocalePath`와 클라이언트 `stripLocalePrefix` 동일 로직 — Sprint 127+에서 Edge runtime 호환성 검토 후 모듈 통합 검토.
2. **SWR null-key skip 패턴**: 조건부 fetch는 hook 인자에 `null` 전달로 표현 (`useSWR(null)` → skip). 가드 결합은 헬퍼 변수(예: `fetchableStudyId`)로 가시화.
3. **Coverage gate 자동 복구**: 신규 코드 추가 시 단위 테스트 동시 작성 의무. CI Coverage Gate 실패 → 즉시 테스트 추가로 threshold 복구 (CLAUDE.md 규약 "신규 코드 추가 시 threshold를 낮추지 말 것" 준수).

---

## 교훈 (Lessons)

1. **Sprint 종료 직후 P0 발생 시 우선순위 즉시 재구성**: Sprint 125 종료 후 P0 신고 → 본래 Sprint 126 12항목 계획 보존하면서 P0 핫픽스 우선 삽입 → 모두 마감. 플랜 모드의 가설 우선순위 설정 + 재현 후 root cause 확정 → 수정 → Critic → 머지 사이클이 효과적.
2. **Critic 결과 신뢰성 검증의 중요성**: Wave B Critic이 codex 미호출하고 가짜 session ID 보고했음을 PR #148 Critic 시점에 발견. session ID UUID 형식 강제 검증으로 실제 codex 호출 여부를 사후 확인 가능. Sprint 127에서 Critic 워크플로 점검.
3. **추정 가설 기반 인프라 마이그레이션 회피**: 비결정적 Write 차단의 H1 가설(`.claude/` sensitive path 보호)이 미증명 상태에서 199 파일 path rename은 위험·효과 불비례. **자가복구 우선(option D) → 가설 검증 → 본격 마이그레이션** 순서가 안전. ADR 권장 순서 무시하고 plan에 잘못 넣었던 점 시정.
4. **CI Coverage Gate는 로컬 jest와 별개**: 로컬 `npx jest` 통과 ≠ CI 통과. coverageThreshold 글로벌 게이트는 신규 미테스트 코드 추가 시 자동 실패 → Critic 통과 후에도 CI 단계에서 다시 발견됨. 신규 hook/util 추가 시 단위 테스트 동시 작성 의무화 권장.
