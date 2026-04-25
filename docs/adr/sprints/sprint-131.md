---
sprint: 131
title: "Sprint 129 시드 마감 — TopNav dead code 제거 + AppLayout 테스트 중복 제거 + /start ADR cross-check"
date: "2026-04-25"
status: completed
agents: [Oracle]
related_adrs: ["ADR-026"]
---

# Sprint 131: Sprint 129 시드 마감 + 가벼운 보수

## Decisions

### D1: TopNav dead code 전량 삭제 (Wave A)
- **Context**: Sprint 129 Critic 1차 리뷰에서 식별된 시드 1. `TopNav.tsx`(392줄)는 AppLayout 도입 이후 production import 0건으로 완전한 dead code. `TopNav.test.tsx`(551줄)도 동반 dead code
- **Choice**: TopNav.tsx + TopNav.test.tsx 삭제 + `@related TopNav` 주석 5곳을 AppLayout로 교체 (LanguageSwitcher, StudySidebar, avatars.ts, study-room/page.tsx)
- **Verification**: `grep -rn "TopNav" frontend/src/` 잔존 참조 0건 확인
- **Code Paths**: 삭제 — `frontend/src/components/layout/TopNav.tsx`, `frontend/src/components/layout/__tests__/TopNav.test.tsx`
- **PR**: [#159](https://github.com/tpals0409/AlgoSu/pull/159) (`411479b`)

### D2: AppLayout.test.tsx 중복 테스트 케이스 제거 (Wave B)
- **Context**: Sprint 129 Critic 1차 리뷰에서 식별된 시드 2. L189-196 Case 1("locale-stripped /dashboard 경로에서 대시보드 nav가 활성화된다")과 L198-203 Case 2("한국어 로케일 /dashboard에서 대시보드 nav 활성화 — 회귀")가 100% 동작 동일. 둘 다 `mockUsePathname.mockReturnValue('/dashboard')` + `bg-primary-soft` 검증
- **Choice**: Case 1 보존 (locale-stripped 의미를 명확히 표현), Case 2 삭제 (-6줄)
- **Code Paths**: `frontend/src/components/layout/__tests__/AppLayout.test.tsx` L198-203 삭제
- **PR**: [#159](https://github.com/tpals0409/AlgoSu/pull/159) (`411479b`)

### D3: /start skill에 스프린트 번호 ADR cross-check 추가 (Wave C)
- **Context**: Sprint 130 ADR-026 G1(메모리 윈도우 미갱신으로 sprint 번호 오인) 재발 방지. Sprint 125~130 동안 sprint-window.md가 Sprint 92로 고정되어 PR/브랜치에 `sprint-93` 명명 오염 발생
- **Choice**: `/start` skill 2.5단계 신설 — `docs/adr/sprints/` 최신 ADR 번호와 sprint-window.md [2] 번호를 ±2 범위로 비교, 불일치 시 경고 출력
- **Note**: `.claude/` 디렉토리가 `.gitignore`에 포함되어 로컬 적용만 가능. git 추적 불가

## Metrics

| 항목 | 값 |
|------|-----|
| 총 변경 | -955줄 (5 insertions, 955 deletions) |
| jest | 1356 통과 (1408 → 1356, -52 tests: TopNav 51건 + 중복 1건) |
| tsc | clean |
| lint | clean |
| CI | 30+ checks all SUCCESS |
| Critic | Codex gpt-5.4 세션 `019dc4a9-5025-7262-baec-d0f4caa83885` — 머지 가능 ✅ |
| PR | [#159](https://github.com/tpals0409/AlgoSu/pull/159) Squash merge `411479b` |
| 커밋 수 | 1 (squash) |
| end_commit | `411479b` |

## Carryover (Sprint 132 후보)

Sprint 130 이월 6건 중 미소화분:
- [ ] ADR-027 구현 — aether-gitops 브랜치 규율
- [ ] ADR-028 구현 — 개발 서버 분리
- [ ] C-1: 미사용 ReplicaSet 정리 + revisionHistoryLimit
- [ ] D-1: E2E Integration Test 실패 조사
- [ ] D-2: Circuit Breaker + classic queue 무한 requeue 방지
- [ ] SealedSecret 컨트롤러 키 rotation 자동 재봉인 CI
- [ ] AlertManager receiver self-test 룰
