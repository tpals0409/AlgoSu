# Runbook: git staging 체크리스트 (plan 단계)

> **적용 범위**: `git mv` + Edit/sed 결합 작업이 포함된 모든 plan
> **도입**: Sprint 154 시드 #20 (Sprint 153 Phase A/E 두 차례 재발한 sed staging 누락 패턴 차단)
> **관련 RUNBOOK**: `docs/runbook/doc-ref-lint.md`, `docs/runbook/claude-commands.md`
> **관련 컨벤션**: `docs/conventions/ci-cd.md`

---

## 1. 개요

Sprint 153 docs/ 폴더 최적화 작업에서 **동일 staging 누락 사고가 2회 재발**했다.

| Phase | 사고 | 영향 |
|-------|------|------|
| Phase A (PR #236) | `git mv` 결과는 staged / sed cross-ref 갱신은 unstaged → commit 누락 | 부분 발견 후 즉시 fix (단일 PR 내) |
| Phase E (PR #240) | `git mv` + 신규 README는 staged / sed cross-ref 19 파일 unstaged → commit 제외 | main에 broken link 19건 노출 → PR #241 hotfix 필요 |

두 사고 모두 **동종 결함**: `git commit` 은 staged 영역만 처리한다는 사실을 plan 단계에서 명시화하지 않음. 본 RUNBOOK 은 미래 동종 결함의 사전 차단을 목표로 한다.

---

## 2. 체크리스트 (plan 작성 시 필수)

plan 에 `git mv`, `sed`, 또는 Edit 도구로 다중 파일 변경이 포함되면 아래 항목을 plan 본문에 명시한다.

### 2.1 작업 분류

- [ ] **단일 파일 변경**: Edit/Write 1~2 파일 — staging 위험 낮음 (자동 staged 아님)
- [ ] **`git mv` 포함**: 이동/리네이밍 — `git mv` 결과는 자동 staged
- [ ] **sed 다중 파일**: cross-ref 일괄 갱신 — sed 결과는 **unstaged**
- [ ] **`git mv` + sed/Edit 결합**: 가장 위험한 조합 — 분리된 staging 필요

### 2.2 staging 명령 명시

위 분류에 따라 plan 본문에 commit 직전 명령을 적시한다.

| 조합 | 권장 명령 | 비고 |
|------|-----------|------|
| Edit/Write 만 | `git add <file1> <file2>` | 명시적 화이트리스트 |
| `git mv` 만 | (자동 staged) | 추가 staging 불필요 |
| sed 다중 파일 | `git add -u` 또는 `git add docs/ services/` | 변경 추적 파일 모두 staging |
| `git mv` + sed/Edit | `git add -u` (최후 staging) | 두 작업 결과 모두 포함 |

### 2.3 commit 직전 검증

- [ ] `git status --short` — `M ` (staged) / ` M` (unstaged) 분리 확인
- [ ] `git diff --cached --stat` — staged 변경 파일 수 + 라인 수가 의도와 일치하는지 검증
- [ ] `git diff --stat` — unstaged 잔여가 0건인지 확인 (의도적 분리가 아닌 한)

---

## 3. 위반 시 복구 절차

### 3.1 사고 1: commit 누락 (Sprint 153 Phase A 패턴)

```bash
# 누락된 변경분 확인
git diff --stat

# 누락분만 분리 commit (또는 fixup)
git add -u
git commit -m "fix(scope): 누락 변경 보완 (Phase X hotfix)"
git push
```

### 3.2 사고 2: main 푸시 후 broken link 노출 (Sprint 153 Phase E 패턴)

```bash
# 별도 hotfix PR 으로 cross-ref 일괄 복원
git checkout -b fix/<scope>-<description>-crossref-restore
git ls-files | xargs grep -l "<broken-pattern>" | xargs sed -i '' 's|old|new|g'
git add -u
git commit -m "fix(scope): cross-ref 복원 (Phase X hotfix)"
git push -u origin <branch>
gh pr create ...
```

### 3.3 사고 3: stash drop 으로 untracked 손실 (Sprint 153 Phase E 부수 사고)

`git stash push -u` 후 `git stash drop` 시 untracked 파일이 영구 손실될 수 있다.

```bash
# 즉시 복구 시도 (GC 전까지 unreachable 잔존)
git fsck --no-reflogs --unreachable | grep commit

# 3rd parent tree 가 untracked stash
git show <stash-commit>^3 --stat
git checkout <stash-commit>^3 -- <untracked-file>
```

**원칙**: `-u` 옵션 stashed untracked 는 `stash list` 에 안 보일 수 있다. drop 직전 보존이 필요하면 별도 commit 격리.

---

## 4. plan 템플릿 (예시)

```markdown
## Phase X: <설명>

**산출물**:
- `path/to/file1.md` (신규)
- `path/to/file2.md` (이동: `old/path.md` → `new/path.md`)
- cross-ref 갱신: 8 파일 (`docs/**/*.md`)

**staging 절차** (RUNBOOK §2 준수):
- `git mv old/path.md new/path.md`
- Edit 신규 파일 + sed cross-ref 갱신 (`xargs sed -i ''`)
- `git add -u` (최후 staging 의무)
- `git status --short` + `git diff --cached --stat` 검증
- `git commit -m "..."`
```

---

## 5. 에이전트 책임 분장

| 에이전트 | 책임 | 위반 시 |
|----------|------|---------|
| **architect** | 코드/스크립트/CI plan 작성 시 §2 체크리스트 명시 | Oracle 회수 + plan 재작성 |
| **scribe** | 문서 이동/리네이밍 plan 작성 시 §2 체크리스트 명시 | Oracle 회수 + plan 재작성 |
| **conductor** | plan review 시 §2 누락 발견 | Oracle 보고 |
| **critic** | Auto-Critic 단계에서 commit 누락 의심 시 staging 명령 검증 요구 | P2 적발 후 fix 요청 |

---

## 6. 운영 절차

### 로컬 plan 작성
1. 작업 분류 (§2.1) 식별
2. staging 명령 결정 (§2.2)
3. plan 본문에 `**staging 절차**:` 섹션 명시
4. 실행 후 §2.3 검증 의무

### CI 자동화 — **Sprint 155 완료**

**3단 안전망 완성** (Sprint 155 시드 #22):

| 단계 | 도구 | 차단 대상 |
|------|------|-----------|
| **plan 단계** (본 RUNBOOK) | plan 작성 시 `**staging 절차**:` 섹션 명시 | 실행 전 사전 설계 누락 |
| **pre-push 단계** | `.husky/pre-push` → `scripts/check-staging-integrity.mjs` | push 직전 untracked broken ref + unstaged 수정 |
| **CI 단계** | `quality-docs` job → `scripts/check-doc-refs.mjs` | PR 단계 tracked .md broken ref |

> **pre-push hook 상세**: `docs/runbook/pre-push-check.md` 참조
> **ADR**: `docs/adr/sprints/sprint-155.md`

---

## 7. 이력

- **2026-05-14** — Sprint 154 시드 #20: 본 RUNBOOK 신설. Sprint 153 Phase A/E 두 차례 재발 사례 기반 체크리스트 + `.claude/commands/agents/architect.md` + `scribe.md` 페르소나에 cross-ref 추가
- **2026-05-14** — Sprint 155 시드 #22: §6 CI 자동화 항목 "Sprint 155 완료" 갱신 — pre-push hook 도입으로 3단 안전망 완성. `docs/runbook/pre-push-check.md` cross-ref 추가
