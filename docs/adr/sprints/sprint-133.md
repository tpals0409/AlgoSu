---
sprint: 133
title: "이월 항목 처리 — GuestNav LanguageSwitcher 마운트 + 운영 부채 정찰"
date: "2026-04-26"
status: completed
agents: [Oracle, Herald, Scout]
related_adrs: ["ADR-026"]
---

# Sprint 133: 이월 항목 처리

## Decisions

### D1: GuestNav LanguageSwitcher 마운트 (Wave A-1)
- **Context**: Sprint 129에서 LanguageSwitcher 4곳 마운트(AppLayout L384/L464, AuthShell L43, LandingContent L80). Sprint 132에서 LegalLayout 5번째 마운트. GuestNav(`/guest`, `/guest/preview/[slug]`)는 자체 nav(Logo + ThemeToggle + signup CTA)가 있으나 LanguageSwitcher 미마운트 — 게스트 페이지 한/영 전환 불가
- **Choice**: GuestNav 우측 actions div에 `<Suspense fallback={null}><LanguageSwitcher /></Suspense>` 추가 (ThemeToggle 앞 배치). 6번째 마운트 지점 일관화. GuestNav.test.tsx 신규 생성(4 cases)
- **Alternatives**: ThemeToggle 뒤 배치 → 다른 마운트 지점과 시각적 위치 불일치
- **Code Paths**: `frontend/src/components/guest/GuestNav.tsx:73-75`, `frontend/src/components/guest/__tests__/GuestNav.test.tsx`
- **PR**: [#163](https://github.com/tpals0409/AlgoSu/pull/163) (`ea9ac28`, Squash merge)

### D2: SharedLayout LanguageSwitcher — 정책 제외 유지 (Wave A-2)
- **Context**: SharedLayout(`/shared/[token]`)은 `<>{children}</>` 빈 fragment — nav 자체 부재. LanguageSwitcher 마운트 시 nav 컨테이너 신규 디자인 필요
- **Choice**: 정책 제외 유지. 공유 링크는 토큰 발급자 locale 고정이 UX 상 적절. Sprint 132 D2 정책 결정과 일관
- **Alternatives**: ① 미니 nav 추가 (디자인 결정 필요, scope 초과) / ② page.tsx 상단에 위임 (UX 어색)
- **Rationale**: 비인증 공유 링크에서 언어 전환은 발급자 의도 이탈. nav 없는 레이아웃에 강제 마운트는 과잉

### D3: D-2 Queue requeue 방지 — 이미 구현됨 확인 (Wave B)
- **Context**: Sprint 130 ADR-026 이월 항목. Scout 정찰 결과 DLQ(`submission.events.dlx`) + NACK(`channel.nack(msg, false, false)`) + Redis 멱등성 + Saga 타임아웃(5/15/30분) + 최대 3회 재시도가 완전 구현됨
- **Choice**: D-2 이월 해소. Circuit Breaker 패턴 부재는 별건으로 Sprint 134+ 시드
- **Code Paths**: `services/github-worker/src/worker.ts:132,224,350-402`, `services/submission/src/saga/mq-publisher.service.ts:88-105,149-207`, `services/submission/src/saga/saga-orchestrator.service.ts:34-42,455`

### D4: infra 매니페스트 부재 확인 — C-1 이 레포 작업 불가 (Wave B 정찰)
- **Context**: Scout 정찰 중 `infra/` 디렉토리가 이 AlgoSu 레포에 존재하지 않음 확인. k8s 매니페스트는 aether-gitops 외부 레포에만 존재
- **Choice**: C-1(revisionHistoryLimit 추가) 포함 모든 매니페스트 변경은 aether-gitops 레포에서 별도 작업 필요. Sprint 134+ 이월

## Patterns

### P1: LanguageSwitcher 마운트 패턴 — 6번째 반복
- **Where**: GuestNav.tsx (Client Component)
- **Pattern**: `<Suspense fallback={null}><LanguageSwitcher /></Suspense>` — 우측 actions 영역, ThemeToggle 또는 nav 우측 첫 번째 위치
- **Precedent**: AppLayout(L384/L464), AuthShell(L43), LandingContent(L80), LegalLayout(L36-38), GuestNav(L73-75)
- **When to Reuse**: 신규 layout에 언어 전환 필요 시. nav 컨테이너가 이미 존재하는 경우에만 적용. nav 부재 시 정책 제외 판단 선행

## Metrics

| 항목 | 값 |
|------|-----|
| 총 변경 | +80줄, -1줄 (2 files) |
| jest | 1357 → **1361** (+4) |
| tsc | clean |
| lint | clean |
| Critic | 생략 (기존 패턴 6번째 반복, 신규 로직 0건) |
| PR | [#163](https://github.com/tpals0409/AlgoSu/pull/163) Squash merge `ea9ac28` |
| CI | 15 pass / 5 skipping / 0 fail |
| end_commit | `ea9ac28` |

## Carryover (Sprint 134+)

Sprint 130 운영 부채 미소화분 (aether-gitops 외부 레포 또는 인프라 의존):
- [ ] ADR-027 구현 — aether-gitops 브랜치 규율
- [ ] ADR-028 구현 — 개발 서버 분리 (인프라 비용 결정 선행)
- [ ] C-1: revisionHistoryLimit 추가 (aether-gitops 매니페스트, `infra/` 부재 확인됨)
- [ ] D-1: E2E 전체 테스트 자동화 (`e2e-full.sh` 미존재, docker-compose 의존)
- [ ] SealedSecret 컨트롤러 키 rotation 자동 재봉인 CI
- [ ] AlertManager receiver self-test 룰

신규 시드:
- [ ] Circuit Breaker 패턴 도입 (GitHub API, Problem Service, AI Analysis Service HTTP 호출)
