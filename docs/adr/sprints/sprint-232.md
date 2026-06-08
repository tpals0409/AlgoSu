---
sprint: 232
title: "alertmanager 미러 드리프트 정정 + Sprint 231 문서 ERRATA (infra/k3s ≠ 배포 SSOT)"
date: "2026-06-08"
status: completed
agents: [Oracle, Postman, Librarian, Critic]
related_adrs: ["sprint-231", "sprint-130"]
related_memory: ["sprint-window", "feedback-source-vs-live-drift"]
topics: ["observability", "monitoring", "alerting", "infra", "gitops"]
tldr: "Sprint 231의 핵심 결론('alertmanager receiver:null → 17규칙 전부 드롭/6일 무알림')이 서버 라이브 진단으로 오판으로 판명. 근본 원인: AlgoSu infra/k3s/는 배포되지 않는 참조 미러이고 실제 배포 SSOT는 aether-gitops(algosu/base/monitoring + overlays/prod)다. AlgoSu CI는 aether-gitops에 이미지 태그만 bump하고 매니페스트는 전파하지 않으며, ArgoCD(automated·selfHeal·Synced)는 aether-gitops만 본다. Sprint 231은 이 비배포 미러의 구버전(receiver:null)을 배포본으로 오독했다. 라이브 alertmanager는 Sprint 130 B-1로 이미 정상(alertmanager-native discord-default+discord-critical, identity-discord-secret/webhook-url, v0.28.1). 게다가 Sprint 231이 미러에 넣은 monitoring-secrets/discord_webhook + v0.27.0 + webhook_url_file은 v0.27.0이 file-webhook 미지원이라 작동불가 설정이었다. 실제 '로그 미수집' 원인은 Loki OOM(512Mi 한도, 5일 주기 spike)으로, 서버에서 aether-gitops PR #7로 512Mi→1Gi 상향·검증 완료(C). 본 스프린트: A-lite AlgoSu alertmanager 미러를 라이브로 정정(v0.28.1 + discord-default/critical + identity-discord-secret/webhook-url + 비배포 배너) + sealed-secrets placeholder 제거, B Sprint 231 ADR/런북 ERRATA, B+ loki probe/securityContext 라이브 갭 시드. 배포 무영향(미러·문서 정합 회복). Critic R1 CLEAN. 교훈: 정적 매니페스트(특히 비배포 미러)로 런타임 결함 단정 금지(feedback-source-vs-live-drift)."
---
# Sprint 232 — alertmanager 미러 드리프트 정정 + Sprint 231 문서 ERRATA

## 목표

- Sprint 231(모니터링 전수 조사)의 **오판**을 서버 라이브 진단 근거로 정정한다.
- AlgoSu `infra/k3s/` 미러를 라이브(aether-gitops) 구성에 정합시키고, 오판을 유발한 구조(`infra/k3s` ≠ 배포 SSOT)를 문서에 명문화한다.

## 배경

- Sprint 231은 `infra/k3s/monitoring/alertmanager.yaml`의 `receiver: 'null'`을 보고 "17개 알림 규칙이 전부 드롭, 6일 무알림"을 **확정 결함**으로 단언하고, Discord receiver를 "실배선"했다.
- 사용자가 서버에서 라이브를 직접 진단한 결과 이 결론이 **오류**임이 드러났다.

## 근본 원인 (서버 진단으로 확정)

1. **AlgoSu `infra/k3s/`는 배포되지 않는 참조 미러**다. 실제 배포 SSOT는 **aether-gitops**(`algosu/base/monitoring/` + `overlays/prod`). AlgoSu CI(`ci.yml:1073+`)는 aether-gitops에 **이미지 태그만** bump하고 매니페스트는 전파하지 않는다. ArgoCD(automated·selfHeal·Synced)는 aether-gitops만 본다.
2. Sprint 231이 읽은 `receiver: 'null'`은 **비배포 미러의 구버전 스냅샷**이었다. 라이브 alertmanager는 **Sprint 130 B-1로 이미 정상** — alertmanager-native `discord-default` + `discord-critical`(severity 라우팅, repeat 30m), `webhook_url_file`로 `identity-discord-secret/webhook-url` 참조(`optional: false`), image v0.28.1.
3. Sprint 231이 미러에 넣은 "수정"(`monitoring-secrets/discord_webhook` + v0.27.0 유지 + `webhook_url_file`)은 **v0.27.0이 file-기반 discord webhook 미지원**이라 작동불가 설정 — 미러를 라이브에서 더 멀어지게 만들었다.
4. 실제 "로그 미수집" 원인은 파이프라인이 아니라 **Loki OOM**(limit 512Mi, restartCount 17, 마지막 OOMKilled 2026-05-18, 5일 주기 spike 초과).

