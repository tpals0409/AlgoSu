<!--
@file docs/runbook/monitoring-system-audit.md
@domain observability
@layer runbook
@related infra/k3s/monitoring/, docs/conventions/monitoring-logging.md, docs/adr/sprints/sprint-231.md
-->

# 모니터링 시스템 전수 조사 + 운영 진단 런북 (Sprint 231)

> AlgoSu 관측성(observability) 스택의 **사실 기반 인벤토리**, **서비스×차원 커버리지 매트릭스**, **로그 수집 라이브 진단 절차**, **확정 갭/거짓 추정 디버그/후속 시드**를 한 곳에 고정한 SSOT.
> 모든 항목은 조사 시점 코드/매니페스트의 `파일:라인` 출처를 명시한다(추측은 "추정:"으로 구분).
> 조사 기준 커밋: `2e7e350` (Sprint 230 머지). 수정 반영: Sprint 231.

---

## §0 요약 (TL;DR)

> **🔧 정정 (Sprint 232)**: 본 문서의 초판(Sprint 231)은 **`infra/k3s/`를 배포본으로 오독**했다. 실제 배포 SSOT는 **aether-gitops**(`algosu/base/monitoring/` + `overlays/prod`)이고 `infra/k3s/`는 **배포되지 않는 참조 미러**다(AlgoSu CI는 aether-gitops에 이미지 태그만 bump). 그 결과 ①"알림 전송 경로 0(receiver:null)" 결론은 **오류** — 라이브는 Sprint 130 B-1로 정상 동작 중이었다. ②실제 로그 미수집 원인은 **Loki OOM**(서버 진단으로 확인, aether-gitops PR #7로 512Mi→1Gi 해소)이었다. 아래 본문은 정정 반영본. 교훈: 정적 매니페스트로 런타임 결함을 단정하지 말 것.

- **로깅 파이프라인은 정적 구성상 올바르게 배선돼 있다.** Promtail(CRI+JSON 파싱, `level`/`tag` 라벨 승격) → `loki:3100`(NetworkPolicy `loki-ingress` 허용, `default-deny`는 Ingress 전용이라 Promtail egress 무제한) → Grafana Loki 데이터소스(uid `loki` 정합). `level` 값은 전 서비스 **소문자 정합**. → 실제 "로그 미수집"의 원인은 파이프라인이 아니라 **Loki OOM**(512Mi 한도에서 5일 주기 spike 초과)이었고, **aether-gitops PR #7로 limit 512Mi→1Gi 상향**해 해소됨(서버 검증: loki Running·OOM 재발 없음). §4-C 참조.
- **알림은 라이브에서 정상 동작 중이다.** 배포 SSOT(aether-gitops)의 alertmanager는 Sprint 130 B-1로 **alertmanager-native discord_configs**(`discord-default` + `discord-critical`, severity 라우팅, `identity-discord-secret/webhook-url`, v0.28.1)를 사용한다. Sprint 231이 본 `infra/k3s/`의 `receiver: 'null'`은 **비배포 미러의 구버전 스냅샷**이었다 — 실 결함 아님. (Sprint 232에서 미러를 라이브에 정합)
- **거짓 추정 디버그**: github-worker-metrics Service 실존(scrape 타겟 유효), Identity discord는 feedback 알림 + alertmanager가 **동일 secret(identity-discord-secret) 공유** — §4-C.

---

## §1 전 스택 인벤토리

### 1.1 메트릭 (Prometheus)

`infra/k3s/monitoring/prometheus-config.yaml` — 글로벌 scrape/평가 간격 30s, Alertmanager `alertmanager:9093` 연동, rule_files `/etc/prometheus/rules/*.yml`, TSDB 보존 7d(staging 14d / prod 30d, overlay patch).

| Job | 타겟 | 출처 |
|-----|------|------|
| gateway | `gateway:3000/metrics` | `prometheus-config.yaml:25-28` |
| identity-service | `identity-service:3004/metrics` | `:30-33` |
| submission-service | `submission-service:3003/metrics` | `:35-38` |
| problem-service | `problem-service:3002/metrics` | `:40-43` |
| ai-analysis | `ai-analysis-service:8000/metrics` | `:45-48` |
| github-worker | `github-worker-metrics:9100/metrics` | `:51-54` |
| kube-state-metrics | `kube-state-metrics:8080/metrics` | `:56-59` |
| rabbitmq | `rabbitmq:15692/metrics` | `:61-64` |

서비스 계측 SSOT: NestJS 4종 `services/{gateway,identity,submission,problem}/src/common/metrics/metrics.service.ts`(prom-client, `algosu_{service}_*`), github-worker `services/github-worker/src/metrics.ts`(독립 HTTP 9100), ai-analysis `services/ai-analysis/src/metrics.py`(prometheus_client). 경로 정규화(UUID/숫자→`:id`)로 고카디널리티 방지.

### 1.2 알림 (Prometheus Rules)

`infra/k3s/monitoring/prometheus-rules.yaml` — 알림 17개 + recording rule 2개(`algosu:http_error_rate:5m`, `algosu:memory_usage_pct`). 그룹: availability(ServiceDown), error_rate(High/Critical), latency(P95), security(AuthFailure/InternalKeyViolation), circuit_breaker(OPEN=2), resources(Memory), messaging(DLQ placeholder), rabbitmq(Unacked), kubernetes(PodRestart/CPU/OOMKilled).

전송(**배포 SSOT = aether-gitops**, `infra/k3s/monitoring/alertmanager.yaml`는 비배포 미러): Sprint 130 B-1로 alertmanager-native `discord_configs` — `discord-default`(기본) + `discord-critical`(severity=critical, repeat 30m), `webhook_url_file`로 `identity-discord-secret/webhook-url` 참조, image v0.28.1. §4-B 참조.

### 1.3 대시보드 (Grafana)

`grafana.yaml`(grafana/grafana:10.3.1, admin pw=SealedSecret) + `grafana-datasources.yaml`(Prometheus uid `prometheus` default, Loki uid `loki`) + `grafana-dashboard-provider.yaml`(file provider, 30s).

| 대시보드 | uid | 주제 | 출처 |
|----------|-----|------|------|
| Service Debug | `algosu-service-debug` | 서비스별 HTTP/리소스/CB/RabbitMQ + **Loki 로그 패널 2종** | `grafana-service-dashboard.yaml` |
| SLO | `algosu-slo` | 골든시그널(가용성 99.5%·에러<5%·P95<1s·P99<3s) | `grafana-slo-dashboard.yaml` |
| Circuit Breaker | `algosu-cb` | TS(submission/github-worker) + Python(ai-analysis) CB | `grafana-cb-dashboard.yaml` |

### 1.4 로깅 파이프라인 (Loki + Promtail)

- **Promtail** `promtail.yaml` — DaemonSet(전 노드), `/var/log/pods` hostPath 읽기, `spec.nodeName=${HOSTNAME}` 셀렉터로 현재 노드 Pod만, `algosu` namespace keep. 라벨: `namespace`/`pod`/`app`/`container`. 파이프라인 `cri:{}` → `json:{level,traceId,tag}` → `labels:{level,tag}` 승격(`:59-71`). positions=`/tmp/positions.yaml`(emptyDir, `:18`).
- **Loki** `loki-config.yaml` — grafana/loki:3.3.2, 단일 바이너리, 보존 72h, `allow_structured_metadata: false`, PVC 5Gi, `/ready` probe.

### 1.5 검증 인프라 (CI)

- `scripts/check-grafana-metrics.mjs`(대시보드 메트릭/라벨/패널제목/변수/rule라벨/datasource/빈패널/중복id 8차원 cross-check), `scripts/check-prometheus-rules.mjs`(promtool), `scripts/check-prom-default-metrics.mjs`(로컬 전용, CI 미통합 — §4-D2).
- `.github/workflows/ci.yml` `quality-monitoring` job — **BLOCKING**(`infra/k3s/monitoring/**`·`metrics.*` 변경 시 발동, promtool 설치 후 위 스크립트 실행).
- 컨벤션 SSOT: `docs/conventions/monitoring-logging.md`.

---

## §2 서비스 × 관측성 차원 커버리지 매트릭스

| 서비스 | 메트릭(Prom) | 헬스 | 구조화 로깅(JSON) | 트레이싱(OTel) | Sentry |
|--------|:---:|:---:|:---:|:---:|:---:|
| gateway | ✅ prom-client | ✅ `/health`,`/health/ready`(간단) | ✅ StructuredLogger | ❌ | ✅ (DSN 조건부) |
| identity | ✅ | ✅ readiness DB `SELECT 1` | ✅ | ❌ | ❌ |
| submission | ✅ (CB 공유) | ✅ readiness DB | ✅ | ❌ | ❌ |
| problem | ✅ | ✅ readiness DB | ✅ | ❌ | ❌ |
| github-worker | ✅ (독립 9100) | ⚠️ `/health`(의존성 체크 없음) | ✅ (MQ/Saga 확장) | ❌ | ❌ |
| ai-analysis | ✅ prometheus_client | ✅ `/health`,`/health/ready`(Worker+Redis) | ✅ (PII 마스킹) | ❌ | ❌ |
| frontend | ❌ | ❌ | (console, 개발) | ❌ | ✅ Sentry + GA4 + WebVitals |

출처: `services/*/src/common/metrics/`, `services/*/src/health.controller.ts`, `services/github-worker/src/metrics.ts:88-91`, `services/ai-analysis/src/main.py:163-194`, `services/*/src/common/logger/structured-logger.service.ts`, `services/ai-analysis/src/logger.py`, `services/gateway/src/main.ts:8-18`, `frontend/sentry.*.config.ts`.

---

## §3 로그 수집 라이브 진단 절차 (운영측, OCI 클러스터)

> **전제**: §1.4 정적 구성은 올바르게 배선돼 있음(NetworkPolicy 비차단·라벨 정합·level 소문자 정합 확인됨). 따라서 로그가 안 보이면 **런타임 원인**을 아래 순서로 좁힌다. 에이전트 환경의 kubectl은 로컬 미가동 클러스터라 실행 불가 → 운영측 수행.

1. **Promtail 가동 확인**
   ```bash
   kubectl -n algosu get pods -l app=promtail -o wide      # 노드당 1개 Running, RESTARTS 0
   kubectl -n algosu logs -l app=promtail --tail=80        # push 에러/권한/positions 확인
   ```
   - `level=error msg="error sending batch"` → Loki 연결/네트워크. `permission denied /var/log/pods` → hostPath 마운트.
   - ⚠️ positions가 emptyDir(`promtail.yaml:18,144-145`)라 Pod 재시작 시 리셋 — 재시작 직후 일시적 중복/누락은 정상.

2. **Loki 수신 확인**
   ```bash
   kubectl -n algosu get pods -l app=loki
   kubectl -n algosu exec deploy/loki -- wget -qO- localhost:3100/ready    # "ready"
   kubectl -n algosu exec deploy/loki -- df -h /loki                       # PVC 용량(5Gi) 포화 여부
   ```

3. **LogQL 직접 질의** (Grafana Explore, Loki 데이터소스) — 좁혀가며 어느 단계가 비는지 확인
   ```logql
   {namespace="algosu"}                              # 라벨/스트림 존재 (가장 먼저)
   {namespace="algosu", pod=~"gateway.*"}            # 특정 서비스 pod 매칭
   {namespace="algosu", level="error"}               # level 라벨 승격 동작(에러만)
   ```
   - 1단계가 비면 → Promtail 미수집(1·2단계 재점검). 1은 되는데 2가 비면 → pod 이름/`$service` 셀렉터. 2는 되는데 3이 비면 → JSON `level` 미파싱(서비스 로그가 JSON 한 줄인지 `kubectl logs`로 확인).

4. **대시보드 확인** — Service Debug 대시보드 → `$service` 선택 + 시간 범위(기본 now-1h) → "Service Logs"/"Error Logs Only" 패널.
   - Error Logs Only 쿼리(Sprint 231 수정): `{namespace="algosu", pod=~"${service}.*", level="error"}` (level 라벨 직접 필터).

---

## §4 확정 갭 · 거짓 추정 디버그 · 후속 시드

> **구조 (Sprint 232 핵심)**: AlgoSu `infra/k3s/`는 **배포되지 않는 참조 미러**다. 배포 SSOT는 **aether-gitops**(`algosu/base/monitoring/` + `overlays/prod`); ArgoCD(automated·selfHeal·Synced)가 이것만 본다. AlgoSu CI(`ci.yml:1073+`)는 aether-gitops에 **이미지 태그만** bump하고 매니페스트는 전파하지 않는다 → 두 소스는 드리프트한다. **런타임 결함은 반드시 라이브(aether-gitops/클러스터)로 검증할 것.** [[feedback-source-vs-live-drift]]

### A. 로깅 — 구성 정상, 실제 원인은 Loki OOM(해소됨)
- **A-실제원인 (해소)**: 로그 미수집의 실제 원인은 **Loki OOM** — limit 512Mi에서 5일 주기 spike 초과(restartCount 17, 마지막 OOMKilled 2026-05-18). **aether-gitops PR #7(`5b07bf6`)로 limit 512Mi→1Gi / requests 128Mi→256Mi 상향**, 서버 검증(loki Running·1Gi 반영·OOM 재발 없음). 노드 여유 충분(23.4GiB, MemoryPressure False).
- **A5/A6 (미러 쿼리)**: Error Logs Only 쿼리 `level=~"error|fatal|CRITICAL"`(죽은 분기 — 어떤 서비스도 `fatal`/`CRITICAL` 미출력. Python `LEVEL_MAP`은 CRITICAL→`"error"` 통일)+취약한 라인필터를 `level` 라벨 직접 필터로 단순화(Sprint 231). ⚠️ 단 이는 **비배포 미러**의 대시보드이므로 라이브 Grafana 반영 여부는 aether-gitops 대시보드 확인 필요(시드).
- **A7 (관찰)**: Promtail positions emptyDir → 재시작 시 리셋(중복 로그 위험, 미수집 원인 아님).

### B. 알림 — 라이브 정상 (Sprint 231 "결함" 결론은 오류, 정정됨)
- **B-정정**: Sprint 231은 `infra/k3s/`(비배포 미러)의 구버전 `receiver: 'null'`을 보고 "17규칙 전부 드롭/무알림"을 단정했으나 **오류**. 배포 SSOT(aether-gitops)의 라이브 alertmanager는 **Sprint 130 B-1로 이미 정상** — alertmanager-native `discord-default` + `discord-critical`(severity 라우팅), `webhook_url_file`로 `identity-discord-secret/webhook-url` 참조(`optional: false`), image v0.28.1.
- **B-미러정합 (Sprint 232)**: AlgoSu 미러 `alertmanager.yaml`을 라이브로 교체(v0.28.1 + discord-default/critical + identity-discord-secret/webhook-url). Sprint 231이 넣은 `monitoring-secrets/discord_webhook` + v0.27.0(file-webhook 미지원이라 **작동불가**) 설정과 `ALERTMANAGER_DISCORD_WEBHOOK` placeholder 제거. **배포 무영향**(미러).
- **B-secret**: alertmanager와 identity-service(feedback)가 **`identity-discord-secret`(key `webhook-url`)을 공유** — 동일 Discord 채널. 별도 seal 불필요(기존 secret 재사용). Sprint 231의 "ALERTMANAGER_DISCORD_WEBHOOK seal 필요" 이월은 **무효**.

### C. 거짓 추정 디버그 (에이전트 조사 추정 → 코드/매니페스트로 반증)
- **C1**: github-worker-metrics Service는 **실존**(`infra/k3s/github-worker.yaml:81`, port 9100) → prometheus scrape 타겟 유효. "메트릭 노출 불일치" 추정은 거짓.
- **C2**: Identity discord-webhook = **feedback 전용**(`identity/src/feedback/feedback.service.ts:58`) — Prometheus alert 수신 컨트롤러 없음. 알림과 무관.
- **C3**: `.bak` 2개(`grafana-cb-dashboard.yaml.bak`, `grafana-slo-dashboard.yaml.bak`)는 **git 미추적**(체크인 아님)이었음 — 로컬 정리만 수행, 커밋 영향 없음. "체크인된 백업" 추정 정정.
- **C4**: 모니터링 SealedSecret(`monitoring-secrets`) = `GRAFANA_ADMIN_PASSWORD` 1개. Discord webhook은 별도 `identity-discord-secret`(key `webhook-url`)을 alertmanager·identity-feedback이 공유. (Sprint 231이 추가했던 `ALERTMANAGER_DISCORD_WEBHOOK`은 Sprint 232에서 제거 — 불필요했음.)

### D. 후속 시드 (이번 스프린트 미포함)
- **D1 (신규, 서버 검증 필요) loki prod 하드닝 갭**: AlgoSu 미러 `loki-config.yaml`엔 `livenessProbe`/`readinessProbe` + `securityContext`(runAsNonRoot:10001) + `allow_structured_metadata: false`가 있으나, 서버 라이브 덤프(aether-gitops base)엔 **probe·securityContext 부재 + `allow_structured_metadata: true`**. → 라이브 loki에 probe/securityContext 실재 여부 **서버 재확인** 필요. 없으면 **prod 하드닝 갭**(aether-gitops에 probe/securityContext 추가), 덤프 누락이면 무시. (미러 loki는 드리프트 방향 미확정이라 본 스프린트 미수정.)
- **D2**: `check-prom-default-metrics.mjs` CI 미통합(로컬/port-forward 전용). 서비스 부트스트랩 필요로 의도적 분리 추정 — `quality-monitoring`에 선택적 통합 검토.
- **D3**: DLQ alert placeholder(`prometheus-rules.yaml` messaging 그룹) / ai-analysis Python CB `requests_total`·`failures_total` 메트릭 부재(`grafana-cb-dashboard.yaml` description).
- **D4**: 분산 트레이싱(OpenTelemetry) 미사용 — 서비스 간 traceId는 헤더 전파만. Sentry는 gateway+frontend만. 알림 대응/온콜 절차 런북 부재(본 런북이 1차 토대).
- **D5**: AlgoSu `infra/k3s/`(비배포 미러) ↔ aether-gitops(배포 SSOT) 드리프트 — 완전 미러 동기화는 미채택(참조 격하). 향후 미러를 deprecate하거나 드리프트 체크 자동화 검토.
