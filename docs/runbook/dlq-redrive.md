<!--
@file docs/runbook/dlq-redrive.md
@domain messaging
@layer runbook
@related services/submission/src/saga/mq-publisher.service.ts, services/github-worker/src/worker.ts, services/ai-analysis/src/worker.py, docs/runbook/oncall-alerts.md, docs/adr/ADR-030-security-improvement-backlog.md
-->

# DLQ 수동 Redrive 런북

> 대상: `submission.github_push.dlq` / `submission.ai_analysis.dlq`
> 트리거: `DLQReceived` 알림 수신 후, **근본 원인 제거를 확인하고 나서** 실행한다.

---

## §0 배경 및 토폴로지

### MQ 구조

`submission` 서비스가 이벤트를 발행하면 github-worker / ai-analysis 워커가 각각 소비한다.
처리 실패(NACK + requeue=false) 시 해당 메시지는 DLX를 통해 DLQ로 이동한다.

| 구성 요소 | 이름 | 선언 위치 |
|-----------|------|-----------|
| Exchange (topic) | `submission.events` | `mq-publisher.service.ts:43` |
| GitHub 워커 큐 | `submission.github_push` | `mq-publisher.service.ts:44` |
| AI 워커 큐 | `submission.ai_analysis` | `mq-publisher.service.ts:45` |
| Dead Letter Exchange | `submission.events.dlx` | `mq-publisher.service.ts:89` |
| GitHub DLQ | `submission.github_push.dlq` | `mq-publisher.service.ts:90` |
| AI DLQ | `submission.ai_analysis.dlq` | `mq-publisher.service.ts:91` |
| GitHub DLQ routing key | `github.push.dead` | `worker.ts:178` |
| AI DLQ routing key | `ai.analysis.dead` | `worker.py:154` |

### Redrive 목표

DLQ에서 메시지를 꺼내 **원본 exchange + 원본 routing key**로 재발행(re-publish)하여 워커가 다시 처리하도록 한다.

| DLQ | Redrive 대상 exchange | Redrive 대상 routing key |
|-----|-----------------------|--------------------------|
| `submission.github_push.dlq` | `submission.events` | `github.push` |
| `submission.ai_analysis.dlq` | `submission.events` | `ai.analysis` |

### 메시지 포맷 (`SubmissionEvent`)

```json
{
  "submissionId": "string",
  "studyId": "string",
  "timestamp": "ISO 8601",
  "userId": "string (optional)",
  "sourcePlatform": "string (optional, e.g. 'PROGRAMMERS')"
}
```

### DLQ reason 5종

| reason | 워커 | 의미 | Redrive 가능 여부 |
|--------|------|------|-------------------|
| `parse_error` | github-worker | JSON 파싱 실패 — publisher 메시지 스키마 결함 | ❌ 근본 원인(publisher 버그) 수정 없이는 재실패 |
| `process_failure` | github-worker | GitHub API 호출·push·로직 실패 | ✅ 다운스트림 복구 확인 후 |
| `circuit_breaker_exhausted` | ai-analysis | Claude API CB OPEN 상태에서 한도 초과 | ✅ CB CLOSED 확인 후 |
| `rate_limit_exhausted` | ai-analysis | Claude API rate limit + requeue 한도(`MAX_REQUEUE`) 초과 | ✅ rate limit 정상화 확인 후 |
| `process_failure` | ai-analysis | AI 분석 일반 예외 | ✅ 에러 원인 확인 후 |

---

## §1 Redrive 전 필수 게이트 — 근본 원인 제거 선행

> ⚠️ 근본 원인을 제거하지 않고 redrive하면 메시지가 즉시 DLQ에 재도달한다.

### 진단 쿼리

```promql
# DLQ 신규 유입 — reason별 분포
sum by (reason) (
  increase(algosu_github_worker_dlq_messages_total[5m])
) > 0

sum by (reason) (
  increase(algosu_ai_analysis_dlq_messages_total[5m])
) > 0
```

```bash
# Loki — 최근 DLQ 수신 로그
{namespace="algosu", service=~"github-worker|ai-analysis", tag="DLQ_RECEIVED"}
```

### reason별 사전 조치

#### `parse_error` (github-worker)

publisher(submission 서비스)가 잘못된 스키마의 메시지를 발행한 것이다. **Redrive는 의미가 없다** — 메시지 자체가 파싱 불가능하므로 재발행해도 동일하게 실패한다.

