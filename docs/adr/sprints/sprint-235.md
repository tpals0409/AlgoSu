---
sprint: 235
title: "모니터링 알림 시스템 갭 보강 (CB/DLQ alert 커버리지 + 알림 채널 분리 + 온콜 런북)"
date: "2026-06-09"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-231", "sprint-232", "sprint-234"]
related_memory: ["sprint-window"]
topics: ["monitoring", "infra", "alerting"]
tldr: "모니터링 시스템 전수 조사 + 알림 시스템 점검 결과 발견한 4개 갭을 보강. (1) CircuitBreakerOpen alert가 ai-analysis만 감시 → submission/github-worker 통합(3종 CB 메트릭 모두 실존, rule만 확장). (2) DLQReceived alert가 미발행 placeholder algosu_submission_dlq_messages_total 참조 → submission은 saga orchestrator라 DLQ 카운터 미발행이 사실로 확정, 실 발행 워커 메트릭 algosu_(github_worker|ai_analysis)_dlq_messages_total로 교체. (3) 운영 알림이 identity-discord-secret(feedback 전용 webhook) 재사용으로 같은 Discord 채널 혼재 → alertmanager-discord-secret(2키 webhook-url/webhook-url-critical)로 critical/일반 2채널 분리, 미러는 목표 상태로 선반영(실 봉인·적용은 서버 aether-gitops). (4) 온콜 대응 런북 부재 → oncall-alerts.md(13 alert별 진단 쿼리·대응) + alert-channel-separation.md(채널 분리 라이브 적용 절차) 신규. infra/k3s/monitoring은 비배포 참조 미러 — 라이브 적용분은 런북+이월. 게이트 check-grafana-metrics 전 차원 [OK], check-doc-refs 437 files no broken refs."
---
# Sprint 235 — 모니터링 알림 시스템 갭 보강 (CB/DLQ alert 커버리지 + 알림 채널 분리 + 온콜 런북)

## 목표

- 모니터링 시스템 전반 조사 + 알림 시스템(rule → route → receiver 전송 경로) 점검.
- 점검에서 발견한 갭을 사용자 확인 후 항목별 보강. 라이브 적용 필요분은 런북 + 이월.

## 배경

- `/start` 인자 "모니터링 시스템 조사하고, 모니터링 알림 시스템 점검하자. 조사가 끝나면 하나하나 나에게 물어봐"로 시작. 3 Explore 병렬 조사(인프라 매니페스트 / 서비스 계측·로깅 / 검증·문서).
- `infra/k3s/monitoring`은 **비배포 참조 미러**, 배포 SSOT는 aether-gitops(Sprint 232 확정). 정적 미러로 런타임 결함 단정 금지([[feedback-source-vs-live-drift]]). 라이브 클러스터 접근은 이 환경에서 불가 → 정적 작업(미러/rule/문서) + 라이브 적용 이월.
- 조사 결과를 항목별로 사용자에게 확인 → 4개 보강 항목 + 채널 분리 입도(critical/일반 2채널) 확정.

## 점검에서 발견한 갭 (사실검증)

1. **CB alert 부분 커버리지**: `CircuitBreakerOpen`(`prometheus-rules.yaml:126`)이 `algosu_ai_analysis_circuit_breaker_state`만 감시. submission·github-worker도 `circuit_breaker_state` 메트릭(값 2=OPEN) 실 발행하나 alert 부재 → Saga/GitHub 동기화 차단 시 무알림.
2. **DLQ alert가 미발행 placeholder 참조**: `DLQReceived`(`:157`)가 `algosu_submission_dlq_messages_total > 0`을 참조하나 **이 메트릭은 어디에서도 발행되지 않는다**(submission 소스 grep 0건). submission은 saga **orchestrator**라 DLQ 카운터를 발행하지 않고, DLQ는 **소비자 워커**(github-worker, ai-analysis)에서 발생(`algosu_github_worker_dlq_messages_total`, `algosu_ai_analysis_dlq_messages_total` 실존). §7 주석 "Placeholder"가 이를 방증. → monitoring-system-audit.md §4-D3 "DLQ alert placeholder" 갭의 정체 확정.
3. **단일 Discord webhook 공유**: 운영 알림이 Identity **feedback 전용** webhook(`identity-discord-secret`)을 재사용(`alertmanager.yaml:145`) → 운영 알림과 사용자 피드백이 같은 채널에 혼재. discord-default/discord-critical도 같은 webhook 사용.
4. **온콜 런북 부재**: 알림 수신 후 진단·대응 절차 문서 없음(monitoring-system-audit.md §4-D4).

## 핵심 결정

1. **CB alert 3서비스 통합**: 메트릭 3종 모두 실존 확인 → expr을 `{__name__=~"algosu_(ai_analysis|submission|github_worker)_circuit_breaker_state", name=~".+"} == 2`로 확장. summary/description에 `{{ $labels.job }}`·`{{ $labels.name }}`로 서비스/브레이커 식별. Sprint 141 schema(OPEN=2)·`{name=~".+"}` legacy 차단 보존.
2. **DLQ alert placeholder 교체(확장 아님)**: 사용자 요청은 "submission + 2워커 통합"이었으나 submission DLQ 메트릭이 미발행임을 사실검증으로 확정 → 정직한 수정은 미발행 placeholder를 실 발행 2워커 메트릭으로 교체. expr `{__name__=~"algosu_(github_worker|ai_analysis)_dlq_messages_total"} > 0`. submission 미포함이 아키텍처상 정확(orchestrator는 DLQ 미발행).
3. **알림 채널 critical/일반 2채널 분리**: `alertmanager-discord-secret`(2키: `webhook-url`=일반, `webhook-url-critical`=critical) 신규. discord-default→webhook-url, discord-critical→webhook-url-critical. **미러는 라이브보다 앞선 "목표 상태"로 선반영**(secret 볼륨 secretName 교체 + 배너 명시) — 실 Discord 채널 생성·webhook seal·aether-gitops 적용은 `alert-channel-separation.md` 따라 서버측. Sprint 232 ERRATA로 제거됐던 alertmanager webhook 키를 **'채널 분리'라는 정당한 목적으로 재도입**(ADR에 사유 명기해 재오판 차단).
4. **온콜 런북 2종 신규**: `oncall-alerts.md`(13 alert별 의미·PromQL/LogQL 진단·1차 대응 + 전송 경로 점검 §3) + `alert-channel-separation.md`(채널 분리 라이브 적용 + 발화→Discord 도달 end-to-end 검증). 라이브 전송 검증 절차를 후자에 흡수.

