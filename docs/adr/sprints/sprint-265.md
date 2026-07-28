---
sprint: 265
title: "데스크톱 사이드바 리사이즈·접기 (feedback #12)"
date: "2026-07-28"
status: completed
agents: [Oracle, Palette]
related_adrs: ["sprint-264", "sprint-263"]
related_memory: ["sprint-window"]
topics: ["frontend", "ui", "layout", "sidebar", "feedback", "dead-code"]
tldr: "algosu-feedback #12(노션식 사이드바 크기조절·접기)를 실사용 레이아웃에 정식 구현. #12는 Sprint 263 #510에서 '해소'로 기록됐으나, 리사이즈/접기가 화면에 렌더되지 않는 dead code `StudySidebar.tsx`에 들어가 실제 사이드바 `AppLayout.tsx`(고정 w-[220px])엔 미적용이던 것을 세민님이 지적 → 재오픈 후 본 스프린트로 정식 처리. #524 `1d0958db`: `useSidebarResize.ts` 훅 신설 + `AppLayout.tsx` 드래그 리사이즈·접기 토글·폭 localStorage 저장, 사용자 요구인 크기 제한 clamp(min 180 / max 400 / default 220) 적용, dead code `StudySidebar.tsx` 제거. Critic이 접힘 상태(56px) 헤더 로고와 펼치기 토글의 클릭영역 겹침(P2)을 포착 → Palette 재위임이 정지해 Oracle이 직접 해소(017bf5f9: 접힘 시 로고 링크 숨김·헤더 중앙정렬·토글 absolute 제거) → 재리뷰 CLEAN."
---
# Sprint 265 — 데스크톱 사이드바 리사이즈·접기 (feedback #12)

_날짜: 2026-07-28_

## 목표

algosu-feedback **#12**("노션같이 사이드바 크기조절 및 접기")를 실제 사용 레이아웃에 정식 구현한다. 단일 이슈 스프린트다.

**배경 — 오해소 정정**
#12는 Sprint 263 #510(스터디룸·사이드바 UX 개선)에서 "해소"로 close됐으나, 세민님이 실제 화면에서 미적용임을 지적했다. 조사 결과 #510은 리사이즈/접기를 `StudySidebar.tsx`에 구현했는데, 이 파일은 JSDoc `@related` 주석 1곳에서만 참조되는 **dead code**(어디서도 import/렌더 안 됨)였다. 실제 데스크톱 사이드바는 `AppLayout.tsx`(고정 `w-[220px]`)로, #510은 여기에 손대지 않았다. → #12 재오픈 후 Sprint 265로 정식 처리.

**사용자 추가 요구**: 드래그 리사이즈 시 **크기 제한**(과확대/과축소 방지)을 둘 것.

## 결정 사항

### D1. 구현 위치 = 실사용 `AppLayout.tsx`, dead code `StudySidebar.tsx` 제거 (#524)

리사이즈/접기를 실제 렌더되는 데스크톱 사이드바(`AppLayout.tsx`)에 구현한다. #510이 기능을 넣었던 `StudySidebar.tsx`는 import 0건의 dead code이므로 재활용하지 않고 **삭제**한다(동일 기능이 두 곳에 흩어지는 혼선 차단). 리사이즈 로직은 재사용 가능한 커스텀 훅 `useSidebarResize.ts`로 분리한다.

### D2. 크기 제한 = clamp min 180 / max 400 / default 220 (사용자 요구)

드래그 리사이즈에 **clamp**를 필수 적용한다 — 최소 180px / 최대 400px / 기본 220px. 포인터 이동 시점과 localStorage 로드 시점 **양쪽**에 clamp를 걸어, 저장된 값이 범위를 벗어나도 항상 유효 폭으로 보정한다. 이 상수 패턴은 dead code였던 `StudySidebar.tsx`의 `clampWidth`(MIN 180/MAX 400/DEFAULT 220)를 참조 구현으로 삼아 실사용 레이아웃에 이식했다.

### D3. 접힘 상태 헤더 겹침 해소 = 로고 숨김·토글 재배치 (Critic P2)