- submission 서비스 배포 이력 확인 (`kubectl rollout history deployment/submission -n algosu`)
- `mq-publisher.service.ts`의 `SubmissionEvent` 필드 변경 여부 확인
- 메시지 본문을 직접 확인(`§2 DLQ 조회`) 후 스키마 수정·재배포 선행

#### `process_failure` (github-worker)

GitHub API 호출 또는 push 처리 실패다.

```bash
# GitHub API 상태 확인
kubectl logs -n algosu -l app=github-worker --tail=100 | grep '"level":"error"'

# GitHub App 토큰 정상 여부 (key-rotation.md §5 참조)
kubectl logs -n algosu -l app=github-worker --tail=50 | grep "TOKEN_REFRESH"
```

다운스트림 복구가 확인되면 redrive 진행.

#### `circuit_breaker_exhausted` (ai-analysis)

CB가 OPEN → CB CLOSED 전환을 확인한다.

```promql
# CB 상태 확인 (0=CLOSED, 1=HALF_OPEN, 2=OPEN)
{__name__=~"algosu_(ai_analysis)_circuit_breaker_state", name=~".+"} == 0
```

```bash
# Grafana "Circuit-Breaker 대시보드" State Timeline에서 CLOSED 전환 확인
# 또는 ai-analysis 로그에서 CB 상태 확인
kubectl logs -n algosu -l app=ai-analysis --tail=50 | grep -i "circuit_breaker"
```

CB가 CLOSED 상태임을 확인한 후 redrive 진행. CB가 아직 OPEN이면 자동 HALF_OPEN 복구 대기.

#### `rate_limit_exhausted` / `circuit_breaker_exhausted` (ai-analysis)

Claude API rate limit 정상화 확인:

```bash
kubectl logs -n algosu -l app=ai-analysis --tail=50 | grep -i "rate.limit\|429"
```

rate limit 회복(보통 수 분~수십 분) 후 redrive 진행.

---

## §2 DLQ 조회

### 2-1. 사전 준비 — RabbitMQ management plugin 여부 확인

```bash
# RabbitMQ pod 접근
kubectl exec -n algosu deploy/rabbitmq -- rabbitmqctl status | grep "RabbitMQ plugins"

# management plugin 활성화 여부
kubectl exec -n algosu deploy/rabbitmq -- rabbitmq-plugins list | grep rabbitmq_management
# 활성화: [E*] rabbitmq_management ...
```

### 2-2. DLQ 메시지 수 조회

```bash
# 큐 depth 조회
kubectl exec -n algosu deploy/rabbitmq -- rabbitmqctl list_queues name messages \
  | grep -E "\.dlq"
# 예상 출력:
#   submission.github_push.dlq    5
#   submission.ai_analysis.dlq    0
```

### 2-3. DLQ 메시지 본문 확인 (peek)

```bash
# github_push.dlq 메시지 1건 확인 (peek — 소비하지 않음)
kubectl exec -n algosu deploy/rabbitmq -- \
  rabbitmqadmin get queue=submission.github_push.dlq count=1 --format=pretty_json

# ai_analysis.dlq
kubectl exec -n algosu deploy/rabbitmq -- \
  rabbitmqadmin get queue=submission.ai_analysis.dlq count=1 --format=pretty_json
```

> `rabbitmqadmin`이 없는 경우 management HTTP API로 대체:
> ```bash
> kubectl exec -n algosu deploy/rabbitmq -- \
>   curl -s -u guest:guest \
>   "http://localhost:15672/api/queues/algosu/submission.github_push.dlq/get" \
>   -d '{"count":1,"ackmode":"ack_requeue_true","encoding":"auto"}' \
>   -H "Content-Type: application/json"
> ```

---

## §3 Redrive 절차

### 방법 A: Dynamic Shovel (권장 — 메시지 유실 없음)

Shovel은 DLQ의 모든 메시지를 원본 exchange로 전달하고, 완료 후 삭제한다. 대량 메시지에도 안전하다.

#### github_push.dlq → submission.events (github.push)

```bash
# Shovel 생성
kubectl exec -n algosu deploy/rabbitmq -- \
  rabbitmqctl set_parameter shovel redrive-github-push \
  '{
    "src-protocol": "amqp091",
    "src-uri": "amqp://",
    "src-queue": "submission.github_push.dlq",
    "dest-protocol": "amqp091",
    "dest-uri": "amqp://",
    "dest-exchange": "submission.events",
    "dest-exchange-key": "github.push",
    "src-delete-after": "queue-length"
  }'

# 완료 확인 (큐 depth = 0)
kubectl exec -n algosu deploy/rabbitmq -- rabbitmqctl list_queues name messages \
  | grep github_push.dlq

# Shovel 삭제 (완료 후 반드시 제거)
kubectl exec -n algosu deploy/rabbitmq -- \
  rabbitmqctl clear_parameter shovel redrive-github-push
```

