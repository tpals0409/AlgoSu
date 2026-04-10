---
sprint: 75
title: "Credential Rotation — R1 '알고수 토큰' PAT → gh CLI OAuth 전환 + 런북 SSoT 확립"
date: "2026-04-10"
status: completed
agents: [Oracle, Gatekeeper, Architect, Scribe, Explore]
related_adrs: [sprint-73.md, sprint-74.md]
---

# Sprint 75: Credential Rotation

## Context

Sprint 73-1에서 `/root/aether-gitops/.git/config`의 평문 PAT를 credential helper로 전환하며 노출 경로를 줄였지만, Gatekeeper V1-1 검증이 **사용처 전수조사 5축 중 1축(.git/config)만 확인**하고 나머지 4축(hosts.yml, GitHub Actions Secret, K8s Secret, 파일시스템 전수 grep)을 누락했다. 그 결과 동일 PAT(`ghp_oHuu...`, scope: `admin:org, repo, workflow`)가 3곳(CI `GITOPS_TOKEN`, K8s `argocd-repo-aether-gitops` password, gh CLI `hosts.yml`)에서 계속 사용되는 것이 Sprint 74 조사 단계에서야 발견되어 Sprint 73 G5(retrofit 필요)로 이월되었다.

Sprint 75는 이 이월 항목을 최종 해결하기 위해 **(1) 사용처 전수 체크리스트를 SSoT로 확립한 런북 신규 작성**, **(2) Gatekeeper 독립 검토로 런북 품질 보장**, **(3) credential rotation 실행 + 검증**을 수행했다.

Gatekeeper 독립 검토에서 추가 발견: AlgoSu 본 레포 `.git/config`에도 동일 PAT가 평문으로 잔존. Sprint 73-1이 aether-gitops에만 credential helper를 적용하고 AlgoSu에는 누락한 것이 Sprint 73 G5의 가장 결정적 사례였다.

rotation 실행 시 `gh auth login --web` device flow가 classic PAT(`ghp_`) 대신 **gh CLI OAuth user-to-server token(`gho_`)**을 발급했다. 기능적 동등성을 3축(API / credential helper / CI GitOps)에서 검증하고, PM이 "현상태로 진행" 결정하여 classic PAT → OAuth token 전환으로 확정.

## Decisions

### D1: PAT rotation 런북 신규 작성 + 사용처 전수 체크리스트 SSoT (75-1)

- **Context**: Sprint 73 G5 재발 방지의 핵심은 "누락된 사용처를 구조적으로 방지하는 체크리스트". 기존 런북 2개(`runbook-github-token-relink.md`: 사용자 OAuth 토큰, `runbook-key-rotation.md`: GitHub App Private Key)는 스코프가 다름.
- **Choice**: `docs/runbook-pat-rotation.md` 신규 414줄. 6축 사용처 전수 체크리스트:
  - (a) `.git/config` — **find 동적 열거 필수** (하드코딩 금지, Sprint 73 G5 근본 원인)
  - (b) `~/.config/gh/hosts.yml` — 1파일 내 2엔트리 공존 케이스 명시
  - (c) `.github/workflows/*.yml` `secrets.*_TOKEN` grep
  - (d) `kubectl get secret -A` password/token 필드 jq 쿼리
  - (e) 파일시스템 `grep -r` (`.claude/`, `.npm/_cacache/` filter)
  - (f) 보조 사용처 부재 확인 (`.docker/`, `.netrc`, `.git-credentials`, systemd, K8s ConfigMap/SA)
- **Code Paths**: `docs/runbook-pat-rotation.md` (신규, 3커밋에 걸쳐 완성)

### D2: Credential rotation 실행 — ghp_ classic PAT → gho_ gh CLI OAuth (75-2/75-3)

- **Context**: 구 `ghp_oHuu...` revoke + 3곳 갱신이 목표. `gh auth login --web` device flow가 classic PAT가 아닌 OAuth user-to-server token(`gho_`)을 발급.
- **Choice**: PM 결정으로 `gho_` 유지. 근거:
  - Sprint 73-1 "토큰 문자열 비노출" 정신 부합 — 신규 토큰이 서버 stdout/쉘/히스토리에 일체 미노출
  - §3.1 Positive 검증 3축(API / git ls-remote 2회) + CI GitOps job success + ArgoCD Synced/Healthy 모두 PASS
  - 런북 §2.5 stdin pipeline 패턴으로 K8s secret 주입 시에도 쉘 변수 경유 없음
