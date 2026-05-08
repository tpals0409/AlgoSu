---
sprint: 140
title: 문제 등록 캘린더 follow-up — 마감일 수정 진입점 + 캘린더 UX 개선
status: completed
period: 2026-04-29
start_commit: 26fa47b
end_commit: 2e37d1d
pr: https://github.com/tpals0409/AlgoSu/pull/185
followup_pr: https://github.com/tpals0409/AlgoSu/pull/186
related_sprints:
  - sprint-139 (캘린더 단일 위젯 전환 — 본 스프린트의 발단)
  - sprint-130 (운영 부채 — sealed-secret SSoT 패턴)
---

# Sprint 140 — 문제 등록 캘린더 follow-up

## 컨텍스트

Sprint 139에서 캘린더 단일 위젯 + react-day-picker v9 매핑 + ko locale 적용을 완료한 후, 사용자가 production에서 직접 사용한 결과 5건의 후속 피드백이 발생:

1. "문제 마감일 수정 기능이 있으면 좋겠습니다" — 등록 후 deadline 변경 경로 부재
2. "달력뷰가 직관적이지 않고, 선택된 날짜가 나오지 않아 불편" — 사용자 입력 즉시 확인 불가
3. "요일 표시가 이상하다" — Sprint 139 PR #183 grid 매핑 후에도 회귀
4. "month 스위치 버튼 위치가 이상하다" — nav 버튼 위치 어긋남
5. "수정 페이지에서 month를 바꿀 수 없다" — nav 버튼 클릭 불가

추가로 진단 중 별건 발견:
- "피드백 페이지(`/admin/feedbacks`) 접근 불가" — production gateway-secrets의 ADMIN_EMAILS 평문에 사용자 이메일 미포함

## 결정

