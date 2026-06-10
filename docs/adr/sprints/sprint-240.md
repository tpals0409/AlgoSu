---
sprint: 240
title: "운영 절차 보강 — ADR-030 S-6/Q-3 (docs only)"
date: "2026-06-10"
status: completed
agents: [Oracle, Architect, Postman, Scribe]
related_adrs: ["ADR-030", "sprint-239", "sprint-236", "sprint-235"]
related_memory: ["sprint-window"]
topics: ["security", "ops-runbook", "dlq"]
tldr: "ADR-030 처리 로드맵 2순위 스프린트. 코드 변경 없이 운영 절차서 2종 신규 작성으로 보안·운영 갭 해소. S-6: GITHUB_TOKEN_ENCRYPTION_KEY 로테이션 런북(encryption-key-rotation.md) — 듀얼 키 미지원으로 로테이션 = 기존 암호화 토큰 전부 무효화, 단 worker.ts fallback 경로로 서비스 무중단. 3-Secret(gateway-secrets+github-worker-secrets+identity-service-secrets — 초안 2-Secret을 Critic R1 P1이 identity 누락 적발, 코드 실측으로 확장) 단일 aether-gitops 커밋 동시 교체 + 검증 게이트 4종(sha256 일치/positive/fallback/닫힘). Q-3: DLQ redrive 런북(dlq-redrive.md) — 토폴로지 표(submission.events→2큐→DLQ 2종), reason 5종 표, 근본원인 제거 선행 게이트(reason별 분기), dynamic shovel 권장 + rabbitmqadmin 대안, 멱등성 주의(github-worker redis TTL 1h). cross-ref 4종 갱신 + ADR-030 S-6/Q-3 Sprint 240 ✅. 검증: ADR 게이트 5종 + doc-ref-lint PASS."
---
# Sprint 240 — 운영 절차 보강 (ADR-030 S-6/Q-3, docs only)

## 목표

- ADR-030 처리 로드맵 2순위 — 운영 절차(docs/런북) 성격의 2건(S-6, Q-3)을 단일 스프린트에서 처리한다.
- 코드 변경 최소 — 절차서 품질과 검증 게이트 중심.
- Sprint 239 코드 quick wins 이후 남은 미문서화 운영 갭을 명시적 런북으로 봉합한다.

## 배경

- `/start` 인자: ADR-030 §결정 로드맵 2순위 S-6 + Q-3 처리.
- **S-6**: `GITHUB_TOKEN_ENCRYPTION_KEY`가 gateway/github-worker 2곳 SealedSecret으로 이중 관리되는데 로테이션 절차 미문서화. 불일치 시 복호화 실패.
- **Q-3**: DLQ 메시지 redrive(재처리)가 수동인데 절차 자체가 미문서화. `oncall-alerts.md:111`이 "DLQ 메시지는 수동/배치 재처리"로 끝남.

## 작업 요약 (Architect + Postman + Scribe, 총 3 commit + Critic R1 수정)

### S-6 — `encryption-key-rotation.md` 신규 작성 (Architect) + Critic R1 수정

