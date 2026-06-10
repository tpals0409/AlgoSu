<!--
@file docs/runbook/oncall-alerts.md
@domain observability
@layer runbook
@related infra/k3s/monitoring/prometheus-rules.yaml, infra/k3s/monitoring/alertmanager.yaml, docs/runbook/monitoring-system-audit.md, docs/adr/sprints/sprint-235.md
-->

# 온콜 알림 대응 런북 (Sprint 235)

> AlgoSu Alertmanager가 Discord로 발화하는 **모든 alert별 의미·진단 쿼리·1차 대응 절차**를 한 곳에 고정한 SSOT.
> 알림 수신 → 진단 → 대응의 표준 흐름을 제공한다. 각 alert는 `prometheus-rules.yaml`의 정의(`파일:라인`)와 연결된다.
> 기준 커밋: `ca2b0bd` (Sprint 234 머지). 알림 규칙 SSOT: `infra/k3s/monitoring/prometheus-rules.yaml`.

---

## §0 알림 수신 시 공통 흐름

1. **채널 확인** — 운영 알림은 2채널로 분리(Sprint 235):
   - **critical 채널**(`@here` 멘션) ← `severity: critical` 알림. 즉시 대응.
   - **일반 채널** ← `severity: warning` 알림. 추세 관찰 후 대응.
2. **알림 본문 파싱** — `alertname`, `summary`, `severity`, `namespace`, `pod`(critical) 확인.
3. **진단** — 아래 alert별 §에서 PromQL/LogQL 쿼리로 범위 확정.
4. **대응** — 1차 조치 수행. 해소 안 되면 에스컬레이션(ADR-028 read-only kubeconfig로 라이브 진단).
5. **기록** — 반복/신규 패턴이면 후속 시드로 ADR/런북에 반영.

> ⚠️ 라이브 클러스터 접근은 **read-only ServiceAccount**(`prod-diag-readonly`, ADR-028)로만. 변경은 ArgoCD(aether-gitops PR) 경유. 핫픽스는 ADR 기록 + GitOps 사후 정합 필수.

---

## §1 진단 도구 빠른 참조

| 도구 | 용도 | 접근 |
|------|------|------|
| **Grafana** | 대시보드(SLO / Service-Debug / Circuit-Breaker), Loki 로그 탐색 | `:3000` |
| **Prometheus** | PromQL 즉석 질의, alert 상태(`/alerts`), 타겟(`/targets`) | `:9090` |
| **Alertmanager** | 발화 중 알림(`/#/alerts`), silence 설정 | `:9093` |
| **Loki(LogQL)** | 구조화 로그 질의. 라벨: `namespace`, `service`, `level`, `tag` | Grafana Explore |

**로그 기본 질의**(서비스 에러):
```logql
{namespace="algosu", service="<service>", level="error"}
```
> `service` 라벨값은 단축형(gateway / submission / problem / identity / ai-analysis / github-worker). `level`은 소문자 정합(debug/info/warn/error, Python CRITICAL→error).

---

## §2 alert별 대응 (severity 순)

### 🔴 critical

#### ServiceDown — `prometheus-rules.yaml:16`
- **의미**: 핵심 서비스(gateway/identity/submission/problem/ai-analysis) `up == 0`이 30초 지속. scrape 실패 = 프로세스 다운 또는 네트워크 단절.
- **진단**:
  ```promql
  up{job=~"gateway|identity-service|submission-service|problem-service|ai-analysis"} == 0
  ```
  - Pod 상태: `kubectl get pods -n algosu`(read-only) — `CrashLoopBackOff`/`Pending`/`Error` 확인.
  - 직전 로그: `{namespace="algosu", service="<service>"} |= "" | level="error"` (마지막 5분).
- **대응**: CrashLoop면 §OOMKilled / §PodRestartFrequent 연계. 이미지/마이그레이션 실패면 직전 롤아웃 SHA 확인(`db-migrate` initContainer 로그). 복구는 ArgoCD rollback(aether-gitops).

#### CriticalErrorRate — `prometheus-rules.yaml:67`
- **의미**: Gateway 5xx 에러율 > 15%(5분). 사용자 영향 큰 장애.
- **진단**:
  ```promql
  algosu:http_error_rate:5m{job="gateway"}
  ```
  - 에러 경로 식별: `sum by (path,status_code) (rate(algosu_gateway_http_requests_total{status_code=~"5.."}[5m]))`
  - 로그: `{namespace="algosu", service="gateway", level="error"}`
- **대응**: 다운스트림(identity/submission/problem) 동반 확인 — Gateway 5xx는 보통 업스트림 전파. 특정 의존성이면 §CircuitBreakerOpen 연계.

