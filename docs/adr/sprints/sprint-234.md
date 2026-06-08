---
sprint: 234
title: "Grafana Service Debug no-data 수정 미러 정합 (cAdvisor scrape + Loki service 라벨)"
date: "2026-06-08"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-231", "sprint-232", "sprint-233"]
related_memory: ["sprint-window"]
topics: ["monitoring", "infra"]
tldr: "Grafana 'AlgoSu Service Debug' 대시보드의 3개 패널(Container CPU/Memory, Loki 로그 2종)이 라이브에서 no-data. 라이브 진단으로 두 근본 원인 확정: (A) Prometheus에 kubelet/cAdvisor scrape_config 부재 → container_* 메트릭 전체 미수집(0 시리즈). (B) 라이브 promtail이 service 라벨을 부여하는데 대시보드가 없는 pod 라벨을 참조 → 로그 패널 항상 0. 배포 SSOT인 aether-gitops에서 PR #8(+0a7156d) 머지·ArgoCD Synced·라이브 3종 검증 통과(container_* 75 시리즈, 로그 패널 스트림 표출)로 라이브 해결. 본 스프린트는 비배포 참조 미러 infra/k3s/monitoring을 라이브 최종 형태에 정합: prometheus-config에 kubernetes-cadvisor/nodes job(apiserver proxy 경유)+SA/ClusterRole/CRB, 대시보드 $service 변수값 Loki service 라벨 기준 통일·Loki 패널 service= 셀렉터·job=~ 12곳, promtail은 service 라벨 정합(Critic R1 P2). 게이트 check-grafana-metrics 통과. Critic R1 [P2](미러 promtail service 라벨 부재)→R2 CLEAN."
---
# Sprint 234 — Grafana Service Debug no-data 수정 미러 정합

## 목표

- 라이브 Grafana "AlgoSu Service Debug" 대시보드 3개 패널(Container CPU/Memory, Loki 로그 2종) no-data 근본 원인 규명 + 수정.
- 라이브(aether-gitops) 수정 완료 후, 비배포 참조 미러 `infra/k3s/monitoring`을 라이브 최종 형태에 정합해 드리프트 차단.

## 배경

- 사용자가 라이브 대시보드에서 CPU/Memory/Loki 3개 패널 no-data 보고. `infra/k3s`는 비배포 참조 미러이고 배포 SSOT는 aether-gitops(Sprint 232 확정) → 정적 매니페스트로 단정 금지, 라이브 진단 선행([[feedback-source-vs-live-drift]]).

## 근본 원인 (라이브 진단)

- **(A) cAdvisor 메트릭 미수집**: `container_cpu_usage_seconds_total` namespace 무관 전체 0 시리즈. 라이브 Prometheus도 전부 `static_configs` 방식이고 kubelet/cAdvisor/`role:node` 타겟 부재. kube-state-metrics는 `kube_*` 객체 상태만 제공(컨테이너 리소스 사용량 ≠). → 데이터 소스(수집) 결함.
- **(B) Loki 라벨 모델 불일치**: 로그는 정상 수집(`{namespace="algosu"}` 6 streams). 라이브 promtail은 `service` 라벨 부여(값: gateway/submission/problem/identity/ai-analysis/github-worker)인데 대시보드 셀렉터가 없는 `pod` 라벨 참조 → 항상 0. 변수값(submission-service)과 service 라벨값(submission)도 불일치. → 대시보드 쿼리 결함.

## 핵심 결정