- **근거 파일 직접 Read**: `services/gateway/src/auth/oauth/token-crypto.util.ts`(암호화), `services/github-worker/src/worker.ts:384-398`(fallback 경로), `infra/sealed-secrets/sealed-secrets-template.yaml:58,164`(SealedSecret 2곳 초기 확인), `docs/runbook/key-rotation.md`(kubeseal 컨벤션).
- **§0 배경·영향도**: AES-256-GCM 대칭 키, 암호문 형식 `iv:ciphertext:tag`. **듀얼 키 미지원** — 로테이션하면 기존 암호화 토큰 전부 복호화 실패. 단, `worker.ts:384-398` fallback 경로(GitHub App Installation Token)로 서비스 무중단 보장. 사용자 재연동 시 신 키로 재암호화. 로테이션 트리거(정기/유출 의심) 구분.
- **§1 사전 준비**: kubeseal·kubectl·aether-gitops clone 체크리스트 (`key-rotation.md` 패턴 재사용).
- **§2 새 키 생성**: `openssl rand -hex 32` + 64자 hex 형식 검증.
- **§3 초기 2-Secret → Critic R1 수정 후 3-Secret 동시 교체**: Critic이 identity 서비스 누락 지적(P1). Oracle이 코드로 확정 검증: `services/identity/src/user/token-encryption.service.ts:28-34` — `GITHUB_TOKEN_ENCRYPTION_KEY` 미설정 시 부팅 throw(라이브 identity 구동 중=라이브 secret에 키 실존), `user.service.ts:136`에서 암호화 사용. **2-secret→3-secret(gateway-secrets+github-worker-secrets+identity-service-secrets) 전면 수정**: §0 관리 표에 identity 행 추가, §3에 identity-service-secrets 재생성 절차(9키) 추가, §4 sha256 비교 3-secret으로 확장, §5 롤백 3-secret 동시 복원으로 갱신. `infra/sealed-secrets/sealed-secrets-template.yaml`의 identity-service-secrets 섹션에 `GITHUB_TOKEN_ENCRYPTION_KEY` 항목 추가(템플릿 드리프트 해소). 전체 키 포함 주의(`key-rotation.md §3` 동일 경고).
- **§4 검증 게이트 4종**: ① 3-secret sha256 일치 확인(평문 노출 없이) ② 신규 GitHub 연동 positive ③ 기존 토큰 `GITHUB_APP_FALLBACK` 로그 = 정상 신호 ④ 에러율·DLQ 무변동(닫힘 증명).
- **§5 롤백**: 구 키로 3-secret 단일 커밋 복원 + ArgoCD sync + 3서비스 rollout restart.
- **§6 사후 조치**: 평문 키 삭제, 로테이션 기록 테이블.
- **§7 관련 문서**: key-rotation.md, github-token-relink.md, sealed-secrets-template.yaml, ADR-030.
- **Critic R1 P2**: §3-4(ArgoCD sync 후) 명시적 `kubectl rollout restart deployment/{gateway,github-worker,identity-service} -n algosu` + rollout status 3종 추가 — SealedSecret 갱신은 pod 자동 재시작을 보장하지 않음을 본문에 명기.

### Q-3 — `dlq-redrive.md` 신규 작성 (Postman) + Critic R1 수정

- **근거 파일 직접 Read**: `services/submission/src/saga/mq-publisher.service.ts:72-105`(DLQ 토폴로지 선언), `services/github-worker/src/worker.ts:174-180,200,269`(DLQ NACK + reason 라벨), `services/ai-analysis/src/worker.py:149-156,316,370,384`(DLQ NACK + reason), `docs/runbook/oncall-alerts.md:103-111`(DLQReceived).
- **§0 배경·토폴로지**: `submission.events`(topic) → `submission.github_push` / `submission.ai_analysis`, NACK(requeue=false) → `submission.events.dlx` → `submission.github_push.dlq`(routing `github.push.dead`) / `submission.ai_analysis.dlq`(routing `ai.analysis.dead`). reason 5종 표: `parse_error`/`process_failure`(양 워커), `circuit_breaker_exhausted`/`rate_limit_exhausted`(ai-analysis), `token_invalid`(github-worker).
- **§1 redrive 전 필수 게이트**: 근본 원인 제거 선행. reason별 분기 — `parse_error`는 publisher(submission) 스키마 결함이라 redrive 무의미·재실패, `process_failure`는 다운스트림 복구 확인 후, `circuit_breaker_exhausted`·`rate_limit_exhausted`는 CB CLOSED·rate 정상화 확인 후.
- **§2 DLQ 조회**: kubectl exec + rabbitmqctl로 큐 depth/메시지 peek. management plugin 여부 사전 확인 단계 포함.
- **§3 redrive 절차**: 권장 = **dynamic shovel**(DLQ → 원본 exchange + routing key, 메시지 유실 없음, 완료 후 shovel 삭제) / 대안 = rabbitmqadmin 수동 루프(소량일 때). 워커별 정확한 exchange·routing key 명기.
- **§3 방법 B Critic R1 P2 수정**: 초기 방법 B는 `ackmode=ack_requeue_false`로 소비 후 `grep -oP` payload 추출 방식 — ①`--format=json` 미지정 파싱 불안정 ②이스케이프 따옴표에서 payload 잘림→잘린 채 재발행+원본 영구 유실 위험. **peek→검증→재발행→소비 순서로 재구성**: `ack_requeue_true --format=json | jq -r '.[0].payload'`로 안전 추출 → `jq -e '.submissionId'`로 JSON 유효성 검증 → 재발행 성공 확인 후에만 `ack_requeue_false`로 원본 제거. 방법 B 유실 위험 주의문 강화.
- **§4 멱등성·중복 주의**: github-worker redis `ghw:processed:{submissionId}` TTL 1시간 — 1시간 이내 redrive면 중복 자동 skip, 이후엔 GitHub 재push 발생 가능. ai-analysis는 멱등성 없음(결과 덮어쓰기로 수용).
- **§5 검증**: DLQ depth 0 + 워커 처리 로그 + `dlq_messages_total` 증분 없음 + 제출 상태 전이 확인.
- **§6 자동화 판단 기준**: 월 N회 초과 시 redrive 자동화 검토 임계 명기. ADR-030 "발생 빈도 확인 후"를 런북 수준으로 구체화.
- **§7 관련 문서**: oncall-alerts.md, mq-publisher.service.ts, github-token-relink.md, ADR-030.

