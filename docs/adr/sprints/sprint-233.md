---
sprint: 233
title: "CI 스캐너 설치 하드닝 (재시도+인증+직접 다운로드) + ADR-028 read-only kubeconfig 그라운드워크"
date: "2026-06-08"
status: completed
agents: [Oracle, Postman, Librarian, Critic]
related_adrs: ["sprint-232", "sprint-225"]
related_memory: ["sprint-window"]
topics: ["ci", "infra", "security"]
tldr: "Sprint 232 머지 후 main CI가 #401·#402·#403 post-merge run에서 반복 red. 근본 원인: CI 스캐너 설치 단계가 GitHub releases를 비인증·무재시도로 다운로드. ①Trivy(ci.yml) install.sh가 비인증/release-page로 태그 조회 → GitHub releases 간헐 장애(504) 시 'unable to find v0.69.2' 실패 → trivy 미설치 → scan exit 127. ②gitleaks CDN 504. ③promtool 동일 위험. 1차(#403): 세 단계 3회 재시도 + Trivy env GITHUB_TOKEN + set -o pipefail(curl 실패가 sh/tar exit 0에 가려지는 것 방지, Critic R1 P2). 2차(#404): GITHUB_TOKEN으로 태그 조회는 성공했으나 release-page 조회가 GitHub 불안정에 여전히 종속(간헐 'unable to find') → install.sh 태그 조회 단계를 제거하고 고정 에셋 trivy_0.69.2_Linux-64bit.tar.gz 직접 다운로드(gitleaks/promtool과 동일)로 전환 + 재시도 3→5회·백오프 i*5→i*10s. 라이브 검증: post-merge main run 35 success/0 failure(gitleaks + Trivy 8개 전부 green). 부가(#403): docs/runbook/prod-readonly-kubeconfig.md 신규(ADR-028 첫 구현 — prod-diag-readonly SA + 단기 토큰 kubeconfig 절차서, Critic R2 P1로 네임스페이스 Role+RoleBinding 한정) + ADR-028 status 구현 착수 반영. Critic #403 R1 P2→R2 P1→R3 CLEAN, #404 R1 CLEAN."
---
# Sprint 233 — CI 스캐너 설치 하드닝 + ADR-028 read-only kubeconfig 그라운드워크

## 목표