1. **라이브 우선 수정(aether-gitops PR #8)**: (A) `kubernetes-cadvisor`/`kubernetes-nodes` job(apiserver proxy `/api/v1/nodes/${node}/proxy/metrics[/cadvisor]`) + prometheus SA/ClusterRole(nodes/nodes-metrics/nodes-proxy + nonResourceURLs)/CRB. (B) 대시보드 $service 변수값을 Loki service 라벨값으로 통일하고 패널별 셀렉터 매핑: Loki `service="${service}"`, Prometheus `job=~"${service}.*"`(submission→submission-service prefix 매칭), cAdvisor/KSM `pod=~"${service}.*"` 유지.
2. **id19 Error Logs 죽은 분기 차단(Critic, 라이브 PR)**: 서버 초안 `|= "error" | json | level=~"error|fatal|CRITICAL"`는 Sprint 231이 제거한 죽은 분기 재도입(promtail이 level 라벨 승격→json 재파싱 불필요·level_extracted 충돌, fatal/CRITICAL 미출력, `|=` 본문 우연 매칭) → `service="${service}", level="error"` level 라벨 직접 필터로 교정. 라이브 level 값 = debug/error/info/warn로 죽은 분기 실측 확정.
3. **미러 정합 범위(본 스프린트)**: 게이트 `check-grafana-metrics.mjs`는 `ALWAYS_AUTO_LABELS`(service/pod/job 포함)로 Loki 셀렉터·container_* 패널을 silent skip → promtail 정합은 게이트상 불필요. 그러나 Critic R1 P2(미러 내부 정합: 대시보드 service= ↔ promtail service 라벨 부재)를 반영해 promtail도 라이브 라벨 모델로 정합.

## 작업 요약 (start `9f844db`, 3 commit)

- `6a47973`: `fix(infra)` prometheus-config cadvisor/nodes job + SA/ClusterRole/CRB + serviceAccountName / grafana-service-dashboard 변수단축·Loki service=·job=~ 12곳·헤더 주석 / promtail 드리프트 배너.
- `ea54009`: `fix(infra)` 미러 promtail service 라벨 정합(Critic R1 P2) — JSON service 필드 추출·승격, pod/app/container 라벨 드롭(대시보드 service 전환으로 불필요+카디널리티 절감), 라벨셋 namespace+service+level+tag(4).
- ADR commit(본 문서) + README 171→172.

## 검증

- 치환 카운트: `job=~"${service}.*"` 12, 잔존 `pod=~"${service}.*"` 3(KSM/cAdvisor×2), Loki `service="${service}"` 2, 비정규식 `job="${service}"` 0.
- YAML 유효(3 파일) + 임베드 대시보드 JSON 파싱 OK(20 panels, uid algosu-service-debug), 변수값 [gateway,submission,problem,identity,ai-analysis,github-worker].
- promtail 라벨셋 namespace+service+level+tag = 4(≤5 가이드), service = SERVICE_NAME 단축형(전 서비스 grep 확정).
- 게이트 `check-grafana-metrics.mjs` 전 항목 [OK]. `check-prometheus-rules.mjs`는 rules.yaml(미수정) 검증이라 무영향.
- **라이브 실증(aether-gitops, 본 스프린트 선행)**: cadvisor/nodes 타겟 UP, `container_*{namespace=algosu}` 75 시리즈(이전 0), id18 gateway/problem/submission 2/2/2, id19 problem level=error 2.
- **Critic**(Codex gpt-5.5, `--base 9f844db`): R1 [P2] 미러 promtail service 라벨 부재 → `ea54009` 정합 → **R2 CLEAN**("no discrete regression... label changes consistent with service names emitted by structured loggers and metric job mappings").

## 교훈

1. **정적 미러로 런타임 결함 단정 금지, 라이브 진단 선행** — 비배포 미러(infra/k3s) vs 배포 SSOT(aether-gitops) 드리프트 상존. 두 근본 원인 모두 라이브 실측으로 확정([[feedback-source-vs-live-drift]]).
2. **`container_*`는 cAdvisor(kubelet) 출처 — kube-state-metrics ≠** — KSM은 `kube_*` 객체 상태만 제공. CPU/Memory no-data는 kubelet/cAdvisor scrape_config(apiserver proxy 경유) 부재가 흔한 원인.
3. **대시보드 변수가 다중 라벨 차원에 매핑될 때 단일 value로 통일 + 정규식 prefix 매칭** — $service를 Loki service 라벨값으로 통일하고 Prometheus는 `job=~"x.*"`, pod는 `pod=~"x.*"`로 흡수(submission↔submission-service 불일치 해소).
4. **미러 정합은 게이트 통과로 끝나지 않는다 — 내부 일관성(Critic)** — 게이트는 service/pod를 auto-label로 skip하나, 대시보드 service= ↔ promtail 라벨 생산자 부재는 적용 시 공백. 미러도 라이브 라벨 모델(service 승격)로 정합해야 완결.
5. **id19 죽은 분기 회귀 방지** — Sprint 231 교훈(level 라벨 직접 필터 > json 재파싱)을 라이브 PR 리뷰에서 재적용, fatal/CRITICAL 미출력을 라이브 level 값으로 실증.

신규패턴: **라이브 선수정 → 미러 후정합 패턴**(배포 SSOT 라이브 검증 후 비배포 미러를 동일 형태로 정합, 게이트+Critic 내부 일관성 이중 확인).

## 이월

- **(서버) promtail discovery 정합**: 미러는 kubernetes_sd(role:pod), 라이브는 static_configs(파일경로 __path__) — 라벨 출력은 동일(namespace+service+level+tag)하나 discovery 메커니즘 상이. 라이브 promtail-config 전문 확보 시 discovery 형태까지 정합(현재 배너 명기).
- (기존 이월) ADR-028 SA 적용·토큰 발급 · loki prod 하드닝 갭 · Sprint 230 롤아웃 확인 · 라이브 /quiz 검증 · SP217 컷오버 · GA4 · problem_db · 하네스 cron.
