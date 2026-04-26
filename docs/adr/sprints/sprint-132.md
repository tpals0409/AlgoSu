---
sprint: 132
title: "LegalLayout LanguageSwitcher 마운트 — /privacy, /terms 한/영 토글 노출"
date: "2026-04-26"
status: completed
agents: [Oracle, Architect]
related_adrs: []
---

# Sprint 132: LegalLayout LanguageSwitcher 마운트

## Decisions

### D1: LegalLayout Nav에 Suspense + LanguageSwitcher 마운트 (Wave A)
- **Context**: Sprint 129에서 LanguageSwitcher Suspense 패턴 4곳 마운트(AppLayout L384/L464, AuthShell L43, LandingContent L80). Sprint 131에서 TopNav 삭제 → AppLayout 단일화. 그러나 LegalLayout(`/privacy`, `/terms`)은 별도 layout으로 LanguageSwitcher 미마운트 상태 — 법률 페이지 방문 시 한/영 전환 불가
- **Choice**: LegalLayout Nav 우측에 `<Suspense fallback={null}><LanguageSwitcher /></Suspense>` 추가. nav 컨테이너에 `justify-between` 적용하여 Logo 좌/LanguageSwitcher 우 배치. Server Component(async) 유지, Client Component(LanguageSwitcher)는 RSC→CC 경계로 자동 처리
- **Verification**: jest 1357 통과(+1), tsc/lint clean
- **Code Paths**: `frontend/src/components/layout/LegalLayout.tsx` (+8줄), `frontend/src/components/layout/__tests__/LegalLayout.test.tsx` (+11줄, LanguageSwitcher mock + 마운트 검증)
- **PR**: [#161](https://github.com/tpals0409/AlgoSu/pull/161) (`fa1d68a`, Squash merge)

### D2: GuestNav / SharedLayout은 Sprint 132 범위 제외 (정책 결정)
- **Context**: `/guest`, `/guest/preview/[slug]`(GuestNav), `/shared/[token]`(SharedLayout)도 LanguageSwitcher 미마운트. 정찰 결과 5종 후보 식별
- **Choice**: 사용자 정책 결정으로 LegalLayout만 fix. Guest 페이지는 Landing(`/`)에서 LanguageSwitcher로 전환 후 진입 가능, Shared 링크는 읽기 전용 뷰라 토글 불필요 판단

## Metrics

| 항목 | 값 |
|------|-----|
| 총 변경 | +19줄, -2줄 (2 files) |
| jest | 1357 통과 (1356 → +1) |
| tsc | clean |
| lint | clean |
| Critic | 생략 (기존 패턴 5번째 반복, 신규 로직 0건 — Sprint 131 정책 동일) |
| PR | [#161](https://github.com/tpals0409/AlgoSu/pull/161) Squash merge `fa1d68a` |
| 커밋 수 | 2 (squash 전: `29b6b8f` 코드 + `ef5609d` ADR) |
| CI | 31 pass / 7 skipping / 0 fail |
| end_commit | `fa1d68a` |

## Carryover (Sprint 133+)

Sprint 130 운영 부채 미소화분:
- [ ] ADR-027 구현 — aether-gitops 브랜치 규율
- [ ] ADR-028 구현 — 개발 서버 분리
- [ ] C-1: 미사용 ReplicaSet 정리 + revisionHistoryLimit
- [ ] D-1: E2E Integration Test 실패 조사
- [ ] D-2: Circuit Breaker + classic queue 무한 requeue 방지
- [ ] SealedSecret 컨트롤러 키 rotation 자동 재봉인 CI
- [ ] AlertManager receiver self-test 룰
- [ ] GuestNav LanguageSwitcher 추가 (Sprint 132 범위 제외)
- [ ] SharedLayout LanguageSwitcher 추가 (Sprint 132 범위 제외)
