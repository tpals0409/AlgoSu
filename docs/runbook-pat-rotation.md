# GitHub PAT (Personal Access Token) 로테이션 런북

> 대상: AlgoSu 운영 PAT (GitOps 자동 배포 + 서버 gh CLI)
> 작성일: 2026-04-10 (Sprint 75, Sprint 73 G5 retrofit)
> 관련 런북: `runbook-github-token-relink.md` (사용자 OAuth 토큰, 스코프 다름), `runbook-key-rotation.md` (GitHub App Private Key, 스코프 다름)

---

## 배경

Sprint 73-1에서 `.git/config` 평문 PAT를 credential helper로 전환하여 파일시스템 노출은 해소했으나, **실사용 위치 전수조사**를 놓쳐 동일 PAT가 3곳에 박혀 있는 것이 Sprint 74 조사 단계에서 드러났다. 본 런북은 그 전수조사 체크리스트를 SSoT로 정착시켜 재발을 차단한다.

**재발 원인**: Sprint 73-1 작업 + Gatekeeper V1-1 검증 모두 `.git/config` 평문 제거만 확인하고 (a) `~/.config/gh/hosts.yml` (b) GitHub Actions Secret (c) K8s Secret password 필드 (d) 서버 `grep -r` 전수조사 4축을 누락. → Sprint 75-1이 본 런북으로 retrofit.

---

## 🚨 대상 PAT 식별

GitHub Settings → Developer settings → Personal access tokens (**classic**) 목록에서 이름으로 구분:

| 토큰 이름 | 용도 | 본 런북 대상 |
|---|---|---|
| **알고수 토큰** | GitOps 자동 배포 (CI `GITOPS_TOKEN`) + ArgoCD repo pull + 서버 gh CLI | ✅ **rotation 대상** |
| **k8s-ghcr-pull** | k3s가 `ghcr.io/tpals0409/*` 이미지 pull 전용 | ⛔ **절대 건드리지 말 것** |

> ⛔ **"k8s-ghcr-pull" 토큰을 삭제/회수하면 전 Pod `ImagePullBackOff` → 클러스터 전면 장애**. Delete 버튼 클릭 전 토큰 이름을 반드시 재확인.

---

## 1. 사용처 전수 체크리스트 (필수 선행)

rotation 실행 전 아래 5-point를 모두 수행하여 **누락된 사용처가 없음을 확인**한다. 이 체크리스트가 본 런북의 핵심이며, Sprint 73 G5 재발 방지의 유일한 장치다.

### (a) 로컬 git repo `.git/config` 평문 grep — **동적 열거 필수**

⚠️ **하드코딩된 레포 목록을 쓰지 말 것**. Sprint 73-1은 `aether-gitops`만 전환하고 `AlgoSu`를 놓쳤다가 Sprint 75에서 발견된 것이 Sprint 73 G5의 결정적 사례. `find` 기반 동적 열거로 **서버 내 모든 git 작업 트리**를 찾아야 한다.

```bash
find /root /home -maxdepth 4 -name .git -type d 2>/dev/null | while read g; do
  repo="${g%/.git}"
  printf '%-60s ' "$repo"
  if grep -qE 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}' "$g/config" 2>/dev/null; then
    prefix=$(grep -oE 'ghp_[A-Za-z0-9]{4}|github_pat_[A-Za-z0-9_]{4}' "$g/config" | head -1)
    echo "PLAINTEXT FOUND (${prefix}...)"
  else
    echo "clean"
  fi
done
```

기대: 모든 레포 `clean`. **평문이 발견되면 rotation 실행 전 cleanup 선행 필수** — 전역 credential helper가 이미 `!gh auth git-credential`로 설정되어 있으므로 URL에서 토큰 부분만 제거하면 된다:

```bash
# 예시: /root/AlgoSu 에서 발견된 경우
cd /root/AlgoSu
git remote set-url origin https://github.com/tpals0409/AlgoSu.git   # 토큰 제거
git push --dry-run origin main                                       # credential helper 경유 정상 동작 확인
```

이후 (a) 재실행하여 `clean` 확인. **cleanup 없이 rotation 진행 시 credential helper가 URL의 구 토큰을 우선 사용하여 갱신이 반영되지 않는다.**

### (b) gh CLI `~/.config/gh/hosts.yml`

```bash
ls -la /root/.config/gh/hosts.yml /home/*/.config/gh/hosts.yml 2>&1
awk 'NR<=50 {gsub(/oauth_token: .*/,"oauth_token: ***"); print}' /root/.config/gh/hosts.yml
```

