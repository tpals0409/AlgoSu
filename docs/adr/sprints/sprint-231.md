---
sprint: 231
title: "모니터링 시스템 전수 조사 + 로그 수집 진단 + Alertmanager Discord receiver 실배선"
date: "2026-06-08"
status: completed
agents: [Oracle, Explore, Librarian, Postman, Critic]
related_adrs: ["sprint-148", "sprint-191"]
related_memory: ["sprint-window"]
topics: ["observability", "monitoring", "logging", "alerting", "infra"]
tldr: "AlgoSu 관측성 스택(메트릭 8 scrape job·알림 17규칙+recording 2·Grafana 4대시보드·Loki+Promtail 로깅·8차원 검증 CI)을 전수 조사하고, 사용자 관심사인 'service/error 로그 미수집'을 파이프라인 정밀 추적으로 진단. 결론: 로깅 파이프라인은 정적 구성상 올바르게 배선됨(Promtail CRI+JSON→loki:3100, NetworkPolicy loki-ingress 허용·default-deny는 Ingress 전용이라 egress 무제한, Grafana loki uid 정합, level 값 전 서비스 소문자 정합) → 미수집이 사실이면 런타임 원인이며 라이브 진단(운영측) 필요. 진짜 결함은 알림 전송 경로: alertmanager receiver='null'로 17규칙이 전부 드롭되고 있었고, 주석의 'Identity webhook 전환'은 거짓(Identity discord는 feedback 전용). 사용자 확정에 따라 Alertmanager Discord receiver(discord_configs.webhook_url_file) 실배선 + monitoring-secrets에 ALERTMANAGER_DISCORD_WEBHOOK placeholder 추가(실 seal은 운영측). Grafana Error Logs Only 쿼리의 죽은 분기(level=~error|fatal|CRITICAL — 어떤 서비스도 fatal/CRITICAL 미출력)+취약 라인필터를 level 라벨 직접 필터로 정정. 추정 갭 사실검증: github-worker-metrics Service 실존(scrape 유효), Identity discord=feedback, .bak은 git 미추적. 산출물: docs/runbook/monitoring-system-audit.md(인벤토리+커버리지 매트릭스+라이브 진단 절차+갭/디버그/시드). 검증: check-grafana-metrics.mjs 통과."
---
# Sprint 231 — 모니터링 시스템 전수 조사 + 로그 수집 진단 + Alertmanager Discord receiver 실배선

## 정정 (ERRATA, Sprint 232)

> 본 ADR의 **"알림 — 전송 경로 0 (진짜 결함)"** 결론과 이를 전제한 "Discord receiver 실배선" 작업은 **오류**다. 서버 라이브 진단으로 정정한다(본문은 역사 기록으로 보존, 아래 사실이 우선).
>
> - **근본 오해**: AlgoSu `infra/k3s/`는 **배포되지 않는 참조 미러**이고 실제 배포 SSOT는 **aether-gitops**(`algosu/base/monitoring/` + `overlays/prod`)다. AlgoSu CI는 aether-gitops에 이미지 태그만 bump하고 매니페스트는 전파하지 않는다. Sprint 231은 비배포 미러의 구버전(`receiver: 'null'`)을 배포본으로 오독했다.
> - **알림은 라이브에서 정상**이었다 — Sprint 130 B-1로 alertmanager-native `discord-default`+`discord-critical`(severity 라우팅, `identity-discord-secret/webhook-url`, v0.28.1) 동작 중. "17규칙 전부 드롭/6일 무알림"은 사실이 아니다.
> - Sprint 231이 미러에 넣은 `monitoring-secrets/discord_webhook` + v0.27.0 + `webhook_url_file`은 **v0.27.0이 file-webhook 미지원이라 작동불가** 설정이었다 → Sprint 232에서 미러를 라이브로 정합, `ALERTMANAGER_DISCORD_WEBHOOK` placeholder 제거.
> - **실제 "로그 미수집" 원인은 Loki OOM**(512Mi 한도, 5일 주기 spike) — aether-gitops PR #7로 512Mi→1Gi 상향·검증 완료. 본 ADR의 "로깅 파이프라인 정적 정상" 진단 자체는 유효(파이프라인은 정상, 원인은 Loki 리소스).
> - 교훈 갱신: **정적 매니페스트(특히 비배포 미러)로 런타임 결함을 단정하지 말 것** — [[feedback-source-vs-live-drift]]. 상세: `docs/runbook/monitoring-system-audit.md` §0/§4.