### Wave 분할 + 통합 PR 전략
- Wave A~C는 단일 PR(#185)에 통합 — 3 진입점 통일성 유지 + i18n 키 일괄 추가
- Follow-up은 별도 PR(#186) — 사용자 추가 피드백 수신 후 발견된 회귀이며 root cause 단일 (calendar.tsx)
- ADMIN_EMAILS는 본 코드 레포 범위 외 (aether-gitops + production cluster cert 작업) → 사용자 직접 처리 위임

### 영향 범위 결정
- frontend 단일 레이어 → 단일 스프린트 적합 (스프린트 스코핑 메모리 부합)
- DB schema 무변경, backend service 무변경

## 변경 내역

### Wave A — 마감일 수정 진입점 (PR #185)
`frontend/src/app/[locale]/problems/[id]/page.tsx`:
- `Pencil` 아이콘 import 추가
- 헤더 isAdmin 조건부 영역에 Pencil 버튼 추가 (Trash2 좌측에 배치)
- 클릭 시 `router.push('/problems/${problemId}/edit')`
- i18n: `detail.editProblem` ko/en 추가

기존 `/problems/[id]/edit/page.tsx`는 Sprint 139 산출물로 ADMIN guard + Calendar deadline 처리가 이미 완료된 상태 → 신규 페이지 작성 0건.

### Wave B — 선택된 날짜 텍스트 (3 진입점 통일)
- `AddProblemModal.tsx` ConfirmStep
- `/problems/create/page.tsx`
- `/problems/[id]/edit/page.tsx`

각 진입점에 `DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat']` 모듈 상수 + `selectedDateText` computed 변수 추가. 캘린더 아래 primary 색상 + font-medium 텍스트로 "M월D일 (요일)" 표시. 기존 `calculatedWeek` 텍스트와 함께 표시.

i18n 신규 키:
- `form.selectedDate`: "{month}월 {day}일 ({dayName})" / "{month}/{day} ({dayName})"
- `addModal.confirm.selectedDate`: 동일 패턴

`detail.deadlineFormat` + `detail.dayNames`(Sprint 139 산출) 패턴 재사용.

### Wave C — calendar.tsx 강조 강화 (PR #185)
- `weekday`: `'h-8 text-[11px] font-normal text-text-3 flex items-center justify-center'` → `'h-8 text-[11px] font-normal text-text-3 text-center leading-8'`
  - **이유**: 부모가 `grid grid-cols-7`인 grid item에 `flex items-center justify-center` 적용 시 의도치 않은 정렬 발생 가능. `text-center` + `leading-8`로 동일 시각 효과 + grid 셀 정상 작동.
- `day_button`: `data-[selected-single=true]:font-semibold` 추가 → 선택된 날짜 시각적 강조
- `today`: `'font-semibold text-primary'` → `'font-semibold text-primary underline underline-offset-4 decoration-primary/40'` → 오늘 날짜 시각적 구별 강화

### Follow-up — calendar.tsx nav 버튼 위치 회귀 (PR #186)
사용자 시각 검증에서 추가 발견 — Wave C 변경 후에도:
- "month 스위치 버튼 위치가 이상하다"
- "수정에서 month를 바꿀 수 없다" (클릭 불가)

**근본 원인**: `calendar.tsx` root className에 `relative` 누락. react-day-picker v9의 `nav`는 `absolute` positioning을 사용하는데, root에 `relative`가 없어 가장 가까운 positioned ancestor 기준으로 위치 계산. 진입점별 부모 컨테이너 차이에 따라:
- AddProblemModal: wrapping div positioning 따라 nav 위치 결정
- create/edit: 페이지 외부 컨테이너로 nav가 밀려나 클릭 불가

**수정** (`calendar.tsx`, +2 -2):
- root: `'p-3 mx-auto w-fit'` → `'relative p-3 mx-auto w-fit'`
- nav: `'inset-x-1 top-1'` → `'inset-x-3 top-3'` (root `p-3` padding 정렬)
- nav: `pointer-events-none [&>button]:pointer-events-auto` 추가 — nav 컨테이너가 caption 위에 떠 있어도 caption 클릭 방해 차단

## 검증

- jest **1348 tests passed** (회귀 0건)
- tsc clean / lint 신규 경고 0건
- CI 28 pass / 8 skipping / 0 fail / mergeStateStatus CLEAN
- **Critic 호출 ✅** (PR #185 base origin/main, Codex `gpt-5`):
  - 명령: `codex review --base origin/main`
  - 세션: `019dd7c6-ee11-7d43-87ab-68b8644b24bf`
  - 결과: "변경 사항 내부 일관성 있음, edit 진입 버튼 locale-aware router 사용, i18n 키 ko/en 모두 존재, 선택된 날짜 UI 기존 deadline 값 재사용, 별도 회귀 미발견"
  - 종합 판정: ✅ 머지 가능
- Follow-up PR #186 — UI className 4문자 변경, 권한/입력 흐름/타임 처리 변경 0건 → Critic 미호출 (Sprint 139 PR #183 동일 정책)

## 브랜치 규율 ✅
- `feat/sprint-140-calendar-followup` (PR #185)
- `fix/sprint-140-calendar-nav-position` (PR #186)
- main 직접 commit 0건 (Sprint 134 위반 이후 **6스프린트 연속 준수**)

## 발견 사항 / 별건 시드

### react-day-picker v9 wrapper 작성 시 `relative` 필수
v9의 nav는 absolute positioning을 root 기준으로 사용. wrapper 컴포넌트의 root에 `relative`가 없으면 가장 가까운 positioned ancestor를 기준 → 진입점별 환경 차이로 위치 어긋남. PR pre-flight checklist에 추가 필요 (Sprint 139 follow-up 의존성 메이저 업그레이드 점검 + 본 사항).

### production sealed-secret SSoT 충돌
- AlgoSu 본 레포 `infra/sealed-secrets/generated/sealed-gateway-secrets.yaml`: ADMIN_EMAILS 키 **누락** (outdated)
- aether-gitops 레포 `algosu/base/sealed-secrets/sealed-gateway-secrets.yaml`: ADMIN_EMAILS sealed value **존재** (production 실제 반영)
- ArgoCD가 watch하는 것은 aether-gitops 레포만 → AlgoSu 본 레포의 sealed-secrets는 historical artifact
- **Sprint 141 시드**: AlgoSu 본 레포 sealed-secrets 정리 (제거 또는 동기화 자동화) + ADMIN_EMAILS 갱신 절차 runbook 작성

### 사용자 시각 검증의 가치 재확인
- Sprint 139 PR #181 머지 후 사용자 검증 → Calendar v9 호환 회귀 3건 발견 (PR #183)
- Sprint 140 PR #185 머지 후 사용자 검증 → nav 위치 회귀 2건 발견 (PR #186)
- 본 스프린트도 production sealed-secret 미작업으로 admin 권한 이슈 발견
- **교훈**: UI/UX 작업은 머지 전 시각 검증이 핵심. 자동화된 검증(jest/tsc/lint)으로는 잡히지 않는 회귀가 매번 발견됨.

### Critic 호출 정책 적용 사례 (계속)
- Sprint 140 본 PR (#185): Wave A 권한 진입점 + 라우팅 → 호출 → 회귀 미발견 통과
- Sprint 140 follow-up (#186): UI className 4문자 변경 → 미호출 (정책 준수)
- 정책 가이드 일관성 유지: "사용자 입력 흐름 변경" / "타임 처리 변경" / "권한 진입점 신설" 시 호출

### Oracle 디스패치 인프라 P1 미해결 (계속)
Sprint 139에서 발견된 `oracle-spawn.sh architect` PATH 이슈는 본 스프린트에서도 미진행. Oracle 직접 작업으로 진행. **Sprint 141로 이월 유지**.

## Sprint 141 이월

- **Oracle `oracle-spawn.sh` PATH 환경 점검** (Sprint 139 P1, 2스프린트 연속 미해결)
- **의존성 major 업그레이드 wrapper 호환성 점검 + PR pre-flight checklist 추가** (Sprint 139 + Sprint 140 follow-up 동일 패턴 재발)
- **en locale 동적 매핑** (next-intl locale ↔ react-day-picker locale 연결)
- **AlgoSu 본 레포 sealed-secrets/ 정리** (Sprint 140 신규 — aether-gitops와 SSoT 충돌 해소)
- **ADMIN_EMAILS 갱신 절차 runbook 작성** (Sprint 140 신규)
- 누적 시드 4건 유지:
  - github-worker errorFilter wrapper + WeakSet 동기화 (Sprint 135 이월)
  - ai-analysis Python CB schema 통일 (state 0/0.5/1 → 0/1/2 + name label)
  - CLAUDE.md `"ai-feedback"` → `"ai-analysis"` 명명 정정
  - E2E 자동 PR CI 통합 (Sprint 134부터 누적)

## 운영 작업 (사용자 직접 처리 완료)
production cluster에서 사용자 직접 진행:
- aether-gitops 레포 `algosu/base/sealed-secrets/sealed-gateway-secrets.yaml`의 `ADMIN_EMAILS` sealed value 갱신
- production cluster cert로 `tpals0409dev@gmail.com` 포함 sealed value 생성
- ArgoCD sync + Gateway pod rolling restart 후 `/admin/feedbacks` 접근 활성화 확인

본 작업은 production cluster 접근 권한 + sealed-secrets-controller cert 필요로 Oracle 본 환경(로컬 k3d)에서 수행 불가 → 사용자 위임. AI 협업 환경(Claude Code)이 production 보안 영역에 직접 접근하지 않는 것이 보안 best practice.
