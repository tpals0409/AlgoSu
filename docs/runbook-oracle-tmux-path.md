# Oracle tmux dispatch — claude 바이너리 PATH 문제 해결

> 대상: `~/.claude/oracle/bin/oracle-spawn.sh` (repo 외부, .claude config)
> 작성 배경: Sprint 139에서 Oracle architect 디스패치 시 `env: claude: No such file or directory` 즉시 실패 → Critic 검증 단계 우회 가능성 발견

---

## 증상

```
oracle-spawn.sh architect <task_id> "<설명>"
→ tmux pane에서 즉시 실패
→ 로그: env: claude: No such file or directory
```

## 원인

tmux pane이 새 zsh 세션을 시작할 때 `~/.zshrc`/`~/.zprofile`이 비대화형 모드로 로드되지 않아 부모 셸의 PATH가 상속되지 않는 경우 발생. Homebrew(`/opt/homebrew/bin`)에 설치된 `claude` 바이너리가 PATH에 없어 `env -u CLAUDECODE ... claude -p`가 실패.

## 해결 (Sprint 141 적용)

`~/.claude/oracle/bin/oracle-spawn.sh`의 runner 스크립트 생성 부분(L127 부근)에 PATH 명시적 export + claude 바이너리 사전 검증 추가:

```bash
cat > "$runner_file" <<RUNNER_EOF
#!/usr/bin/env bash
set -uo pipefail

# Sprint 141 — tmux pane이 부모 셸 PATH를 상속하지 않는 경우 대비 명시적 export.
export PATH="/opt/homebrew/bin:/opt/local/bin:/usr/local/bin:/usr/bin:/bin:\${PATH:-}"

# claude 바이너리 사전 검증 — 누락 시 fail-fast
if ! command -v claude >/dev/null 2>&1; then
  echo "[runner][error] claude 바이너리 미발견 — PATH=\$PATH" >> "${log_file}" 2>&1 || true
  echo "__AGENT_DONE__" >> "${log_file}" 2>&1 || true
  rm -f "${lock_file}" 2>&1 || true
  exit 127
fi

cd "${project_dir}"
...
RUNNER_EOF
```

## 효과

- macOS Homebrew(arm64/intel) + MacPorts + `/usr/local` 환경 모두 커버
- 누락 시 fail-fast → `[runner][error]` 로그로 즉시 인지 가능
- lock 정리 + `__AGENT_DONE__` 마커로 reap 정상 처리

## 검증

```bash
# 1. 문법 검증
bash -n ~/.claude/oracle/bin/oracle-spawn.sh

# 2. 단일 에이전트 디스패치 dry-run
ID=$(bash ~/.claude/oracle/bin/oracle-create-task.sh --gen-id)
bash ~/.claude/oracle/bin/oracle-create-task.sh --simple "$ID" "PATH 검증" "scribe"
bash ~/.claude/oracle/bin/oracle-spawn.sh scribe "$ID" "PATH 검증 테스트"

# 3. tmux pane 로그 확인
tail -20 ~/.claude/oracle/logs/scribe-${ID}.out
# → "[runner][error] claude 바이너리 미발견" 메시지 없으면 성공
```

## 주의사항

- 본 파일은 **repo 외부**(.claude config)로 git 추적 대상이 아님. 본 PR은 변경 절차와 패치 코드를 documentation으로 보존.
- 다른 머신에서 동일 환경 구성 시 본 runbook 참고하여 동일 패치 적용 필요
- claude 바이너리 위치가 다를 경우 PATH 라인을 환경에 맞게 조정

## 향후 개선 시드

- claude 바이너리 절대 경로를 oracle 설정 파일에 캐시 → PATH 의존성 완전 제거
- oracle-init 시 PATH 검증 step 추가
