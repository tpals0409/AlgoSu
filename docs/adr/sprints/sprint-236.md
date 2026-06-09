---
sprint: 236
title: "운영 알림 채널 critical/일반 분리 라이브 적용 (alertmanager-discord-secret)"
date: "2026-06-09"
status: completed
agents: [Oracle]
related_adrs: ["sprint-235", "sprint-232", "sprint-231", "ADR-029"]
related_memory: ["sprint-window"]
topics: ["monitoring", "infra", "alerting", "observability"]
tldr: "Sprint 235가 미러에 '목표 상태'로 선반영한 운영 알림 채널 분리를 서버측 aether-gitops에 라이브 적용. 기존엔 alertmanager가 identity-discord-secret(feedback 전용 webhook)을 재사용해 사용자 피드백·운영 warning·critical이 한 채널에 혼재 → 신규 alertmanager-discord-secret(2키: webhook-url=일반, webhook-url-critical=critical)으로 분리. optional:false 마운트 실패 방지를 위해 2-커밋 분리 적용(SealedSecret 선행 → secret 실재 게이트 → alertmanager 매니페스트 교체). end-to-end 검증: 2키 마운트·config 정합·critical/warning 발화 전송(notifications_total 0→2→4, failed 0)·resolve 도달·feedback 격리 모두 통과, PM 육안으로 실 Discord 양 채널 도착 확인. identity-discord-secret은 feedback 전용으로 유지(삭제 금지)."
---
# Sprint 236 — 운영 알림 채널 critical/일반 분리 라이브 적용

## 목표

- Sprint 235가 미러(`sealed-secrets-template.yaml` + 당시 `infra/k3s/monitoring/alertmanager.yaml`)에 **"목표 상태"로 선반영**해 둔 운영 알림 채널 분리를, 서버 환경에서 실 Discord webhook 봉인 + aether-gitops 라이브 적용 + end-to-end 검증으로 **드리프트 해소**.

## 배경

- Sprint 235 §이월: "(서버) 채널 분리 라이브 적용" + "(서버) alertmanager 미러 정합" 2건이 라이브 클러스터 접근 가능한 서버 환경 작업으로 이월됨.
- 기존 상태: alertmanager가 `identity-discord-secret`(Identity **feedback 전용** webhook, key `webhook-url`)을 재사용 → 사용자 피드백 + 운영 warning + 운영 critical이 **"피드백 봇" 한 채널에 혼재**(Sprint 130 B-1 향후 과제). 조사 결과 클러스터에 discord webhook은 이 1개뿐, identity-service(`DISCORD_FEEDBACK_WEBHOOK_URL`)와 alertmanager(discord-default/discord-critical 양쪽)가 공유 중이었다.
- 배포 SSOT는 aether-gitops(`algosu/base/monitoring/alertmanager.yaml`). AlgoSu `infra/k3s/` 미러는 **ADR-029로 폐기** → alertmanager.yaml 미러는 이미 삭제됨(런북의 `infra/k3s/monitoring/...` 참조는 aether-gitops 동일 경로로 대체 독해). 남은 미러는 `infra/sealed-secrets/sealed-secrets-template.yaml`(키 목록 참조용 템플릿)뿐.

## 핵심 결정

1. **신규 webhook은 순수 신규 자산**: 기존 "피드백 봇" webhook은 §6 규칙상 feedback 전용으로 유지(삭제 금지). 운영 알림용 채널 2개(`#algosu-alerts`, `#algosu-alerts-critical`) + webhook 2개("운영 알림 봇", "긴급 알림 봇")를 새로 생성. 봉인 전 채널 격리 게이트로 일반·critical·feedback 3채널 channel_id 상호 상이 검증.
2. **2-커밋 분리 적용 (순서 역전 차단)**: alertmanager의 secret 볼륨은 `optional: false` → secret 부재 시 pod 마운트 실패로 다운. 따라서 **SealedSecret을 먼저 add → sync → `kubectl get secret`으로 실재 확인(게이트) → 그 다음에만 alertmanager 매니페스트(secretName/items/webhook_url_file) 교체**. 두 변경을 한 커밋에 묶지 않음.
3. **routing은 불변**: aether-gitops alertmanager는 이미 `severity=critical → discord-critical`, 그 외 → `discord-default` 라우팅을 보유. 실질 변경점은 (a) 볼륨 secretName `identity-discord-secret`→`alertmanager-discord-secret`, (b) items 2키, (c) `discord-critical.webhook_url_file`을 `webhook-url`→`webhook-url-critical`로 교체. discord-default는 `webhook-url` 유지.