- 존재하는 파일 경로를 모두 나열 (여러 사용자 계정이 있으면 각각 확인)
- 각 파일 내 `oauth_token:` 엔트리 **개수**를 세고 rotation 후 동일 개수로 재작성되는지 확인
- **주의**: 한 파일 안에 `users.<name>.oauth_token`과 top-level `oauth_token` 2 엔트리가 공존할 수 있음. `gh auth login --web`은 두 엔트리 모두 원자적으로 재작성한다.

### (c) GitHub Actions workflow `secrets.*_TOKEN` 참조

```bash
grep -rnE 'secrets\.[A-Z_]*TOKEN[A-Z_]*' /root/AlgoSu/.github/workflows/ /root/aether-gitops/.github/workflows/ 2>/dev/null
```

발견된 각 `secrets.FOO_TOKEN` 이름을 목록화. 특히 `GITOPS_TOKEN`은 `.github/workflows/ci.yml:803` "Update GitOps manifests" job에서 `git clone https://x-access-token:${{ secrets.GITOPS_TOKEN }}@...` 패턴으로 사용 — 미갱신 시 모든 서비스 자동 배포 중단.

### (d) K8s Secret password/token 필드

```bash
kubectl get secret -A -o json \
  | jq -r '.items[] | select(.data.password != null or .data.token != null) | "\(.metadata.namespace)/\(.metadata.name)"'
```

`argocd/argocd-repo-aether-gitops` 등 발견된 각 secret에 대해:

```bash
# 주의: 값 출력하지 말고 prefix 4자리만 확인 (감사용)
kubectl get secret argocd-repo-aether-gitops -n argocd -o jsonpath='{.data.password}' | base64 -d | cut -c1-4; echo
# 기대: "ghp_" 또는 "ghs_" 또는 "github_pat_" prefix
```

### (e) 서버 파일시스템 `grep -r` 전수조사

```bash
# /root, /home, /etc 범위. 노이즈 대량 발생 경로는 필터
grep -rnE 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}' \
  /root /home /etc 2>/dev/null \
  | grep -v '\.git/objects/' \
  | grep -v '/node_modules/' \
  | grep -v '/\.npm/_cacache/' \
  | grep -v '/\.claude/' \
  | grep -v 'runbook-pat-rotation.md' \
  | grep -v 'runbook-github-token-relink.md'
```

**필터 근거**:
- `.git/objects/` — 과거 커밋의 blob은 force-push 없이 수정 불가, rotation 대상 아님
- `/node_modules/` — 의존성 fixture/test 데이터에 `ghp_*` 패턴이 포함될 수 있음 (false positive)
- `/.npm/_cacache/` — npm 레지스트리 캐시의 tarball 내부 fixture (false positive)
- `/.claude/` — Claude Code 세션 로그(`projects/**/*.jsonl`, `history.jsonl`)는 append-only라 대량 hit 발생. rotation **후** 별도 prune 고려 (§5 사후 조치 참조)

기대: rotation **직전** — `hosts.yml` 2 엔트리 + K8s secret base64 부모 manifest(있다면) + `.git/config` 동적 열거에서 발견된 평문(있으면 반드시 (a) 절차로 사전 cleanup)만 남아야 함. **git tracked 파일에 평문이 있으면 즉시 중단**하고 커밋 이력 정리 선행.

### (f) 보조 사용처 부재/평문 없음 확인

서버에 존재할 수 있는 잠재 PAT 저장소. 현 환경에서는 부재이나 **부재 자체를 확인해야** SSoT 성립.

```bash
# (f-1) Docker registry credential
ls -la /root/.docker/config.json 2>/dev/null && \
  (grep -E 'ghp_|github_pat_|auth.*=' /root/.docker/config.json || echo "  (clean)") || \
  echo "  (absent)"

# (f-2) netrc / git-credentials (credential helper store backend)
for f in /root/.netrc /root/.git-credentials; do
  [ -f "$f" ] && grep -E 'ghp_|github_pat_|password' "$f" 2>/dev/null || echo "$f: (absent)"
done

# (f-3) bash/zsh 히스토리 내 평문
for h in /root/.bash_history /root/.zsh_history; do
  [ -f "$h" ] && grep -cE 'ghp_[A-Za-z0-9]{36}' "$h" 2>/dev/null | awk -v f="$h" '{print f": "$1" hits"}' || echo "$h: (absent)"
done

# (f-4) K8s ConfigMap/ServiceAccount annotation 내 토큰 흔적
kubectl get configmap -A -o json | jq -r '.items[] | select(.data // {} | tostring | test("ghp_|github_pat_")) | "\(.metadata.namespace)/\(.metadata.name)"' 2>/dev/null
kubectl get sa -A -o json | jq -r '.items[] | select(.metadata.annotations // {} | tostring | test("ghp_|github_pat_")) | "\(.metadata.namespace)/\(.metadata.name)"' 2>/dev/null

# (f-5) systemd unit EnvironmentFile 내 PAT
grep -rE 'ghp_|github_pat_' /etc/systemd/system/ /etc/default/ 2>/dev/null || echo "  (clean)"
```