## 핵심 결정

1. **미러 역할 = 참조 격하 + 깨진 부분만 정정**(완전 미러 동기화는 솔로·Free Tier에서 부담 대비 가치 없음). 비배포 배너로 재오판 차단.
2. **A-lite**: AlgoSu `alertmanager.yaml`을 라이브 매니페스트로 교체(v0.28.1 + discord-default/critical + identity-discord-secret/webhook-url + optional:false), sealed-secrets `ALERTMANAGER_DISCORD_WEBHOOK` placeholder 제거(기존 secret 재사용). **배포 무영향**(ArgoCD가 infra/k3s 미참조).
3. **B**: Sprint 231 ADR/런북은 역사 기록이므로 본문 보존 + 상단 **ERRATA 블록**으로 사실 교정.
4. **C**(서버 완료): Loki OOM 하드닝은 aether-gitops PR #7(`5b07bf6`)로 512Mi→1Gi / 128Mi→256Mi req, 검증 완료(loki Running·OOM 재발 없음, 노드 여유 충분).

## 작업 요약 (start `e5f1046` → squash `cc92924`, PR #401)

- `e080ff1` **fix(infra)**: alertmanager.yaml 라이브 정합(v0.28.1·discord-default/critical·identity-discord-secret/webhook-url optional:false·title/message 템플릿) + 비배포 배너 헤더 + sealed-secrets placeholder 제거.
- `6c4a55f` **docs**: runbook §0 ERRATA + §1.2/§4-A/B/C 사실 교정(미러≠배포소스·알림 라이브 정상·Loki OOM 실원인·loki 하드닝 갭 D1 시드) + ADR sprint-231 KR+EN 상단 ERRATA 블록.

## 검증

- alertmanager.yaml YAML 유효(3 docs, route discord-default + critical 라우트, secret identity-discord-secret/webhook-url optional:false, image v0.28.1) · `check-grafana-metrics.mjs` exit 0.
- ADR 게이트 4종(index 170·adr-en·links 0·doc-refs 0) + adr-conversion OK.
- **Critic**(Codex gpt-5.5, `codex review --base e5f1046`): **R1 CLEAN**("changes mainly align the reference Alertmanager manifest and documentation with the stated live configuration. I did not find any introduced functional issue").
- CI #401: `Secret & Env Scan` 1회 실패(gitleaks 다운로드 504 플레이크) → 재실행 통과 → autoMerge SQUASH. 전 게이트(특히 `Quality — monitoring` BLOCKING) green.

## 교훈

1. **정적 매니페스트(특히 비배포 미러)로 런타임 결함을 단정하지 말 것** — Sprint 231이 비배포 `infra/k3s/` 미러를 배포본으로 오독해 존재하지 않는 "무알림 결함"을 단정하고, 오히려 작동불가 설정을 추가했다. 런타임 주장은 라이브(aether-gitops/클러스터) 검증 필수. [[feedback-source-vs-live-drift]]
2. **배포 토폴로지를 먼저 확인** — AlgoSu repo의 `infra/k3s/`는 참조 미러, 배포 SSOT는 aether-gitops(CI는 이미지 태그만 전파). 어느 매니페스트가 실제 배포되는지 모르면 모든 인프라 분석이 틀릴 수 있다.
3. **이미 머지된 오판은 역사 보존 + ERRATA로 정정** — ADR 본문을 지우지 않고 상단 정정 블록으로 사실을 덮어써, 기록의 추적성과 정확성을 동시에 유지.
4. **드리프트 정정은 "참조 격하"가 현실적** — 완전 미러 동기화 대신 비배포 배너 + 깨진 부분만 정정으로 재오판을 막고 유지 부담을 피한다.

## 이월

- **(서버) B+ loki prod 하드닝 갭 검증**: AlgoSu 미러 loki엔 probe/securityContext가 있으나 라이브 덤프엔 부재 → 라이브 실재 여부 확인 후 없으면 aether-gitops에 추가(런북 §4-D1).
- **(서버) ADR-028 read-only ServiceAccount/kubeconfig 구현**: cluster-admin 복사 금지 결정의 첫 구현(`prod-diag-readonly` SA + 단기 토큰). 서버에서 GitOps 적용.
- (기존 이월 유지) Discord webhook seal 불필요(라이브 동작) · Sprint 230 롤아웃 확인 · 라이브 /quiz 검증 · SP217 컷오버 · GA4 · problem_db · 하네스 cron.