## 작업 요약 (aether-gitops, 2 commit)

- `9f7680b`: `feat(monitoring)` 알림 채널 분리 1/2 — `sealed-alertmanager-discord-secret.yaml`(kubeseal 2키 봉인) 추가 + `kustomization.yaml` resources 등록. **이 커밋만 단독으로 sync → secret 실재 확인 후 다음 커밋 진행**.
- `842b93d`: `feat(monitoring)` 알림 채널 분리 2/2 — `alertmanager.yaml`을 전용 secret으로 전환(secretName `alertmanager-discord-secret`, items `webhook-url`/`webhook-url-critical`, discord-critical webhook_url_file 교체) + 주석 갱신.

(AlgoSu repo: 본 ADR + 미러 배너 드리프트 해소(`sealed-secrets-template.yaml`) + 런북 §0/§6 드리프트 마커 갱신.)

## §5 end-to-end 검증 결과

| # | 항목 | 결과 |
|---|------|------|
| 5.1 | secret 2키 마운트 | ✅ `alertmanager-74668dd49c-zf2dl`에 `webhook-url`, `webhook-url-critical` 마운트 (`ls /etc/alertmanager/secrets/`) |
| 5.2 | receivers/webhook_url_file 정합 | ✅ discord-default→`webhook-url`, discord-critical→`webhook-url-critical`, 라우팅 severity=critical→critical. config loaded, cluster ready (`/api/v2/status`) |
| 5.3 | critical/warning 발화 전송 | ✅ `alertmanager_notifications_total{discord}` 0→2, `failed_total` 전부 0 |
| 5.5 | resolve `[RESOLVED]` 전송 | ✅ 해소 후 total 2→4, failed 0, active 0 (group_interval ~162s 후 도달) |
| 5.6 | feedback 채널 격리 | ✅ identity-discord-secret 유지·미삭제, identity-service 여전히 참조, 라이브 alertmanager는 alertmanager-discord-secret 마운트 → secret·채널 분리 |
| 5.4 | 실 Discord 양 채널 도착(교차 도달 없음) | ✅ **PM 육안 확인** — critical/warning firing + resolved 메시지가 각 채널에 정확히 도착, 교차·feedback 혼입 없음 |
| — | ArgoCD / pod | ✅ Synced/Healthy(rev 842b93d), pod Running 1/1 restarts 0 |

> 검증 도구: `amtool` 미설치 → Alertmanager API(`/api/v2/alerts` POST, `/metrics`, `/api/v2/status`)로 대체. `notifications_total`/`failed_total` 메트릭 증분으로 전송 성공을 결정적으로 입증.

## 교훈

1. **optional:false secret 볼륨은 SealedSecret-우선 2커밋이 정석** — secret과 이를 참조하는 워크로드 변경을 한 커밋에 묶으면 sync 타이밍에 따라 마운트 실패 윈도우가 생긴다. "추가 → 검증(실재 게이트) → 전환" 순서를 커밋 경계로 강제.
2. **rule/config 존재 ≠ 전송 도달** — Sprint 231 교훈 재확인. notifications_total 증분 + failed=0 메트릭으로 서버측 전송을 입증하되, 채널 교차 도달은 메트릭으로 구분 불가 → 실 채널 육안 확인까지가 검증 종결.
3. **webhook URL 시크릿 위생** — 평문 webhook URL은 tmux 디스패치 프롬프트/ps/로그 노출 위험(`_base.md` 보안가드)이라 seal 단계는 디스패치 부적합. 채널 격리 검증 + 봉인을 단일 in-session 작업으로 원샷 처리해 평문 잔류를 최소화. (대화 트랜스크립트 잔류분은 필요 시 webhook regenerate로 무효화 가능.)

## 이월 / 후속

- (선택) webhook regenerate — 트랜스크립트 평문 잔류가 민감할 경우 Discord에서 2개 webhook 재발급 후 재봉인(절차 동일).
- ~~(서버) 채널 분리 라이브 적용~~ ✅ 본 스프린트 완료.
- ~~(서버) alertmanager 미러 정합~~ ✅ ADR-029 SSOT 일원화로 alertmanager.yaml 미러는 폐기, aether-gitops 단일 정합.