기대: 모두 `(clean)` 또는 `(absent)`. 하나라도 PAT prefix가 발견되면 **rotation 대상 목록에 즉시 추가**하고 본 런북 §1에 해당 축을 (g), (h) …로 영구 등재한다.

### 전수조사 결과 기록

체크리스트 (a)~(e) 결과를 Sprint ADR에 요약 인용(개수/위치 + 평문 노출 여부)하여 감사 추적 가능하게 한다. 값 자체는 절대 ADR에 기록하지 않는다.

---

## 2. 실행 순서 (옵션 B — 토큰 문자열 노출 최소화)

> 원칙: **구토큰 revoke는 반드시 모든 갱신 완료 후 최후**. 순서 뒤집으면 ArgoCD + CI 동시 중단.

### 2.1 쉘 안전 준비

현재 쉘을 먼저 확인하고 분기:

```bash
echo "$SHELL" "$0"
```

**bash**:
```bash
unset HISTFILE          # 세션 종료 시 history 파일에 flush 되지 않도록
set +o history          # 이후 명령이 in-memory history에도 기록되지 않도록
unalias cat ls 2>/dev/null
```

**zsh**:
```bash
unset HISTFILE
setopt HIST_IGNORE_SPACE  # (선택) 공백 prefix 명령 기록 제외
set +o history            # zsh는 unsetopt HIST_SAVE_NO_DUPS 등 별도 옵션 존재 — 환경에 맞춰 조정
unalias cat ls 2>/dev/null
```

**공통 경고 — 쉘 변수 경유 금지**:

- 토큰을 `VAR="$(gh auth token)"` 형태로 쉘 변수에 담는 순간, 같은 호스트의 **다른 프로세스가 `/proc/<pid>/environ` 또는 `ps auxe`** 로 해당 프로세스 환경을 관찰할 수 있다 (root 권한 분리 없을 때).
- 본 런북의 2.4/2.5 단계는 **모두 stdin 파이프라인 또는 서브쉘 즉시 평가** 패턴을 쓴다. 쉘 변수에 절대 담지 말 것.
- tmux/screen 버퍼에 토큰이 출력되면 스크롤백에 남을 수 있음 — 명령 완료 후 `clear; tmux clear-history` 등으로 버퍼 비우기 권장.

### 2.2 hosts.yml backup + PM 브라우저 준비

rotation 중 `gh auth login` 실패 시 즉시 복구할 수 있도록 **현재 hosts.yml을 backup**한다:

```bash
# 600 권한 유지 복사. rotation 성공 후 즉시 삭제.
install -m 600 /root/.config/gh/hosts.yml /root/.config/gh/hosts.yml.bak.$(date +%Y%m%d_%H%M%S)
ls -la /root/.config/gh/hosts.yml.bak.*
```

PM 브라우저: https://github.com/settings/tokens 페이지 열어두기. **아직 Delete 누르지 말 것** (revoke는 2.6).

> ⚠️ backup 파일은 rotation 성공(§3.4 닫힘 증명 통과) 직후 **반드시 삭제**. 파일시스템에 구 토큰 평문이 남아 있는 상태가 된다.
> ```bash
> shred -u /root/.config/gh/hosts.yml.bak.*
> ```

### 2.3 서버: gh CLI 재인증 (web flow)

```bash
gh auth login --hostname github.com --git-protocol https --web \
  --scopes "admin:org,repo,workflow"
```

- 터미널에 8자리 device code가 표시됨
- **PM 브라우저**: 표시된 URL로 이동 → device code 입력 → GitHub 계정 승인
- 완료 시 새 토큰이 `/root/.config/gh/hosts.yml` 2 엔트리에 원자적으로 기록됨
- **새 토큰 문자열은 터미널에 출력되지 않음** (gh CLI secure storage)

검증:

