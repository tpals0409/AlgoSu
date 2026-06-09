<!--
@file docs/runbook/alert-channel-separation.md
@domain observability
@layer runbook
@related aether-gitops algosu/base/monitoring/alertmanager.yaml, infra/sealed-secrets/sealed-secrets-template.yaml, docs/runbook/oncall-alerts.md, docs/adr/sprints/sprint-235.md, docs/adr/ADR-029-infra-ssot-consolidation.md
-->

# 알림 채널 critical/일반 분리 적용 런북 (Sprint 235)

> 운영 알림을 **critical 채널**과 **일반 채널**로 분리하여 라이브에 적용하는 서버측 절차.
> 실 Discord 채널 생성·webhook seal·aether-gitops 적용은 본 런북을 따른다.
> ⚠️ **ADR-029로 AlgoSu `infra/k3s/` 미러는 폐기됨** — 매니페스트 SSOT는 **aether-gitops**(`algosu/base/monitoring/`)가 유일하다. 본문에 남은 `infra/k3s/monitoring/...` 경로 참조는 Sprint 235 당시 기록으로, 현재는 aether-gitops 동일 경로로 대체해 읽을 것.

---

## §0 배경

기존엔 alertmanager가 `identity-discord-secret`(Identity **feedback 전용** webhook)을 재사용해, 운영 알림과 사용자 피드백이 **같은 Discord 채널에 혼재**했다(Sprint 130 B-1 향후 과제).

Sprint 235 — **critical/일반 2채널 분리**:

| receiver | severity | 채널 | secret key |
|----------|----------|------|------------|
| `discord-default` | warning 이하 | 운영 알림 '일반' | `webhook-url` |
| `discord-critical` | critical (`@here`) | 운영 알림 'critical' | `webhook-url-critical` |

새 secret: `alertmanager-discord-secret`(2키). 미러는 이미 이 secret을 참조하도록 변경됨(`alertmanager.yaml`). ✅ **Sprint 236에서 aether-gitops에 라이브 적용 완료 — 드리프트 해소**(상세: `docs/adr/sprints/sprint-236.md`).

---

## §1 사전 준비

- [ ] `kubeseal` CLI 설치 (`brew install kubeseal` / `apt install kubeseal`)
- [ ] aether-gitops 레포 접근 권한 (push)
- [ ] Discord 서버 관리자 권한 (채널/webhook 생성)
- [ ] sealed-secrets controller namespace 확인 (`kube-system`)

---

## §2 Discord 채널 2개 + webhook 2개 생성

1. Discord 서버에서 채널 2개 생성 (예: `#algosu-alerts`, `#algosu-alerts-critical`).
2. 각 채널 → **편집 → 연동(Integrations) → 웹후크(Webhooks) → 새 웹후크** → URL 복사.
   - 일반 채널 webhook URL → `webhook-url`로 사용
   - critical 채널 webhook URL → `webhook-url-critical`로 사용
3. ⚠️ webhook URL은 시크릿 — 평문 commit/로그 금지. 아래 seal까지 로컬에만 보관.

> alertmanager discord_configs는 webhook URL 끝에 `/slack` suffix가 **불필요**(native discord webhook URL 그대로). v0.28.1 `webhook_url_file` 사용.

---

## §3 alertmanager-discord-secret 봉인 (kubeseal)

> 전체 키를 모두 포함해야 한다. 누락 시 기존 키가 사라진다.

```bash
kubectl create secret generic alertmanager-discord-secret \
  --namespace=algosu \
  --from-literal=webhook-url="<일반 채널 webhook URL>" \
  --from-literal=webhook-url-critical="<critical 채널 webhook URL>" \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace kube-system -o yaml \
  > sealed-alertmanager-discord-secret.yaml
```

---

## §4 aether-gitops 적용 (GitOps)

> 원칙(gitops-migration.md §2): **추가 → 검증 → 전환**. 리소스 부재 구간이 없어야 한다.