- **실행 순서**: hosts.yml backup → logout → device flow login (PM 브라우저 device code `CD13-96F7` 승인) → `gh secret set GITOPS_TOKEN` → kubectl patch stdin pipeline → argocd-repo-server rollout restart → PM revoke "알고수 토큰" → Positive 검증 → CI push → ArgoCD refresh → 닫힘 증명 → backup shred
- **Code Paths**: 서버 설정 변경 (tracked 파일 없음), CI run `24225713081` success

### D3: Gatekeeper 독립 검토 적용 — 문서 작업에 Sprint 73 P2 확장 (75-1b)

- **Context**: 런북 초안이 Sprint 73 G5 재발 방지를 목표로 하면서 정작 초안 자체가 Gatekeeper 독립 검토 없이 커밋되면 Sprint 73의 실수를 반복하는 자기모순.
- **Choice**: Sprint 73 P2 "구현 + 독립 검증" 패턴을 문서 작업에 확장. Gatekeeper가 서버에서 체크리스트 (a)~(e)를 dry-run 실행하여 **런북 기대값과 실제 상태의 차이 발견**. 결과: 8개 패치 도출 (dynamic enumeration, filter 확장, zsh 분기, stdin pipeline, Positive 검증 전환, 닫힘 증명 신설, hosts.yml backup, 롤백 매트릭스 확장).
- **Alternatives**: (A) PM 직접 런북 리뷰 — 보안 운영 상세에 PM이 관여해야 함, 비용 높음. (B) 런북 검토 없이 즉시 rotation — Sprint 73 G5 재발 위험.

## Patterns

### P1: 사용처 전수 체크리스트 — find 동적 열거 + 닫힘 증명 (75-1)

- **Where**: `docs/runbook-pat-rotation.md` §1 + §3.4
- **When to Reuse**: 모든 credential rotation (PAT, SSH key, API key, encryption key). 6축 체크리스트의 구체적 grep 패턴만 교체하면 재사용 가능. 핵심 원칙 3가지: (1) **동적 열거** — 하드코딩된 경로 목록을 쓰지 말 것 (`find` 기반). Sprint 73 G5는 2개 레포 하드코딩이 근본 원인. (2) **rotation 전 + 후 2회 실행** — 전수조사를 rotation 전에만 돌리면 "rotation 과정에서 새로 생긴 평문" 누락. (3) **부재 확인도 확인** — "존재하지 않는 것"을 확인하는 것이 체크리스트의 핵심. absent/clean 판정이 "확인하지 않음"보다 정보량이 크다.

## Gotchas

### G1: AlgoSu `.git/config`에 평문 PAT 잔존 — Sprint 73-1 적용 누락 (75-0)

- **Symptom**: Gatekeeper 독립 검토에서 `find /root -maxdepth 3 -name .git -type d` 동적 열거 결과 `/root/AlgoSu/.git/config`에 `ghp_oHuu...` 평문 잔존 발견. Sprint 73-1의 credential helper 전환이 `aether-gitops`에만 적용됨.
- **Root Cause**: Sprint 73-1 작업 시 대상 레포를 수동 열거(`aether-gitops`만)했고, AlgoSu 자체는 "이미 credential helper 설정이 되어 있으니 괜찮겠지"라는 가정. 그러나 `.git/config`의 `remote.origin.url`에 평문 PAT가 박힌 경우 **URL이 전역 credential helper보다 우선**되어 helper가 무시됨.
- **Fix**: `git remote set-url origin https://github.com/tpals0409/AlgoSu.git` (토큰 제거) → credential helper 경유 `git push --dry-run` 성공 확인.
- **Lesson**: `.git/config` URL의 인라인 PAT는 credential helper 설정보다 우선한다. credential helper 전환 시 반드시 `find` 동적 열거로 **모든 레포의 remote URL을 점검**해야 한다.

### G2: `gh auth login` 대화형 프롬프트 — headless 환경 logout 선행 필수 (75-2)

- **Symptom**: OCI ARM headless 서버에서 `gh auth login --web` 실행 시 이미 로그인된 계정이 있으면 `"already logged in, re-authenticate?"` 대화형 프롬프트가 뜨고 비대화형 환경(Claude Code Bash tool)에서 stuck.
- **Fix**: `gh auth logout --hostname github.com` 선행 (stdin `printf 'y\n'` 주입) → 이후 `gh auth login --web`이 프롬프트 없이 device flow 진행.
- **Lesson**: headless 환경에서 gh CLI 재인증은 반드시 **logout → login** 2단계. 런북에 명시.

### G3: Classic PAT (ghp_) → OAuth token (gho_) 전환 — 운영 모델 변화 인지 (75-2/75-3)