```bash
gh auth status
# 기대: "Logged in to github.com account tpals0409" + "Token scopes: 'admin:org', 'repo', 'workflow'"
```

### 2.4 서버: GitHub Actions Secret `GITOPS_TOKEN` 갱신

```bash
gh secret set GITOPS_TOKEN --body "$(gh auth token)" --repo tpals0409/AlgoSu
gh secret list --repo tpals0409/AlgoSu | grep GITOPS_TOKEN
# 기대: "Updated <오늘 날짜>"
```

`gh secret set`은 토큰 값을 암호화하여 API로 전송하므로 stdout/로그에 노출되지 않음. `--body "$(gh auth token)"`는 서브쉘 내부에서만 평가되어 쉘 히스토리에도 안전.

### 2.5 서버: K8s Secret `argocd-repo-aether-gitops` 갱신 + cache 무효화

**쉘 변수 경유 없이 stdin pipeline으로 처리**. `kubectl patch --patch-file=/dev/stdin` 패턴을 사용하여 토큰 값이 `ps auxe`/`/proc/*/environ`에서 관찰되지 않도록 한다.

```bash
# gh auth token → base64 → patch JSON → kubectl stdin. 중간 변수/파일 없음.
gh auth token \
  | tr -d '\n' \
  | base64 -w0 \
  | awk '{print "{\"data\":{\"password\":\"" $0 "\"}}"}' \
  | kubectl patch secret argocd-repo-aether-gitops -n argocd --patch-file=/dev/stdin

# 검증: prefix 4자리만 확인 (값 노출 금지)
kubectl get secret argocd-repo-aether-gitops -n argocd \
  -o jsonpath='{.data.password}' | base64 -d | cut -c1-4; echo
# 기대: "ghp_"

# ArgoCD repo-server credential cache 무효화 (필수)
kubectl -n argocd rollout restart deployment argocd-repo-server
kubectl -n argocd rollout status deployment argocd-repo-server --timeout=120s
```

**금지 패턴 (Gatekeeper 검토 교훈)**:
```bash
# ❌ 쉘 변수 경유 — ps auxe / procfs 관찰 위험
NEW_TOKEN="$(gh auth token)"
kubectl patch ... -p "{\"password\":\"$(echo -n $NEW_TOKEN|base64 -w0)\"}"
```

### 2.6 PM 브라우저: 구 "알고수 토큰" revoke

https://github.com/settings/tokens → **"알고수 토큰"** 행의 Delete 클릭 → 확인 모달 승인.

⛔ **"k8s-ghcr-pull" 은 절대 건드리지 말 것**. 토큰 이름 재확인 후 Delete.

---

## 3. 검증 (3-point)

### 3.1 Positive 검증 — 신규 토큰 정상 동작 확인

> Gatekeeper 검토 교훈: 구 토큰을 쉘/curl로 직접 전달하는 Negative 검증은 본 런북이 금기시한 "평문 쉘 전달" 패턴의 자기모순이다. Positive 검증(신규 토큰이 정상이므로 구 토큰이 더 이상 필요 없음)을 기본으로 한다.

```bash
# (3.1-a) gh CLI 신규 토큰으로 GitHub API 접근
gh api user --jq '.login'
# 기대: "tpals0409"

# (3.1-b) credential helper 경유 aether-gitops 원격 접근
git ls-remote https://github.com/tpals0409/aether-gitops.git HEAD
# 기대: "<sha>\tHEAD" 출력 (인증 실패 없음)

# (3.1-c) credential helper 경유 AlgoSu 원격 접근
git ls-remote https://github.com/tpals0409/AlgoSu.git HEAD
# 기대: "<sha>\tHEAD" 출력
```

세 명령 모두 성공하면 신규 토큰이 gh CLI, Git credential helper, API 호출 3축에서 정상 동작함을 보증한다.

### 3.1-opt (선택) Negative 검증 — 구 토큰 무효화

보안 감사를 위해 구 토큰이 실제로 401을 반환하는지 확인하고 싶다면:

```bash
# 구 토큰 문자열을 환경변수 또는 프롬프트로 받아 stdin 전달 (명령행 인자 금지)
read -rs OLD_TOKEN   # 입력 에코 없음
curl -sSI -H "Authorization: token $OLD_TOKEN" https://api.github.com/user | head -1
unset OLD_TOKEN      # 즉시 제거
```

`HTTP/2 401` 기대. `200`이면 즉시 STOP하고 GitHub 설정 재확인. **단 이 단계는 선택**이며, Positive 검증(3.1-a~c)이 모두 성공했고 2.6 revoke가 수행되었다면 Negative 검증은 감사 추적용일 뿐 rotation 성공의 필요조건은 아니다.

