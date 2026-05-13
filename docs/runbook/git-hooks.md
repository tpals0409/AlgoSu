# Runbook: Git Hooks (commitlint pre-commit 자동화)

> **관련**: `commitlint.config.mjs`, `.husky/commit-msg`, `docs/ci-cd-rules.md`
> **도입**: Sprint 105 [C] — scope-enum 동적 생성 + 로컬 조기 실패 자동화

---

## 개요

AlgoSu는 루트 `package.json`에 [Husky v9](https://typicode.github.io/husky/) + [@commitlint/cli v19](https://commitlint.js.org/)를 설치하여, **커밋 시점**에 Conventional Commits 규칙을 자동 검증한다.

- CI(`wagoid/commitlint@v6`)와 이중 방어선 구성
- `services/` 디렉토리를 런타임 스캔하여 scope-enum을 동적 생성 → 서비스 추가/제거 시 수동 유지 불필요

---

## 설치 절차

신규 클론 또는 첫 설정 시 **루트 디렉토리**에서 실행:

```bash
# 1. 루트에서 의존성 설치 (husky install 자동 실행)
npm install

# 2. 설치 확인
cat .husky/commit-msg
# 출력: npx --no -- commitlint --edit "$1"

# 3. git core.hooksPath 확인
git config core.hooksPath
# 출력: .husky/_   ← husky v9 기본값
```

> **주의**: `npm install`은 루트 `package.json` 전용이다. `services/*`, `frontend/`, `blog/` 의 각자 `package.json`은 별도 디렉토리에서 독립 실행해야 한다.

---

## 동작 확인

### 유효하지 않은 scope — 거부 확인

```bash
git commit --allow-empty -m "chore: invalid-scope-test"
# ✗ scope-empty 경고 또는 scope 누락으로 거부
```

```bash
git commit --allow-empty -m "chore(unknown-service): test"
# ✗ scope-enum 위반 — 오류 메시지 출력 후 커밋 중단
```

### 유효한 커밋 — 통과 확인

```bash
git commit --allow-empty -m "chore(github-worker): valid test"
# ✓ commitlint 통과
```

---

## 트러블슈팅

### Hook이 동작하지 않을 때

```bash
# core.hooksPath 확인
git config core.hooksPath
# .husky/_ 이 아니면 → npm install 재실행

# 수동으로 hooksPath 설정 (긴급 복구)
git config core.hooksPath .husky/_

# hook 실행 권한 확인
ls -la .husky/commit-msg
# -rwxr-xr-x 이어야 함
```

### `Cannot find module '@commitlint/cli'` 오류

```bash
# 루트 node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### `HUSKY=0` 임시 우회 (긴급 커밋 시에만)

```bash
HUSKY=0 git commit -m "chore(ci): 긴급 수정 — hook 우회"
```

> **경고**: 우회 시 CI `wagoid/commitlint@v6`에서 재검증된다. PR 단계에서 실패하면 `git commit --amend`로 메시지 수정 필요.

---

## CI 영향 분석

| 항목 | 상태 |
|------|------|
| `wagoid/commitlint@v6` 잡 | **영향 없음** — `commitlint.config.mjs` 그대로 읽음 |
| 기존 서비스 잡 (`working-directory` 지정) | **영향 없음** — 루트 `node_modules`와 독립 |
| `detect-changes` path filter | **영향 없음** — `package.json`, `.husky/` 경로 미포함 |

CI 환경에서 `wagoid/commitlint@v6`는 리포지토리를 체크아웃한 후 `commitlint.config.mjs`를 읽고, 그 안에서 `readdirSync('./services')`를 실행한다. GitHub Actions의 워크스페이스가 리포 루트이므로 `services/` 디렉토리 접근이 정상 동작한다.

---

## scope-enum 동적 생성 원리

`commitlint.config.mjs`는 런타임에 `services/` 디렉토리를 스캔한다:

```js
import { readdirSync } from 'node:fs';

const services = readdirSync('./services', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
// 현재: ['ai-analysis', 'gateway', 'github-worker', 'identity', 'problem', 'submission']

const staticScopes = ['adr', 'blog', 'ci', 'deps', 'docs', 'e2e', 'frontend', 'infra', 'runbook', 'security'];
// scope-enum = [...services, ...staticScopes].sort()
```

새 서비스 디렉토리를 `services/` 하위에 추가하면 **즉시** scope-enum에 반영된다. `commitlint.config.mjs` 수동 편집 불필요.

---

## 관련 문서

- `docs/ci-cd-rules.md` — CI Conventional Commits 정책
- `docs/runbook-ci-rebuild-all.md` — CI 인프라 PR 표준 절차
- `memory/feedback-commitlint-scope.md` — 배경 피드백 기록