## 작업 요약 (start `ca2b0bd`, 4 commit)

- `04e504a`: `feat(infra)` prometheus-rules.yaml — CircuitBreakerOpen 3서비스 통합 + DLQReceived placeholder→2워커 실 메트릭 교체.
- `1f160c3`: `feat(infra)` alertmanager.yaml(discord-critical webhook-url-critical·secret 볼륨 alertmanager-discord-secret 2키·목표 상태 배너) + sealed-secrets-template.yaml(alertmanager-discord-secret 2키 추가).
- `a700cbb`: `docs(runbook)` oncall-alerts.md + alert-channel-separation.md 신규 + README 2종 '관측성/모니터링' 카테고리(19→21).
- ADR commit(본 문서) + README 172→173.

## 검증

- **게이트 `check-grafana-metrics.mjs` 전 차원 [OK]**: defined metrics 204, rule expr 라벨 쌍 15(external skip 5) — CB `name` 라벨·DLQ 메트릭 정합 통과. `__name__=~` 패턴은 기존 recording rule(line 35,45)이 통과하던 방식과 동일.
- YAML 유효: prometheus-rules.yaml inner(10 groups·15 rules 파싱), alertmanager.yaml 3-doc(receiver webhook_url_file ↔ secret 볼륨 items ↔ sealed key 정합), sealed-secrets-template.yaml.
- `check-doc-refs.mjs`: 437 files no broken refs(regression fixtures 8/8).
- `check-prometheus-rules.mjs`(promtool)는 로컬 미설치 — CI install step에서 실행. 로컬은 YAML+PromQL-shape 파싱으로 보강.
- **Critic**(Codex gpt-5.5, `--base ca2b0bd`): <!-- CRITIC_RESULT -->

## 교훈

1. **rule 존재 ≠ 전송, 그리고 rule 참조 ≠ 메트릭 발행** — DLQReceived는 발화해도 무의미했다(참조 메트릭 미발행). alert가 가리키는 메트릭이 실제 발행되는지 코드로 검증해야 한다(Sprint 231 "rule 존재 ≠ 전송"의 확장).
2. **placeholder alert는 거짓 안전감을 준다** — `algosu_submission_dlq_messages_total`은 §7 "Placeholder" 주석이 있었으나 expr은 살아 있어, 대시보드/리뷰에서 "DLQ 감시 중"으로 오인될 여지. 미발행 메트릭은 실 발행 메트릭으로 교체하거나 제거해야 한다.
3. **사용자 요청도 코드 사실로 교정한다** — "submission + 2워커 통합" 요청을 submission DLQ 미발행이라는 사실로 "2워커 교체"로 정직하게 좁혔다. 아키텍처(orchestrator는 DLQ 미발행)에 맞는 형태가 옳다.
4. **알림 채널 분리는 webhook 격리 = 시그널/노이즈 분리** — critical을 feedback·warning과 같은 채널에 두면 놓친다. severity별 채널(webhook) 분리로 critical 가시성 확보.
5. **미러 선반영(목표 상태)은 드리프트를 만든다 — 배너+ADR 사유로 재오판 차단** — 라이브 선수정이 불가한 서버 작업일 때, 미러를 목표 상태로 선반영하면 라이브보다 앞선 드리프트가 생긴다. Sprint 231 오판(미러를 배포본으로 오독)의 역방향 리스크 → "목표 상태" 배너 + ADR에 의도 명기 + 적용 런북으로 관리.

신규패턴: **점검 기반 alert 정합 패턴**(alert가 참조하는 메트릭의 실 발행 여부를 코드로 검증 → 미발행 placeholder 교체/제거, 커버리지 갭은 실존 메트릭으로 통합) + **미러 선반영(목표 상태) + 적용 런북 패턴**(라이브 선수정 불가 서버 작업 시 미러를 목표 상태로 두고 배너+런북으로 적용 경로 고정).

## 이월

- **(서버) 채널 분리 라이브 적용** — `alert-channel-separation.md` 따라 Discord 채널 2개 생성 → webhook 2개 → `alertmanager-discord-secret` seal → aether-gitops 적용 → 발화→Discord 도달 end-to-end 검증. 적용 후 미러 "목표 상태" 배너 드리프트 해소 표기.
- **(서버) alertmanager 미러 정합** — aether-gitops alertmanager.yaml도 alertmanager-discord-secret 2채널로 정합(현재 미러만 선반영).
- (기존 이월) loki Deployment 하드닝 역추가(갭 확정) · ADR-028 SA 적용·토큰 발급 · Sprint 230 롤아웃 확인 · 라이브 /quiz 검증 · SP217 컷오버 · GA4 · problem_db · 하네스 cron.