1. **SealedSecret 추가**:
   ```bash
   cd aether-gitops
   cp sealed-alertmanager-discord-secret.yaml algosu/base/monitoring/sealed-alertmanager-discord-secret.yaml
   # kustomization.yaml resources에 등록
   ```
2. **alertmanager 매니페스트 정합** — aether-gitops의 `alertmanager.yaml`을 AlgoSu 미러(`infra/k3s/monitoring/alertmanager.yaml`)와 동일하게:
   - secret 볼륨 `secretName: alertmanager-discord-secret`, items 2키(`webhook-url`, `webhook-url-critical`)
   - `discord-critical.webhook_url_file: /etc/alertmanager/secrets/webhook-url-critical`
3. **commit + push**:
   ```bash
   git add -A && git commit -m "feat(monitoring): alert 채널 critical/일반 분리 (alertmanager-discord-secret)"
   git push origin main
   ```
4. **ArgoCD sync** — automated sync면 자동. 수동이면 `argocd app sync <app>`.

---

## §5 검증 (발화 → Discord 도달, end-to-end)

> Sprint 231 교훈: **rule 존재 ≠ 전송**. 실제 도달까지 확인한다.

1. **secret 마운트 확인** (read-only):
   ```bash
   kubectl get secret alertmanager-discord-secret -n algosu   # 2키 존재
   kubectl exec -n algosu deploy/alertmanager -- ls /etc/alertmanager/secrets/
   # webhook-url, webhook-url-critical 둘 다 보여야 함
   ```
2. **Alertmanager config 로드 확인**: `:9093/#/status` → receivers에 discord-default/discord-critical, 각 webhook_url_file 경로 정합.
3. **테스트 알림 발화** — amtool 또는 임시 alert:
   ```bash
   # critical 경로 (→ critical 채널, @here)
   amtool alert add TestCriticalAlert severity=critical namespace=algosu \
     --alertmanager.url=http://localhost:9093 \
     --annotation=summary="채널 분리 검증(critical)"
   # 일반 경로 (→ 일반 채널)
   amtool alert add TestWarningAlert severity=warning namespace=algosu \
     --alertmanager.url=http://localhost:9093 \
     --annotation=summary="채널 분리 검증(일반)"
   ```
4. **양 채널 도달 확인**: critical 메시지는 critical 채널(@here), warning 메시지는 일반 채널에 도착. **교차 도달(엉뚱한 채널) 없어야 함**.
5. **resolve 확인**: `send_resolved: true`라 alert 해소 시 `[RESOLVED]` 메시지도 같은 채널에.
6. **feedback 채널 격리 확인**: Identity feedback 메시지가 더 이상 운영 알림 채널에 섞이지 않는지(별 채널 유지).

---

## §6 적용 후 정합 (드리프트 해소) — ✅ Sprint 236 완료

- ✅ **Sprint 236 라이브 적용 완료** (aether-gitops `9f7680b` SealedSecret 추가 → secret 실재 게이트 → `842b93d` alertmanager 매니페스트 교체, ArgoCD Synced/Healthy). 미러 배너 드리프트 해소 표기 갱신(`sealed-secrets-template.yaml`) + 본 ADR(`docs/adr/sprints/sprint-236.md`) 기록 완료. (alertmanager.yaml 미러는 ADR-029로 폐기 → SSOT는 aether-gitops 단일.)
- `identity-discord-secret`은 Identity feedback 용도로 계속 사용 — 삭제 금지(Sprint 236 검증에서 격리 확인).
- 롤백 필요 시: alertmanager 매니페스트 secretName을 이전 상태로 되돌리고 ArgoCD sync.

---

## §7 관련 문서

- 미러 매니페스트: `infra/k3s/monitoring/alertmanager.yaml`, `infra/sealed-secrets/sealed-secrets-template.yaml`
- 온콜 대응: `docs/runbook/oncall-alerts.md`
- GitOps 이관 원칙: `docs/runbook/gitops-migration.md`
- secret seal 패턴: `docs/runbook/key-rotation.md`
- 라이브 진단 권한: `docs/runbook/prod-readonly-kubeconfig.md`