#### AuthFailureRateHigh — `prometheus-rules.yaml:98`
- **의미**: Identity 401 비율 > 30%(5분). 무차별 대입(brute-force) 공격 의심.
- **진단**:
  ```promql
  sum(rate(algosu_identity_http_requests_total{status_code="401"}[5m])) / sum(rate(algosu_identity_http_requests_total[5m])) * 100
  ```
  - 로그에서 출처 IP/패턴: `{namespace="algosu", service="identity", level="warn"}` (IP는 마스킹됨 — 패턴만).
- **대응**: 공격 확증 시 rate-limit/WAF(Cloudflare) 강화. 정상 트래픽 급증(배포 직후 토큰 만료)이면 오탐 — 추세 확인.

#### InternalKeyViolation — `prometheus-rules.yaml:111`
- **의미**: Gateway 403이 5분 내 5회 초과. `X-Internal-Key` 위반 — 내부 API 무단 접근 시도.
- **진단**:
  ```promql
  sum(increase(algosu_gateway_http_requests_total{status_code="403"}[5m]))
  ```
  - 로그: `{namespace="algosu", service="gateway", tag="INTERNAL_KEY"}` 또는 `level="error"`.
- **대응**: 키 유출 의심 시 `INTERNAL_API_KEY` 로테이션(`docs/runbook/key-rotation.md`). 배포 중 키 불일치(secret 미동기)면 SealedSecret 적용 확인.

#### CircuitBreakerOpen — `prometheus-rules.yaml:126` *(Sprint 235: 3서비스 통합)*
- **의미**: ai-analysis / submission / github-worker 중 한 서비스의 Circuit Breaker가 OPEN(값 2). 다운스트림 의존성 차단으로 해당 기능 정지.
  - `ai-analysis` → Claude API 차단(AI 분석 정지)
  - `submission` → 다운스트림 호출 차단(Saga 진행 영향)
  - `github-worker` → GitHub API 차단(동기화 정지)
- **진단**:
  ```promql
  {__name__=~"algosu_(ai_analysis|submission|github_worker)_circuit_breaker_state", name=~".+"} == 2
  ```
  - 어떤 서비스/브레이커인지는 알림 summary의 `job`·`name` 라벨로 확정.
  - 실패 누적: `rate(algosu_<service>_circuit_breaker_failures_total[5m])`
  - Grafana **Circuit-Breaker 대시보드**에서 State Timeline 확인.
- **대응**: 다운스트림(Claude API / GitHub API) 상태 확인. 외부 장애면 자동 HALF_OPEN 복구 대기. 지속되면 의존성 quota/rate-limit·토큰 확인(`github-token-relink.md`).

#### DLQReceived — `prometheus-rules.yaml:157` *(Sprint 235: 2워커 실 메트릭)*
- **의미**: github-worker 또는 ai-analysis 워커의 Dead Letter Queue에 최근 5분 내 메시지 도달. 메시지 처리 실패 → Saga 보상/재처리 필요. (DLQ 메트릭은 counter라 `increase(...[5m])`로 '신규 이벤트'만 감지 — raw value `>0`은 첫 이벤트 후 영구 발화.)
- **진단**:
  ```promql
  increase({__name__=~"algosu_(github_worker|ai_analysis)_dlq_messages_total"}[5m]) > 0
  ```
  - 실패 사유: `sum by (reason) (algosu_<worker>_dlq_messages_total)` — `parse_error`(메시지 포맷) / `process_failure`(처리 로직) / `token_invalid`(github-worker).
  - 로그: `{namespace="algosu", service="<worker>", tag="DLQ_RECEIVED"}`
- **대응**: `parse_error`면 publisher(submission) 메시지 스키마 확인. `process_failure`면 워커 로직/다운스트림 확인. `token_invalid`면 GitHub 토큰 재연결. DLQ 메시지 수동 재주입은 **[`docs/runbook/dlq-redrive.md`](./dlq-redrive.md)** 참조 (근본 원인 제거 선행 필수).

#### OOMKilled — `prometheus-rules.yaml:207`
- **의미**: algosu namespace Pod가 메모리 부족으로 강제 종료. (Loki OOM 이력 있음 — Sprint 232 512Mi→1Gi 해소).
- **진단**:
  ```promql
  kube_pod_container_status_terminated_reason{namespace="algosu", reason="OOMKilled"} > 0
  ```
  - 메모리 추세: `container_memory_working_set_bytes{namespace="algosu", pod=~"<pod>.*"}` vs limits.
- **대응**: 반복되면 limits 상향(aether-gitops PR). 단발이면 메모리 누수/스파이크 패턴 조사. NestJS면 `algosu:memory_usage_pct` recording rule로 RSS 추세 확인.

---

### 🟡 warning

