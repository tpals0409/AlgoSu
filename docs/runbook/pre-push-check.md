---
@file docs/runbook/pre-push-check.md
@domain ci
@layer runbook
@related scripts/check-staging-integrity.mjs, scripts/check-doc-refs.mjs
---
# Runbook: Pre-push 무결성 검증 (pre-push hook)

> **적용 범위**: 모든 push 직전 자동 실행 — untracked .md broken ref + commit 누락 의심 패턴
> **도입**: Sprint 155 시드 #22 (Sprint 153 Phase A/E 사고 + Sprint 154 §6 명시 + Sprint 154 교훈 #4 보강)
> **관련 RUNBOOK**: `docs/runbook/git-staging-checklist.md`, `docs/runbook/doc-ref-lint.md`, `docs/runbook/git-hooks.md`
> **관련 스크립트**: `scripts/check-staging-integrity.mjs`

---

## 1. 개요

Sprint 153/154 에서 두 종류의 사각지대가 확인되었다.

| 스프린트 | 사고 | 사각지대 |
|----------|------|----------|
| Sprint 153 Phase E (PR #240 → #241 hotfix) | sed 결과 staged 누락 → main broken link 19건 노출 | CI `quality-docs` job 은 tracked 파일만 스캔 |
| Sprint 154 PR #246 | untracked sprint-153.md 가 home 경로를 참조 → commit 후 CI 에서 처음 적발 | `git ls-files` 기반 lint 는 untracked 파일 미커버 |

두 사고 모두 **push 직전 검증이 없었기 때문**에 CI 또는 reviewer 가 최종 방어선이 되었다.

본 pre-push hook 은 push 직전 로컬에서 두 가지를 차단하여 **plan(Sprint 154 A) → pre-push(본 RUNBOOK) → CI lint(Sprint 154 B) 3단 안전망**을 완성한다.

---

## 2. 검증 항목

### 2.1 검증 1 — untracked .md broken ref (Sprint 154 교훈 #4 직접 보강)

**배경**: `git ls-files` 기반 `check-doc-refs.mjs` 는 tracked 파일만 스캔한다. untracked 상태의 신규 .md 파일이 broken ref 를 포함해도 CI 단계에서는 commit 후에야 최초 검출된다.

**검증 방법**:
```bash
git ls-files --others --exclude-standard "*.md"
# → 미추적 .md 목록 수집
# → check-doc-refs.mjs의 validateRef / extractMarkdownLinks /
#    extractBareDocPaths / stripInlineCode 함수 재사용하여 broken ref 검증
```

**면제**:
- 라인 끝 `<!-- staging-check: ignore -->` 또는 `<!-- doc-ref-lint: ignore -->` (양쪽 호환)
- 코드 펜스 내부, 인라인 코드, 외부 URL (`https://`, `http://`, `mailto:`, `file:`)
- anchor-only 참조 (`#section`)

**exit code**:
- broken ref 없음 → `[OK]` 출력 후 계속
- broken ref 존재 → `[FAIL]` 출력 + `process.exit(2)` (push 차단)

### 2.2 검증 2 — commit 누락 의심 패턴 (Sprint 153 Phase E 직접 차단)

**배경**: `git commit` 은 staged 영역만 처리한다. sed 또는 Edit 로 수정한 파일이 staging 안 된 채 push 될 경우, 변경이 remote 에 반영되지 않는다.

**검증 방법**:
```bash
git status --porcelain
# Y 컬럼 == 'M' → worktree 에 수정 있으나 staged 안 된 파일
# 형식: XY filepath  (X = index, Y = worktree)
```

**동작**:
- unstaged 수정 파일 없음 → `[OK]` 출력 후 계속
- unstaged 수정 파일 존재 → `[WARN]` 출력 + `process.exit(1)` (push 차단)
  - 경고 메시지: "이 변경사항은 push할 commit에 포함되지 않습니다. 의도적이면 계속해도 됩니다."
  - **의도적 unstaged** (예: WIP 파일) → §5 우회 절차 참조

---

## 3. 면제 정책

### 자동 면제
아래 패턴은 검증 대상에서 자동 제외된다.

| 패턴 | 예시 | 이유 |
|------|------|------|
| 외부 URL | `https://...`, `http://...`, `mailto:...`, `file://...` | repo 트리 외부 |
| Anchor-only | `#section` | 현재 파일 내부 |
| 코드 펜스 내부 | ` ``` ... ``` ` | 예시/샘플 코드 |
| 인라인 코드 | `` `path/example.md` `` | 코드 표기 |

### 명시 면제 디렉티브
repo 외부 경로, 또는 의도적으로 아직 존재하지 않는 경로를 참조할 때:

```markdown
[memory](../../../../../.claude/projects/.../memory.md) <!-- staging-check: ignore -->
<!-- doc-ref-lint: ignore --> 도 동일하게 동작
```

> **주의**: 의도 없는 broken link 에 면제 디렉티브를 붙이지 말 것. 즉시 fix 또는 stub 생성이 올바른 대응이다.

---

## 4. 운영 절차

### Husky 활성화 (신규 클론)

```bash
# 루트에서 의존성 설치 (husky install 자동 실행)
npm install

# pre-push hook 확인
cat .husky/pre-push
# 출력: npx --no -- node scripts/check-staging-integrity.mjs

# git core.hooksPath 확인
git config core.hooksPath
# 출력: .husky/_
```

### push 시 자동 실행

```bash
git push
# → .husky/pre-push 자동 실행
# → scripts/check-staging-integrity.mjs 검증 결과 출력
# → exit 0: push 진행 / exit 1 or 2: push 차단
```

### 수동 실행 (로컬 검증)

```bash
node scripts/check-staging-integrity.mjs
```

---

## 5. 우회

의도적으로 hook 을 건너뛸 경우 `--no-verify` 플래그를 사용한다.

```bash
git push --no-verify
```

**우회가 허용되는 케이스**:
- WIP 브랜치의 중간 push (스냅샷 목적, CI PR check 없음)
- CI 환경 또는 자동화 스크립트에서 hook 이 불필요할 때
- hook 자체의 오동작(false positive) 이 확인된 경우 — §6 FAQ 참조

> **경고**: PR 머지 전에는 반드시 hook 통과 확인 필요. `--no-verify` 우회 후 CI `quality-docs` job 이 broken ref 를 잡을 수 있다.

---

## 6. FAQ

### Q. `[WARN] staged 안 된 수정 파일` 메시지가 나왔으나 의도적이다. 어떻게 해야 하나?

push 차단 (exit 1) 은 의도적 unstaged 에서도 발생한다. WIP 파일 등 의도적 케이스면 `git push --no-verify` 로 우회한다.

### Q. untracked .md broken ref 가 false positive 로 보인다.

`validateRef` 가 상대 경로를 잘못 해석하는 경우일 수 있다. 아래 순서로 진단:

```bash
# 1. 수동으로 경로 검증
node -e "require('fs').statSync('docs/runbook/pre-push-check.md')"

# 2. 면제 디렉티브 추가 (임시 허용)
# 라인 끝에 <!-- staging-check: ignore --> 추가

# 3. 이슈 확인 후 scripts/check-staging-integrity.mjs 로직 개선 또는 Oracle 보고
```

### Q. 새 작업 브랜치에서 신규 파일을 추가하고 있는데 매번 hook 이 실패한다.

untracked .md 에 broken ref 가 있는 경우다. 파일 내부의 link 경로를 확인하거나 면제 디렉티브를 사용한다. 새 파일의 참조 대상 파일이 아직 미작성 stub 이면 먼저 stub 을 생성한다.

### Q. self-test fixture 실패 (exit 2) 가 발생했다.

`scripts/check-staging-integrity.mjs` 내부 로직 오류다. `runRegressionFixtures()` 의 2개 시나리오(Sprint 153 Phase E / Sprint 154 PR #246)가 예상 결과와 다르다는 의미이므로 스크립트를 점검하고 Oracle 에 보고한다.

---

## 7. 이력

- **2026-05-14** — Sprint 155 시드 #22: 본 RUNBOOK 신설 + `scripts/check-staging-integrity.mjs` + `.husky/pre-push` shim 도입 (Sprint 155 Phase 1, architect). plan(Sprint 154 A) + pre-push(본 sprint) + CI lint(Sprint 154 B) 3단 안전망 완성.