## 목표

- AlgoSu 전체 모니터링 스택(메트릭·알림·대시보드·로깅·검증 CI·컨벤션)을 **전수 조사**하여 현황·커버리지·갭을 사실 기반(파일:라인)으로 영속 문서화한다.
- 사용자 관심사인 **"service log / error 로그가 수집이 안 되는 것 같다"**를 로깅 파이프라인 정밀 추적으로 진단한다.
- 에이전트가 '추정'으로 남긴 갭(alertmanager 라우팅·github-worker 연결성·시크릿)을 코드/매니페스트로 **사실 검증**한다.
- 조사에서 확정된 저위험 결함을 in-repo로 수정한다.

## 배경

- `/start` 인자 "우리 모니터링 시스템 전수 조사해"로 시작. 3개 Explore 에이전트 병렬 조사(인프라 매니페스트 / 서비스 계측 / 검증·문서) 후, 사용자가 **"service/error 로그 수집이 안 되는 것 같으니 확인"**으로 초점을 좁힘 + "추정 갭까지 사실 검증" 지시.
- 조사 기준 커밋 `2e7e350`(Sprint 230 머지).

## 근본 원인 / 진단 (코드·매니페스트로 확정)

### 로깅 파이프라인 — 정적 구성은 정상
1. **Promtail**(`promtail.yaml:59-71`): `/var/log/pods` 읽기 → `cri:{}` → `json:{level,traceId,tag}` → `labels:{level,tag}` 승격. `algosu` namespace keep, `namespace`/`pod`/`app`/`container` 라벨.
2. **NetworkPolicy**: `default-deny-network-policy.yaml:16-17`은 `policyTypes:[Ingress]` **전용**(egress 무제한) → Promtail의 loki push egress 차단 안 됨. `service-network-policies.yaml:542-574` `loki-ingress`가 Promtail→loki:3100 명시 허용. **차단 아님.**
3. **Grafana 데이터소스**: Loki uid `loki` ↔ 대시보드 패널 uid 정합(`grafana-service-dashboard.yaml:693,716`).
4. **`level` 값 정합**: NestJS 로거 `'error'`(소문자), Python `LEVEL_MAP`이 CRITICAL→`"error"` 통일(`ai-analysis/src/logger.py:97-103`). 전 서비스 소문자 정합.
→ **로그 미수집이 사실이라면 정적 구성 버그가 아니라 런타임 원인**(Promtail 크래시·Loki PVC/OOM·pod 라벨·시간 범위)이며, 확인은 OCI 라이브 진단(운영측, 런북 §3)이 필요하다.

### 알림 — 전송 경로 0 (진짜 결함)
- `alertmanager.yaml:22` `route.receiver: 'null'` → 17개 규칙(ServiceDown·OOMKilled·CircuitBreakerOpen·AuthFailure 등 critical 포함)이 발화돼도 **전송 경로 없음**.
- 주석(`alertmanager.yaml:4-5,25`)의 "Discord 알림은 Identity 서비스 webhook으로 전환됨"은 **거짓**: Identity `DiscordWebhookService`는 `feedback.service.ts:58`의 `sendFeedbackNotification`만 호출하는 **사용자 피드백 전용**, Prometheus/Alertmanager alert 수신 컨트롤러 부재.

### 추정 갭 사실검증
- github-worker-metrics Service **실존**(`infra/k3s/github-worker.yaml:81`, 9100) → scrape 타겟 유효. 추정 'critical gap' 거짓.
- Identity discord = feedback 전용(알림 무관).
- 모니터링 SealedSecret = `GRAFANA_ADMIN_PASSWORD` 1개뿐.
- `.bak` 2개는 git **미추적**(체크인 아님) — 로컬 정리만.

## 핵심 결정

1. **로그 미수집 = 런타임 진단 대상**: 정적 구성이 정상이므로 "수정"이 아니라 **라이브 진단 절차(런북 §3)**를 산출물로 고정(에이전트 환경 kubectl은 미가동 클러스터라 자율 실행 불가).
2. **알림 receiver 실배선까지**(사용자 확정): Alertmanager v0.27.0 native `discord_configs.webhook_url_file`로 secret 파일 참조(평문 미포함), `route.receiver` null→discord. 실 webhook URL seal은 운영측(kubeseal).
3. **로그 쿼리 정정**: Error Logs Only의 죽은 분기+취약 라인필터 제거 → `level` 라벨 직접 필터(인덱스 효율·명확).
4. **거짓 추정은 런북에 디버그로 명시**(C1~C4) — 향후 동일 오판 방지.