#### HighErrorRate — `prometheus-rules.yaml:58`
- **의미**: 임의 서비스 5xx 에러율 > 5%(5분). SLO 위반 경고.
- **진단**: `algosu:http_error_rate:5m` — `job` 라벨로 서비스 식별. 로그 `level="error"`.
- **대응**: 추세 상승이면 §CriticalErrorRate 전조. 특정 경로 집중이면 해당 핸들러 조사.

#### HighLatencyP95 — `prometheus-rules.yaml:81`
- **의미**: 서비스 P95 응답시간 > 1.0s(3분).
- **진단**:
  ```promql
  histogram_quantile(0.95, sum by (le, job) (rate({__name__=~"algosu_.+_http_request_duration_seconds_bucket"}[5m])))
  ```
  - Grafana **Service-Debug 대시보드** Latency 패널.
- **대응**: DB 슬로우쿼리/외부 의존성 지연 확인. RabbitMQ 적체(§RabbitMQUnackedHigh) 동반 여부.

#### HighMemoryUsage — `prometheus-rules.yaml:142`
- **의미**: NestJS 서비스 RSS가 container limits 대비 > 80%(5분).
- **진단**: `algosu:memory_usage_pct` — `job` 라벨로 서비스. §OOMKilled 전조.
- **대응**: 지속 상승이면 limits 상향 검토 또는 누수 조사.

#### RabbitMQUnackedHigh — `prometheus-rules.yaml:171`
- **의미**: unacked 메시지 > 100(5분). 컨슈머 처리 지연/정체.
- **진단**:
  ```promql
  rabbitmq_queue_messages_unacked
  ```
  - 큐별 적체: `rabbitmq_queue_messages_unacked{queue=~"submission.*"}`
  - 컨슈머(github-worker/ai-analysis) 가동 여부 §ServiceDown.
- **대응**: 컨슈머 다운이면 복구. 처리 느림이면 §CircuitBreakerOpen/외부 의존성 확인. DLX로 빠지면 §DLQReceived.

#### PodRestartFrequent — `prometheus-rules.yaml:185`
- **의미**: algosu Pod가 1시간 내 3회 초과 재시작. CrashLoopBackOff 의심.
- **진단**:
  ```promql
  increase(kube_pod_container_status_restarts_total{namespace="algosu"}[1h])
  ```
  - 종료 사유: §OOMKilled 또는 readiness/liveness probe 실패.
- **대응**: 직전 로그 + probe 설정 확인. 마이그레이션/설정 오류면 롤백.

#### HighCPUUsage — `prometheus-rules.yaml:194`
- **의미**: Pod CPU가 limits 대비 > 90%(5분).
- **진단**:
  ```promql
  sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="algosu"}[5m])) / sum by (pod) (kube_pod_container_resource_limits{namespace="algosu", resource="cpu"}) * 100
  ```
- **대응**: HPA 스케일링 동작 확인. 지속 부하면 limits/replica 조정(aether-gitops).

---

## §3 알림이 안 오는데 문제는 있는 경우 (전송 경로 점검)

> Sprint 231 교훈: **rule 존재 ≠ 전송**. alert가 발화해도 Discord에 안 오면 전송 경로를 점검한다.

1. **Prometheus가 alert를 보는가** — `:9090/alerts`에서 해당 alert `FIRING` 확인. `PENDING`이면 `for:` 기간 대기 중.
2. **Alertmanager가 받았는가** — `:9093/#/alerts`에 표시되는지. silence에 걸리지 않았는지.
3. **receiver 매칭** — `severity: critical` → `discord-critical`, 그 외 → `discord-default`(`alertmanager.yaml:34-40`).
4. **webhook 도달** — Alertmanager 로그에서 discord 전송 실패(4xx/5xx) 확인. webhook URL secret 마운트(`alertmanager-discord-secret`) 정상 여부.
5. **채널 확인** — Sprint 235 분리 후 critical/일반 채널이 다름 — 엉뚱한 채널 보고 있지 않은지.

상세 전송 경로 검증(라이브 발화→Discord 도달)은 `docs/runbook/alert-channel-separation.md` §검증 참조.

---

## §4 관련 문서

- 알림 규칙 SSOT: `infra/k3s/monitoring/prometheus-rules.yaml`
- Alertmanager 라우팅: `infra/k3s/monitoring/alertmanager.yaml`
- 채널 분리 적용 절차: `docs/runbook/alert-channel-separation.md`
- 모니터링 전수 인벤토리/라이브 진단: `docs/runbook/monitoring-system-audit.md`
- read-only 라이브 진단 권한: `docs/runbook/prod-readonly-kubeconfig.md`
- 키 로테이션: `docs/runbook/key-rotation.md`
- GitHub 토큰 재연결: `docs/runbook/github-token-relink.md`