Critic이 접힘 상태(폭 56px)에서 헤더 로고 링크와 펼치기 토글(`right-2`, 24px)의 **클릭영역 겹침**(P2)을 포착했다 — 로고 클릭 시 대시보드 이동 대신 펼치기 토글이 발화. 56px 폭에서 로고와 토글은 물리적으로 공존 불가하므로, **접힘 시 로고 링크를 숨기고 헤더를 중앙정렬, 토글의 `absolute` 배치를 제거**해 겹침을 원천 차단했다(Critic 권고 "하나를 숨김/재배치"와 정합).

## 구현

- **#524 `1d0958db`** (`feat/sprint-265-sidebar-resize`):
  - 신규 `frontend/.../useSidebarResize.ts` — 드래그 리사이즈 훅(clamp 180~400, localStorage 폭 저장/로드)
  - `AppLayout.tsx` — 사이드바 드래그 핸들·접기 토글 통합, 하드코딩 `md:ml-[220px]` 오프셋을 동적 폭에 연동
  - `StudySidebar.tsx`(dead code) 제거
  - Palette 구현 커밋 `49cea675`·`4f8f2b67` + Critic P2 Oracle 직접 수정 `017bf5f9`

**검증(물리적 사실)**: Oracle 직접 게이트 — `tsc` 델타 0(`globals.css` TS2882는 미변경 baseline, CI green) · ESLint **Error 0**(Warning은 `react/forbid-dom-props` baseline, 동적 폭 인라인 style 불가피) · jest **1860 pass/0 fail**(`AppLayout.test.tsx` 10 pass 포함). Critic 재리뷰 **CLEAN**(P2 소멸). squash 머지 `1d0958db` origin/main 반영 확인.

## 인시던트

1. **#12 오해소·재오픈**: Sprint 263 #510이 #12를 dead code에 구현하고 close → 세민님 지적으로 미적용 발각 → 재오픈 후 본 스프린트로 정식 처리. 별건으로 #3(탭 UUID)·#6(AI리포트 패딩)도 초기 미해소 오분류했으나 실측 결과 PR #505 `03c13ef1`로 이미 해소돼 있어 정정·close.
2. **Palette 재위임 정지(ACP background)**: Critic P2 발견 후 Palette 수정 재위임이 21분간 커밋·워킹트리 변경 0으로 정지 → 더 기다리지 않고 Oracle이 P2를 직접 수정(소규모 FE 변경).
3. **자동 verdict 오탐(재확인)**: `.verdict` 자동 파서가 #524 최초 리뷰를 "CLEAN-hint"로 표기했으나 로그 codex 판정부는 P2 1건 존재 → Oracle 로그 직접 판독으로 적발. 재리뷰는 findings 0 = CLEAN 확정.
4. **로컬 main stale 오판정**: 종료 절차 중 `git merge --ff-only`가 "Already up to date"를 반환했으나 gh API 실측으로는 로컬이 origin/main보다 뒤처진 상태 → 원격추적 ref stale. `fetch` + `reset --hard origin/main`으로 정합화.

## 이월

- 없음. (#12 정식 해소, 미해소 잔여 피드백 이슈 0건)

## 교훈

- **"해소" 기록은 렌더 경로까지 실측해야 한다.** #510은 코드를 작성·머지했으나 그 컴포넌트가 화면에 마운트되지 않아 사용자 관점에선 미해소였다. dead code(import 0)에 넣은 기능은 "구현했다"가 아니다 — 이슈 close 전 실사용 컴포넌트에서 렌더되는지 grep으로 확인할 것.
- **크기 제한 clamp는 입력·복원 양쪽에 걸어야 한다.** 드래그 시점만 clamp하면 localStorage에 저장된 범위 밖 값이 다음 로드에서 그대로 복원돼 제한이 무력화된다. 경계 보정은 값이 들어오는 모든 경로에 적용.
- **정지한 위임은 기다리지 말고 회수한다.** ACP background 위임이 무음 정지하면(커밋·워킹트리 변경 0) 소규모 변경은 Oracle이 직접 처리하는 편이 빠르다 — 자기보고 신뢰 대신 실측(커밋 이력)으로 정지를 판별.