### 인덱스·cross-ref 갱신 (Scribe)

- `docs/runbook/README.md`: GitHub/인증 4→5(encryption-key-rotation 추가), 관측성/모니터링 2→3(dlq-redrive 추가).
- `docs/README.md`: 운영 런북 21개→23개, 양 영역 테이블 항목 추가.
- `docs/runbook/oncall-alerts.md`: DLQReceived 대응 "수동/배치 재처리" → `dlq-redrive.md` 참조로 교체 (근본 원인 제거 선행 필수 명기).
- `docs/runbook/key-rotation.md`: `GITHUB_TOKEN_ENCRYPTION_KEY` 항에 `encryption-key-rotation.md` cross-ref 주석 추가.
- `docs/adr/ADR-030-security-improvement-backlog.md` (+EN): S-6/Q-3 배정 행 → `Sprint 240 ✅`, 로드맵 표 Sprint 240 행 → ✅.
- `docs/adr/README.md`: 회고형 sprint ADR 177개→178개, Sprint 62~239 → 62~240.

## 핵심 결정

1. **듀얼 키 로테이션 = 기존 토큰 무효화이지만 서비스 무중단**: `worker.ts` fallback 경로(GitHub App Installation Token)가 복호화 실패를 자동 흡수한다. 런북은 이를 "예상 동작"으로 정직하게 명기했다 — "로테이션 후 `GITHUB_APP_FALLBACK` 로그 = 정상 신호". 이 사실이 없었다면 로테이션을 긴급 조치로 잘못 분류했을 것.
2. **2-Secret 단일 커밋 원칙과 Sprint 236 2-commit ordering의 구분**: Sprint 236은 신규 secret 추가(부재 시 pod 마운트 실패)→2-commit. 이번은 기존 secret 교체 → 단일 커밋으로 불일치 윈도우 최소화가 올바른 원칙. 상황별 커밋 전략이 다름을 런북에 명기해 재오판 차단.
3. **DLQ redrive는 근본 원인 제거 선행이 전제조건**: `parse_error`는 publisher 스키마 결함이라 redrive하면 즉시 재실패 → redrive 무의미. reason별 분기를 §1에서 명시적으로 나눠 "무조건 redrive" 오퍼레이션 패턴을 차단.
4. **동적 shovel 권장 + rabbitmqadmin 대안의 구분 기준**: shovel은 메시지 유실 없이 원자적 이동이 목표(대량 포함). rabbitmqadmin 수동 루프는 소량 디버그용. 자동화는 월 N회 초과 임계를 §6에 명기해 ADR-030 "발생 빈도 확인 후" 결정 기준을 운영 가시화.
5. **docs-only 스프린트도 Critic 대상**: 런북의 명령 정확성(exchange/routing key/secret 키 이름)은 코드 변경만큼 실수 위험이 높다 — Critic이 명령 정합을 교차 리뷰.

## 검증

