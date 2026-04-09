---
sprint: 63
title: "Discord 피드백 알림 (단방향 webhook)"
date: "2026-04-09"
status: completed
agents: [Architect, Postman]
related_adrs: []
---

# Sprint 63: Discord 피드백 알림 (단방향 webhook)

## Decisions
### D1: Discord 알림을 Identity 서비스에 배치
- **Context**: 피드백 생성 시 관리자에게 Discord 알림을 보내야 함. Gateway(프록시) vs Identity(저장 주체) 중 선택 필요.
- **Choice**: Identity 서비스에 DiscordWebhookService를 배치. 피드백 저장 주체가 Identity이므로 webhook도 동일 서비스에서 발송.
- **Alternatives**: Gateway에서 Identity 응답 후 webhook 발송 — 프록시 레이어에 비즈니스 로직 추가되어 기각.
- **Code Paths**: `services/identity/src/discord/discord-webhook.service.ts`

### D2: 독립 모듈 분리 (추후 봇 확장 대비)
- **Context**: 현재는 단방향 webhook만 필요하지만, 추후 Discord 봇 상호작용 기능 확장 예정.
- **Choice**: `discord/` 독립 모듈로 분리. DiscordModule이 DiscordWebhookService를 export.
- **Alternatives**: feedback 모듈 내부에 직접 구현 — 확장 시 리팩토링 필요하여 기각.
- **Code Paths**: `services/identity/src/discord/discord.module.ts`

### D3: Embed 포맷 — 코드블록 본문 + 메타정보 한줄 압축
- **Context**: Discord Embed fields 방식은 가독성이 떨어짐. 테이블 형태는 Discord에서 미지원.
- **Choice**: description에 코드블록(내용 본문) + 볼드/인라인코드(메타정보) 조합. 이모지 제거.
- **Alternatives**: (A) fields 나열 — 가시성 부족, (B) 코드블록 테이블 — 링크/색상 불가, (C) 이미지 트릭 — 외부 의존성
- **Code Paths**: `services/identity/src/discord/discord-webhook.service.ts`

### D4: 잔존 Discord 스텁 정리
- **Context**: ci.yml notify job과 alertmanager.yaml에 미완성 Discord webhook 스텁이 존재.
- **Choice**: CI Discord step 제거 (Grafana annotation 유지), alertmanager receiver를 null로 전환.
- **Alternatives**: 기존 스텁 활용 — 구조가 다르고 미완성이라 기각.
- **Code Paths**: `.github/workflows/ci.yml`, `infra/k3s/monitoring/alertmanager.yaml`

## Patterns
### P1: fire-and-forget 외부 서비스 호출
- **Where**: `services/identity/src/discord/discord-webhook.service.ts`, `services/identity/src/feedback/feedback.service.ts`
- **When to Reuse**: 외부 서비스(webhook, 알림 등) 호출 시 메인 비즈니스 로직 실패에 영향을 주지 않아야 할 때. `.catch()`로 에러 로그만 남기고 예외를 전파하지 않는 패턴.

### P2: 환경변수 미설정 시 silent skip + 경고 1회
- **Where**: `services/identity/src/discord/discord-webhook.service.ts`
- **When to Reuse**: 선택적 외부 연동 서비스에서 환경변수 미설정 시 서비스 기동을 막지 않고 조용히 건너뛰어야 할 때. `warnedMissingUrl` 플래그로 로그 스팸 방지.

## Gotchas
### G1: CI branches 커버리지 98% 기준 미달
- **Symptom**: 첫 push 후 Identity 테스트 branches 97.91%로 CI 실패.
- **Root Cause**: `err instanceof Error ? ... : String(err)` 분기의 non-Error throw 케이스 미커버.
- **Fix**: 문자열 throw 테스트 케이스 추가하여 98.43%로 보충 (`e29832e`).

## Metrics
- Commits: 2건, Files changed: 10개