## 작업 요약 (start `2e7e350`)

- `351e61d` **fix(infra)**: alertmanager Discord receiver 실배선(discord_configs.webhook_url_file + route null→discord + Deployment secret 볼륨 마운트 + 거짓 주석 교정) / sealed-secrets-template `ALERTMANAGER_DISCORD_WEBHOOK` placeholder / grafana-service-dashboard Error Logs Only 쿼리 `level` 라벨 직접 필터로 정정.
- (docs) `docs/runbook/monitoring-system-audit.md` 신규(§0 요약·§1 인벤토리·§2 커버리지 매트릭스·§3 라이브 진단·§4 갭/디버그/시드) + ADR sprint-231 KR+EN + README 인덱스 168→169.

## 검증

- `node scripts/check-grafana-metrics.mjs` **통과**(exit 0, 8차원 cross-check: defined 204·strict 32·wildcard 15·label 124·panel-title 41·variable 0 unused·rule-label 15·datasource pass·empty 0·dup-id 0).
- alertmanager.yaml YAML 유효(3 docs, embedded alertmanager.yml 파싱 성공, volumes/mounts 정합).
- ADR 게이트 4종(index 169·adr-en·links·doc-refs) + CI `quality-monitoring`(BLOCKING) green.
- 실 DB/클러스터 라이브 검증은 환경 제약(kubectl 로컬 미가동)으로 불가 → 머지 후 운영측 §3 절차 수행.

## 교훈

1. **정적 구성 정상 ≠ 런타임 정상** — 로깅 파이프라인이 코드/매니페스트상 올바르게 배선돼 있어도 미수집 증상은 런타임 원인일 수 있다. 자율 실행 불가한 라이브 검증은 "실행"이 아니라 **단계별로 어디가 비는지 좁히는 진단 절차(런북)**가 올바른 산출물.
2. **`null` receiver는 알림을 조용히 삼킨다** — 규칙이 17개 있어도 receiver가 null이면 전송 0. "규칙 존재 ≠ 전송 동작". 알림 시스템은 발화→전송 경로 끝까지 검증해야 한다.
3. **주석은 코드로 검증** — "Identity webhook으로 전환됨" 주석이 실제로는 feedback 전용 서비스를 가리켜 알림 경로 부재를 가렸다. 인프라 주석도 호출 그래프로 사실 확인.
4. **에이전트 조사 '추정'은 반증 가능** — github-worker-metrics Service 부재 추정/체크인 .bak 추정 모두 코드로 거짓 확인. 추정은 사실검증 전까지 결함으로 단정 금지, 검증 결과를 디버그로 남겨 재오판 차단.
5. **Loki `level` 라벨 직접 필터 > `| json` 재파싱** — Promtail이 승격한 `level` 라벨은 인덱스되어 `{... level="error"}`가 효율적·명확. `| json` 재파싱은 라벨 충돌(`level_extracted`)로 취약. 쿼리의 죽은 정규식 분기(미출력 레벨)는 오해를 부른다.

신규패턴: **운영 검증 진단 런북 패턴**(자율 실행 불가한 라이브 검증은 단계별 좁히기 진단 절차로 산출) + **알림 전송 경로 end-to-end 검증**(rule 존재가 아니라 receiver 실배선까지).

## 이월

- **(운영측) B3 Discord webhook seal + 롤아웃**: 런북 §4-B3 절차로 `ALERTMANAGER_DISCORD_WEBHOOK` seal 후 ArgoCD sync → 발화 시 Discord 전송 확인.
- **(운영측) 라이브 로그 진단**: 런북 §3으로 OCI에서 실제 수집 여부 확인.
- (기존 이월 유지) Sprint 230 problem-service 롤아웃 확인·라이브 /quiz 검증·SP217 컷오버·GA4·problem_db 마이그레이션·하네스 cron.
- (후속 시드) D2 check-prom-default-metrics CI 통합 / D3 DLQ·Python CB 메트릭 보강 / D4 OTel 분산 트레이싱·온콜 런북 확장.