#### ai_analysis.dlq → submission.events (ai.analysis)

```bash
kubectl exec -n algosu deploy/rabbitmq -- \
  rabbitmqctl set_parameter shovel redrive-ai-analysis \
  '{
    "src-protocol": "amqp091",
    "src-uri": "amqp://",
    "src-queue": "submission.ai_analysis.dlq",
    "dest-protocol": "amqp091",
    "dest-uri": "amqp://",
    "dest-exchange": "submission.events",
    "dest-exchange-key": "ai.analysis",
    "src-delete-after": "queue-length"
  }'

kubectl exec -n algosu deploy/rabbitmq -- rabbitmqctl list_queues name messages \
  | grep ai_analysis.dlq

kubectl exec -n algosu deploy/rabbitmq -- \
  rabbitmqctl clear_parameter shovel redrive-ai-analysis
```

> **Shovel 플러그인 활성화 여부 확인**: `rabbitmq-plugins list | grep rabbitmq_shovel`
> 비활성 시 방법 B로 대체.

---

### 방법 B: rabbitmqadmin 수동 루프 (소량, Shovel 사용 불가 시)

> ⚠️ 소량(수십 건 이하)일 때만 사용. 대량 메시지에는 방법 A 권장.
>
> ⚠️ **메시지 유실 위험**: `ackmode=ack_requeue_false`를 소비 전에 실행하면 payload 추출·재발행 실패 시 **원본 메시지가 영구 유실**된다. 반드시 **peek → 검증 → 재발행 → 소비** 순서를 지킨다.
>
> ⚠️ **invalid 메시지는 루프 중단 → 수동 제거 후 재시작**: `ack_requeue_true` peek은 메시지를 큐 헤드에 되돌리므로 유효성 실패 시 `continue`하면 동일 메시지를 무한 반복한다. 유효성 실패 감지 시 루프를 `break`하고, 해당 메시지를 `ack_requeue_false` 1건으로 수동 제거한 뒤 루프를 재시작한다.

```bash
# 메시지 수 확인
COUNT=$(kubectl exec -n algosu deploy/rabbitmq -- \
  rabbitmqctl list_queues name messages \
  | grep submission.github_push.dlq | awk '{print $2}')

echo "재처리 대상: ${COUNT}건"

# peek → 검증 → 재발행 → 소비 루프 (github_push.dlq 예시)
for i in $(seq 1 $COUNT); do
  # Step 1: ack_requeue_true로 안전 peek — 원본 메시지를 DLQ에 보존한 채 추출
  RAW=$(kubectl exec -n algosu deploy/rabbitmq -- \
    rabbitmqadmin get queue=submission.github_push.dlq \
      count=1 ackmode=ack_requeue_true --format=json)

  # Step 2: jq로 payload 안전 추출 (이스케이프 따옴표 포함 JSON에서도 잘림 없음)
  PAYLOAD=$(echo "$RAW" | jq -r '.[0].payload')

  # Step 3: submissionId 존재 확인 (파싱 실패·잘못된 스키마 조기 차단)
  if ! echo "$PAYLOAD" | jq -e '.submissionId' > /dev/null 2>&1; then
    echo "[$i/$COUNT] ❌ 유효성 실패 — 루프 중단"
    echo "  invalid 메시지 큐 헤드 고착 — §1 근본원인(parse_error) 조사 후"
    echo "  해당 메시지를 ack_requeue_false 1건으로 수동 제거하고 루프 재시작"
    break
  fi

  # Step 4: 재발행 성공 여부 확인
  PUB_RESULT=$(kubectl exec -n algosu deploy/rabbitmq -- \
    rabbitmqadmin publish \
      exchange=submission.events \
      routing_key=github.push \
      payload="$PAYLOAD" \
      properties='{"delivery_mode":2}' 2>&1)

  if echo "$PUB_RESULT" | grep -q "Message published"; then
    # Step 5: 재발행 성공 후에만 원본 소비 (DLQ에서 제거)
    kubectl exec -n algosu deploy/rabbitmq -- \
      rabbitmqadmin get queue=submission.github_push.dlq \
        count=1 ackmode=ack_requeue_false > /dev/null
    echo "[$i/$COUNT] ✅ 재발행 성공 → 원본 제거"
  else
    echo "[$i/$COUNT] ❌ 재발행 실패 → 원본 유지 (유실 없음). 결과: $PUB_RESULT"
    echo "  중단합니다. 방법 A(shovel)로 전환하거나 원인 조사 후 재시도하세요."
    break
  fi
done
```