- ADR 게이트 5종 (`node scripts/check-adr-index.mjs` 등) PASS: index 178 / EN 188/188 / links 0 / doc-refs / conversion.
- `node scripts/check-doc-refs.mjs` (doc-ref-lint): 신규 런북 2종의 cross-ref 링크 유효, 0 오류.
- 런북 명령 정합 수동 대조: exchange/queue/routing key 이름을 `mq-publisher.service.ts:72-105` 선언부와 대조, SealedSecret 키 이름을 `sealed-secrets-template.yaml:58,164`와 대조 — 일치 확인.
- Critic 교차 리뷰 (Codex, `--base 924c650`): **R1 발견 → 수정 반영**
  - **[P1] S-6 identity 서비스 누락**: Oracle이 코드로 확정 검증(`token-encryption.service.ts:28-34` 부팅 throw, `user.service.ts:136` 암호화) → 2-secret→3-secret 전면 수정 + `sealed-secrets-template.yaml` identity-service-secrets에 `GITHUB_TOKEN_ENCRYPTION_KEY` 추가(템플릿 드리프트 해소).
  - **[P2] S-6 SealedSecret 갱신 후 rollout restart 누락**: §3 ArgoCD sync 후 `kubectl rollout restart deployment/{gateway,github-worker,identity-service}` + rollout status 3종 추가, SealedSecret 갱신은 pod 자동 재시작을 보장하지 않음 명기.
  - **[P2] Q-3 방법 B 메시지 유실 위험**: peek→검증→재발행→소비 순서로 재구성, `ack_requeue_true --format=json | jq`로 안전 추출, 재발행 성공 후에만 `ack_requeue_false` 원본 제거.
- 변경 파일: `docs/runbook/encryption-key-rotation.md`, `docs/runbook/dlq-redrive.md`, `infra/sealed-secrets/sealed-secrets-template.yaml`, `docs/adr/sprints/sprint-240.md`, `docs/adr-en/sprints/sprint-240.md`.

## 교훈

1. **런북의 핵심은 "예상 동작"과 "오류"의 구분**: S-6에서 `GITHUB_APP_FALLBACK` 로그를 "정상 신호"로 명기하지 않으면 운영자가 로테이션 후 fallback 로그를 보고 장애로 오판한다. 런북은 예상 동작 경로를 명시적으로 기술해야 한다.
2. **유사해 보이는 커밋 전략도 상황별로 다르다**: 신규 secret 추가(Sprint 236 2-commit)와 기존 secret 교체(Sprint 240 단일 커밋)는 근거 논리가 반대다. 유사 패턴을 그대로 적용하면 오히려 리스크를 높인다.
3. **DLQ 근본 원인 제거 선행은 절차서 §1이어야 한다**: "redrive 방법" 앞에 "언제 redrive하면 안 되는가"가 먼저 나와야 오퍼레이션 오류를 막는다. 절차서는 How보다 When이 우선.
4. **docs-only 스프린트는 게이트가 간소하지만 Critic 교차 리뷰는 동등하게 적용**: 코드 없이도 exchange 이름·routing key·secret 키 이름이 틀리면 운영 장애로 이어진다.

5. **런북 리뷰에서 키 사용처 전수는 코드 grep으로 닫아야 한다**: S-6 초기 작성 시 플랜의 "탐색 결과 핵심 사실"에 identity 사용처가 명기돼 있었음에도 런북에서 2곳(gateway+github-worker)으로 오판 — 코드를 grep하거나 직접 Read하지 않고 "암호화=gateway, 복호화=github-worker" 도식적 가정을 적용한 결과. 키 사용처 가정은 `grep -r GITHUB_TOKEN_ENCRYPTION_KEY services/` 한 번으로 3곳 실측 가능. **런북에서 "몇 곳에 적용되는 Secret인가"는 반드시 코드 grep으로 확인 후 명기해야 한다**.

신규패턴: **예상 동작 명기 런북 패턴**(fallback 경로·복호화 실패를 "정상 신호"로 명시), **근본 원인 선행 게이트 패턴**(redrive §1에 reason별 "redrive 해도 되는 조건" 분기), **키 사용처 코드 grep 확인 패턴**(Secret 영향 범위는 도식 가정이 아닌 실측으로 닫기).

## 이월

- Sprint 241 확정: Q-1(BE) study.service 도메인 분리, Q-2 saga-orchestrator helper 분리 — ADR-030 §결정 로드맵.
- /api/events ThrottlerGuard 부착 여부 (백로그, Sprint 239 이월).
- 기존 이월: 하네스 점검 별도 슬롯 · GA4 콘솔 3건 · 라이브 SEO · 하네스 cron · webhook regenerate · 누적 UAT · 블로그 후속 소재(CS 퀴즈/지운 것들/zstd).