### 3.2 CI "Update GitOps manifests" job 성공

trivial 테스트 커밋 생성 → push → CI 관측:

```bash
git -C /root/AlgoSu commit --allow-empty -m "chore(ci): PAT rotation verification (Sprint 75-3)"
git -C /root/AlgoSu push origin main

# CI run 관측
gh run watch --repo tpals0409/AlgoSu
# 또는
gh run list --repo tpals0409/AlgoSu --limit 1
```

기대:
- 전체 workflow `success`
- 특히 `Update GitOps manifests` job이 `success`
- aether-gitops 레포에 자동 커밋 생성 (`git -C /root/aether-gitops log --oneline -3`)

### 3.3 ArgoCD sync 정상

```bash
kubectl annotate app algosu -n argocd argocd.argoproj.io/refresh=hard --overwrite
sleep 5
kubectl get app algosu -n argocd -o jsonpath='{.status.sync.status} / {.status.health.status}{"\n"}'
# 기대: "Synced / Healthy"

# argocd-repo-server 로그에 인증 실패 없는지 확인
kubectl logs -n argocd deployment/argocd-repo-server --tail=100 \
  | grep -iE 'auth|unauthor|401|forbidden' || echo "  (clean)"
# 기대: (clean) 또는 정상 로그만
```

### 3.4 닫힘 증명 — rotation 후 체크리스트 재실행

> Gatekeeper 검토 교훈: 체크리스트는 rotation **전**에만 돌리면 의미가 반감된다. rotation **후**에 동일 grep을 돌려 "구 토큰 prefix가 어디에도 남지 않음"을 증명해야 본 런북의 SSoT 약속이 닫힌다. 본 단계는 생략 불가.

```bash
# (3.4-a) 모든 .git/config 재스캔 — 여전히 clean?
find /root /home -maxdepth 4 -name .git -type d 2>/dev/null | while read g; do
  grep -HE 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}' "$g/config" 2>/dev/null
done
# 기대: 아무 출력 없음

# (3.4-b) hosts.yml prefix 교체 확인 — 구 토큰 prefix가 사라졌는가?
awk '/oauth_token/ {print "  " substr($2,1,8)"..."}' /root/.config/gh/hosts.yml
# 기대: 새 토큰 prefix 2개 (구 토큰 prefix와 다름)

# (3.4-c) K8s secret prefix
kubectl get secret argocd-repo-aether-gitops -n argocd -o jsonpath='{.data.password}' \
  | base64 -d | cut -c1-12; echo
# 기대: 새 토큰 prefix (구 토큰과 다름)

# (3.4-d) CI secret Updated 타임스탬프
gh secret list --repo tpals0409/AlgoSu | grep GITOPS_TOKEN
# 기대: Updated 컬럼이 오늘 날짜

# (3.4-e) 파일시스템 전수 grep — 구 토큰 prefix 지정 검색
# 구 토큰의 앞 8자리 prefix를 알고 있다면 해당 문자열로 검색.
#   grep -rE '<OLD_PREFIX_8CHARS>' /root /home /etc 2>/dev/null \
#     | grep -v '\.git/objects/' | grep -v '/node_modules/' \
#     | grep -v '/\.npm/_cacache/' | grep -v '/\.claude/'
# 기대: 빈 결과 (구 토큰 prefix가 어디에도 남지 않음). 있으면 STOP.

# (3.4-f) 보조 사용처 (1.(f)) 재확인
#   §1(f)의 모든 명령을 다시 실행하여 rotation 과정에서 어디에도 새 평문이 생기지 않았는지 검증
```

(3.4-a)~(3.4-f) 모두 기대치와 일치하면 rotation은 **닫힘**. 하나라도 불일치하면 Oracle에 즉시 에스컬레이션.

---

## 4. 롤백 시나리오