> 동일 명령을 `ai_analysis.dlq` / routing_key `ai.analysis`로 변경하면 AI DLQ에도 적용 가능.
>
> **jq 미설치 시**: `kubectl exec -n algosu deploy/rabbitmq -- bash -c 'apt-get install -y jq -q'` 또는 방법 A로 전환.

---

## §4 멱등성 및 중복 주의사항

### github-worker — Redis TTL 1시간

github-worker는 `ghw:processed:{submissionId}` Redis 키(TTL 1시간)로 중복 처리를 방지한다.

- **DLQ 도달 후 1시간 이내 redrive**: Redis TTL이 살아있으면 워커가 `중복 이벤트 skip` 처리 → **GitHub push 미발생**. 재처리가 필요하면 Redis 키를 먼저 삭제한다.

```bash
# 특정 submissionId의 멱등성 키 삭제
kubectl exec -n algosu deploy/redis -- \
  redis-cli DEL "ghw:processed:<submissionId>"

# DLQ 전체 메시지의 submissionId 목록으로 일괄 삭제 시:
# 메시지 peek으로 submissionId 수집 후 위 명령 반복
```

- **DLQ 도달 후 1시간 초과 redrive**: TTL 만료 → 멱등성 미적용 → **GitHub 레포에 동일 커밋이 중복 push될 수 있음**. 대상 스터디 레포의 중복 커밋 영향을 사전 평가한다.

### ai-analysis — 멱등성 미구현

ai-analysis는 submissionId 기반 중복 처리 보호가 없다. Redrive하면 AI 분석 결과가 **덮어쓰기**된다. 이미 `SYNCED` 상태인 제출의 분석 결과가 갱신되는 것은 대부분 무해하다(최신 분석 결과 반영).

> 분석 결과 보존이 중요한 경우, 대상 `submissionId`의 현재 상태를 확인한 후 선택적으로 redrive한다.

---

## §5 검증

```bash
# 1. DLQ depth = 0 확인
kubectl exec -n algosu deploy/rabbitmq -- rabbitmqctl list_queues name messages \
  | grep -E "\.dlq"
# 목표: messages = 0

# 2. 워커 처리 로그 확인
kubectl logs -n algosu -l app=github-worker --tail=50 | grep "MQ_CONSUME_DONE"
kubectl logs -n algosu -l app=ai-analysis --tail=50 | grep "MQ_CONSUME_DONE\|analysis.*complete"

# 3. DLQ 메트릭 — 신규 유입 없음 확인 (redrive 후 5분 대기)
# Prometheus 또는 Grafana에서:
#   increase(algosu_github_worker_dlq_messages_total[5m]) == 0
#   increase(algosu_ai_analysis_dlq_messages_total[5m]) == 0

# 4. 제출 상태 전이 확인
# 해당 submissionId의 github_sync_status/ai_analysis_status가
# FAILED → SYNCED / COMPLETED 로 전환되었는지 DB 또는 관리 API로 확인
```

---

## §6 자동화 판단 기준

현재 DLQ redrive는 수동 절차이다(ADR-030 Q-3: "자동화는 발생 빈도 확인 후").

| 기준 | 판단 |
|------|------|
| 월 1~2회 미만 DLQ 이벤트 | 수동 절차 유지 — 본 런북으로 처리 |
| 월 3회 이상 DLQ 이벤트 | 자동화 검토 — redrive CronJob 또는 자동 소비자 구현 고려 |
| 특정 reason이 반복적으로 발생 | 근본 원인(circuit breaker 파라미터, rate limit 쿼터) 재검토 우선 |

> 자동화 구현 시 §4의 멱등성 처리(TTL 확인 + Redis 키 삭제 게이트)를 포함해야 한다.

---

## §7 관련 문서

- 온콜 알림 대응: `docs/runbook/oncall-alerts.md` (DLQReceived §)
- GitHub 토큰 재연동: `docs/runbook/github-token-relink.md`
- 암호화 키 로테이션: `docs/runbook/encryption-key-rotation.md`
- 보안 개선 백로그: `docs/adr/ADR-030-security-improvement-backlog.md` (Q-3)
- MQ 구성 선언: `services/submission/src/saga/mq-publisher.service.ts:72-105`