- Sprint 232 머지 후 반복된 main CI post-merge red(#401·#402·#403)의 근본 원인을 제거한다.
- 부가로 ADR-028(운영 직접 수정 차단)의 read-only kubeconfig 구현 그라운드워크(절차서·매니페스트)를 산출한다.

## 배경

- #401·#402·#403 post-merge run이 `Secret & Env Scan`(gitleaks) / `Trivy Scan`에서 반복 실패. PR 체크는 통과(머지됨)했으나 main CI red 양산 + Trivy는 deploy gate 입력.

## 근본 원인

- **CI 스캐너 설치 단계가 GitHub releases를 비인증·무재시도로 다운로드**:
  - **Trivy**(`ci.yml`): `curl install.sh | sh -s -- v0.69.2` — install.sh가 GitHub release-page로 태그를 조회. GitHub releases 간헐 장애(504) 시 `unable to find 'v0.69.2'`(exit 1) → trivy 미설치 → scan exit 127. (Sprint 225에서도 Trivy blog 유사 패턴 — 그땐 apk_bust 캐시였고, 이번은 설치 다운로드.)
  - **gitleaks**(`ci.yml`): GitHub releases 에셋을 재시도 없이 `curl | tar` → CDN 504.
  - **promtool**: 동일 패턴(미실패이나 동일 위험).

## 핵심 결정

1. **1차(#403)**: 세 설치 단계에 3회 재시도 래퍼 + Trivy `env GITHUB_TOKEN`(install.sh 인증) + `set -o pipefail`. → pipefail 없으면 `curl | sh`에서 curl 실패가 sh의 exit 0에 가려져 재시도 없이 break(Critic R1 P2).
2. **2차(#404, 근본책)**: GITHUB_TOKEN으로 태그 조회는 성공(`found version`)했으나 **release-page 조회 자체가 GitHub 불안정에 종속**(간헐 `unable to find`). → **install.sh 태그 조회 단계를 제거하고 고정 바이너리 에셋(`trivy_0.69.2_Linux-64bit.tar.gz`)을 직접 다운로드**(gitleaks/promtool과 동일 검증된 방식). 재시도 3→5회, 백오프 i*5→i*10s(다분 GitHub 장애 흡수).
3. **read-only kubeconfig는 절차서로 산출**(서버 실행). ADR-028 read-only 프로파일(get/describe/logs/exec 허용, 변경 차단) 정렬. 네임스페이스 한정 권한은 algosu Role+RoleBinding으로, 클러스터 스코프 읽기만 ClusterRole(Critic R2 P1).

## 작업 요약 (start `aba594f`, PR #403·#404)

- `1657308`(#403): `fix(ci)` 세 설치 단계 재시도+Trivy GITHUB_TOKEN+pipefail / `docs(runbook)` prod-readonly-kubeconfig.md 신규 + ADR-028 status 갱신 / Critic R1 P2(pipefail)·R2 P1(네임스페이스 한정) 수정.
- `cf9b4ae`(#404): `fix(ci)` Trivy install.sh 태그 조회 제거 → 고정 에셋 직접 다운로드 + 재시도 5회 확대.

## 검증

- ci.yml YAML 유효(23 jobs), `install.sh` 의존 제거, 에셋 직접 접근 HTTP 200(외부 확인).
- 런북 매니페스트 멀티닥 유효(ServiceAccount+Role+RoleBinding+ClusterRole+ClusterRoleBinding) · ADR 게이트 4종(index 171·adr-en·links 0·doc-refs 0)+conversion OK.
- **Critic**(Codex gpt-5.5): #403 R1 [P2] pipefail → R2 [P1] 네임스페이스 한정 → R3 CLEAN / #404 R1 CLEAN.
- **라이브 실증**: post-merge main run(`cf9b4ae`) **35 success / 13 skipped / 0 failure** — `Secret & Env Scan`(gitleaks) + `Trivy Scan — {8 서비스}` 전부 green. 반복 red 해소 확인.

## 교훈

1. **CI 외부 의존(스캐너 바이너리)은 재시도 + 인증 + 안정 다운로드 경로가 필수** — GitHub releases는 간헐 504/rate-limit이 잦다. "한 번 통과했으니 OK"가 아니라 재발성 red는 구조적 결함 신호(Sprint 225 교훈 재확인).
2. **`curl | sh`/`curl | tar` 파이프는 `set -o pipefail` 없으면 curl 실패를 삼킨다** — 특히 `sh`는 빈 stdin에 exit 0(Critic R1 P2). 재시도 래퍼는 pipefail과 함께라야 동작.
3. **install.sh류 "태그 조회 후 설치" 스크립트는 release-page/API 조회가 약점** — 버전을 알면 고정 에셋을 직접 다운로드하는 편이 GitHub 불안정에 강건(인증으로도 release-page 조회는 구제 못 함).
4. **read-only SA는 ClusterRoleBinding로 묶으면 전 네임스페이스 권한** — 네임스페이스 한정 권한(exec/logs 포함)은 Role+RoleBinding으로, 진짜 클러스터 스코프(nodes/namespaces/PV)만 ClusterRole로 분리해야 최소 권한(Critic R2 P1).

신규패턴: **CI 스캐너 설치 하드닝 패턴**(고정 에셋 직접 다운로드 + pipefail + N회 재시도/백오프).

## 이월

- **(서버) ADR-028 SA 적용·토큰 발급**: `docs/runbook/prod-readonly-kubeconfig.md` 따라 aether-gitops에 `prod-diag-readonly` 적용 + `kubectl create token` → read-only kubeconfig.
- **(서버) B+ loki prod 하드닝 갭**: 런북 §6 프롬프트로 라이브 loki probe/securityContext 실재 확인 → 갭이면 aether-gitops 추가.
- (기존 이월) Sprint 230 롤아웃 확인 · 라이브 /quiz 검증 · SP217 컷오버 · GA4 · problem_db · 하네스 cron.