| 실패 지점 | 증상 | 조치 |
|---|---|---|
| 2.3 gh auth login 실패 | device code 타임아웃, 브라우저 권한 거부, `hosts.yml` 부분 재작성으로 깨짐 | `install -m 600 /root/.config/gh/hosts.yml.bak.<TS> /root/.config/gh/hosts.yml` 로 §2.2 backup 복원 → `gh auth status`로 원상 확인 → 2.3 재시도 |
| 2.4 `gh secret set` 실패 | `HTTP 403` 등 | CI는 구 `GITOPS_TOKEN`으로 계속 동작 → 2.6 revoke 금지. gh CLI 권한 스코프(`workflow`) 확인 후 재시도 |
| 2.5 kubectl patch 실패 | awk/pipeline 오류, JSON 깨짐, RBAC 거부 | 구 secret 그대로 유지 → ArgoCD 계속 구 토큰 사용 → 2.6 revoke 금지. pipeline 중간 출력을 `| cat -v` 로 점검 (토큰 값 출력 주의). RBAC는 `kubectl auth can-i patch secret -n argocd` 로 확인 |
| 3.1-a `gh api user` 실패 | `401 Bad credentials` | 신규 토큰이 반영되지 않음 → `gh auth status` 재확인 → 2.3 재실행. backup 복원 여부는 상황에 따라 판단 |
| 3.1-b/c `git ls-remote` 실패 | `Authentication failed` | 전역 credential helper가 구 토큰 cache를 사용 중 → `gh auth setup-git` 재실행 + `git credential-cache exit` |
| 3.1-opt HTTP 200 (구토큰 유효) | revoke 반영 지연 | 60초 대기 후 재시도. 계속 200이면 GitHub 브라우저 Delete 재확인. 단 본 단계는 선택이므로 다른 검증이 통과했다면 감사 로그만 남기고 진행 가능 |
| 3.2 CI job 실패 | `fatal: could not read Username` | `gh secret list`에서 `GITOPS_TOKEN` Updated 타임스탬프 확인 → 없으면 2.4 재실행 |
| 3.3 Synced 아닌 상태 | `OutOfSync` / repo auth error | `kubectl get secret argocd-repo-aether-gitops -n argocd -o jsonpath='{.data.password}' \| base64 -d \| cut -c1-4` → `ghp_` prefix 확인 → 아니면 2.5 재실행 + rollout restart 재수행 |
| 3.4 닫힘 증명 실패 | `.git/config` 평문 재등장, 새 사용처 발견 | **Critical — Oracle 즉시 에스컬레이션**. rotation 자체는 성공이어도 런북 SSoT가 깨진 상태. §1 체크리스트에 새 축 영구 등재 + Sprint ADR G-lesson 기록 |

**재복구 마지막 수단**: 구 토큰을 아직 revoke하지 않은 상태에서만 3곳을 구 토큰 값으로 되돌릴 수 있다. **2.6 revoke 이후에는 롤백 불가** — 반드시 신규 토큰으로 완전 복구해야 함.

---

## 5. 사후 조치

- [ ] §2.2 에서 만든 `hosts.yml.bak.*` backup 파일 **`shred -u`로 삭제** (구 토큰 평문 잔존 방지)
- [ ] 본 런북의 사용처 체크리스트 (a)~(f)를 **Sprint ADR 해당 섹션에 결과 요약으로 기록** (값 제외, 개수/위치만). §3.4 닫힘 증명 결과도 함께 기록
- [ ] Claude Code 세션 로그(`/root/.claude/projects/**/*.jsonl`) 내 구 토큰 prefix 잔존 여부 확인. 로그는 append-only이므로 rotation 후 prune 시 해당 파일만 **전체 삭제**하거나 jq로 해당 entry 제거. **단 Claude 세션 로그 prune 전 Oracle 승인 필수** — 대화 이력 손실 위험
- [ ] 다음 rotation 예정일 캘린더 등록 (권장 주기: **6개월** — GitHub 권장 + OCI ARM 운영 부담 고려)
- [ ] 신규 사용처가 추가되면 본 런북 "1. 사용처 전수 체크리스트"에 **즉시 추가**. 본 런북은 SSoT이며 체크리스트가 현실과 어긋나는 순간 재발 위험이 생긴다.
- [ ] Gatekeeper는 Sprint 종료 `/stop` 체크리스트에 "PAT 사용처 grep" 단계를 포함하여 신규 사용처 혼입을 감지할 것

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `.github/workflows/ci.yml:803` | `GITOPS_TOKEN` 참조 ("Update GitOps manifests" job) |
| `/root/.config/gh/hosts.yml` | 서버 gh CLI 토큰 저장 (2 엔트리: top-level + users.tpals0409) |
| `kubectl get secret argocd-repo-aether-gitops -n argocd` | ArgoCD aether-gitops repo pull credential |
| `docs/adr/sprints/sprint-73.md` | G5 (retrofit 원인) |
| `docs/adr/sprints/sprint-75.md` | 본 런북 작성 배경 + 최초 rotation 실행 기록 |