- **Symptom**: `gh auth login --web`이 `Settings > Personal access tokens (classic)` 대신 gh CLI OAuth 앱을 통해 `gho_` 토큰을 발급. PM이 "새 토큰은 발급 안받아도 되는거야?"로 인지 불일치 감지.
- **Root Cause**: 런북이 "PAT rotation"이라는 용어를 쓰면서 실제 실행 방식은 OAuth device flow — 용어-실제 불일치.
- **Fix**: PM 결정으로 `gho_` 유지 + 런북/ADR에 "credential rotation"으로 일반화. `gho_`의 운영 차이(GitHub UI 위치, revoke 방식, 만료 제어)를 문서화.
- **Lesson**: 런북 작성 시 "어떤 **유형**의 credential이 발급되는지"를 명시해야 한다. `ghp_` / `gho_` / `ghs_` / `github_pat_` 등 GitHub 토큰 prefix는 각각 다른 발급 경로와 수명 정책을 가진다.

### G4: MEMORY.md "root + users.tpals0409" 표현 오해 — 1파일 2엔트리 (75-1b)

- **Symptom**: MEMORY.md가 "서버 gh CLI `~/.config/gh/hosts.yml`의 `oauth_token` 2곳 (root + users.tpals0409)"로 기술. 이를 "2개 파일"로 오독 가능. 실제는 `/root/.config/gh/hosts.yml` 1개 파일 내에 `users.tpals0409.oauth_token` + top-level `oauth_token` 2 엔트리 공존.
- **Fix**: 런북 §1(b)에 "한 파일 안에 2 엔트리 공존, `gh auth login --web` 1회로 원자적 재작성" 명시. Sprint 75 G4로 기록.
- **Lesson**: MEMORY.md의 약식 표현이 실행 절차에 직접 영향을 줄 수 있다. credential 위치를 기술할 때는 **파일 경로 + 파일 내 키 경로** 2 수준을 모두 명시.

## Metrics

- **작업 수**: 6건 (Sprint 74 ADR 선행 커밋, 75-0 cleanup, 75-1 런북 초안, 75-1b Gatekeeper 검토 반영, 75-1c headless 환경 패치, 75-2/75-3 rotation + 검증) + 1건 본 ADR
- **Commits (AlgoSu)**: 3건 (`5416168..ccab584`) + 본 ADR 예정
  - `490270e` docs(adr): Sprint 74 ADR (선행 위생 정리)
  - `80fb99d` docs(runbook): Sprint 75-1 PAT rotation 런북 (Gatekeeper 검토 반영)
  - `ccab584` docs(runbook): Sprint 75-1c 런북 §2.3 headless 환경 + logout 선행 명시
- **Commits (aether-gitops)**: 1건 자동 (CI GitOps job blog 이미지 태그 bump)
- **Files changed (AlgoSu)**: 2개
  - `docs/adr/sprints/sprint-74.md` (신규, Sprint 74 ADR 선행 커밋)
  - `docs/runbook-pat-rotation.md` (신규 440줄, 3커밋에 걸쳐 완성)
- **서버 설정 변경 (tracked 아님)**:
  - `/root/AlgoSu/.git/config`: remote.origin.url 평문 PAT 제거
  - `/root/.config/gh/hosts.yml`: `ghp_` → `gho_` 2 엔트리 전환
  - GitHub Actions Secret `GITOPS_TOKEN`: 갱신 (`2026-04-10T03:58:10Z`)
  - K8s Secret `argocd/argocd-repo-aether-gitops` password: `ghp_` → `gho_`
  - ArgoCD `argocd-repo-server` Pod: credential cache 무효화 rollout
- **CI 연속 성공**: 1회 (`24225713081`, GitOps job 4초 — `gho_` 토큰으로 aether-gitops clone+push)
- **ArgoCD**: `Synced / Healthy`, hard refresh 후 인증 에러 없음
- **Sprint 73 이월 해결**: 1건 (R1 "알고수 토큰" PAT rotation → credential rotation)
- **Sprint 73 G5 retrofit**: 완료 (런북 §1 전수 체크리스트 SSoT 확립 + §3.4 닫힘 증명)

## Related

- **Sprint 73 ADR** — G5 (retrofit 필요: Gatekeeper 실사용 위치 전수조사 누락)의 직접 해결. Sprint 73-1 credential helper 전환이 aether-gitops만 적용한 것이 75-0에서 최종 확인 + 정리.
- **Sprint 74 ADR** — Sprint 75 시작 시점에 untracked 상태였던 Sprint 74 ADR(`490270e`)을 선행 커밋으로 위생 정리.
- **`docs/runbook-pat-rotation.md`** — 본 스프린트의 주요 산출물이자 향후 모든 PAT/credential rotation의 SSoT. Gatekeeper 독립 검토 8개 패치 반영.
