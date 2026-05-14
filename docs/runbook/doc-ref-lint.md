# Runbook: 마크다운 cross-ref 무결성 lint

> **적용 범위**: 모든 tracked `.md` 파일 (158개) — `git ls-files '*.md'` 대상
> **도입**: Sprint 154 시드 #21 (Sprint 153 Phase G에서 5종 슬러그 23회 broken ref 적발 → 정기 자동화)
> **관련 스크립트**: `scripts/check-doc-refs.mjs`
> **관련 RUNBOOK**: `docs/runbook/regex-robustness.md`, `docs/runbook/claude-commands.md`

---

## 1. 개요

Sprint 153 Phase G 회고에서 5종 슬러그 **23회 broken ref**가 누적 적발되었다.

| 슬러그 (해소 이전) | 참조 횟수 | 해소 방식 |
|--------------------|-----------|-----------|
| `docs/runbook-monitoring-log-rules.md` | 15회 | 신규 `docs/conventions/monitoring-logging.md` 생성 |
| `docs/runbook-ci-cd-rules.md` | 3회 | 신규 `docs/conventions/ci-cd.md` 생성 |
| `docs/runbook-annotation-dictionary.md` | 3회 | 신규 `docs/conventions/annotation-dictionary.md` 생성 |
| `docs/runbook-migration-rules.md` | 1회 | `docs/conventions/migration-naming.md` cross-ref 갱신 |
| `docs/runbook-work-progress-guide.md` | 1회 | 참조 제거 |

23회 모두 **동종 결함**: 디렉토리 이동/이름 변경 후 cross-ref 누락. 본 lint는 미래 동종 결함의 사전 차단을 목표로 한다.

---

## 2. 검사 룰

`scripts/check-doc-refs.mjs` 는 두 가지 ref 패턴을 추출하여 파일 존재 여부를 검증한다.

### 2.1 Markdown link

```markdown
참조: [문서명](docs/runbook/example.md)
참조: [문서명](docs/runbook/example.md#section)
참조: [문서명](../relative/path.md)
```

- `[text](path)` 의 `path` 부분 추출
- anchor `#section` 은 분리하여 path 만 검증
- title `[text](path "title")` 의 title 은 무시

### 2.2 Bare doc path

```markdown
참조 docs/runbook/example.md 갱신 필요
```

- 텍스트 내 `docs/.../*.md` 패턴 추출 (link 외부 노출)
- anchor 분리 동일

---

## 3. 자동 면제

다음은 검사 대상에서 자동 제외된다.

| 패턴 | 예시 | 이유 |
|------|------|------|
| 외부 URL | `https://github.com/...`, `http://...`, `mailto:...`, `file://...` | repo 트리 외부 |
| Anchor-only | `#section` | 현재 파일 내부 |
| 템플릿 변수 | `${var}`, `{{var}}`, `<placeholder>` | 동적 경로 |
| 코드 펜스 내부 | ` ``` ... ``` ` | 예시/샘플 코드 |
| 인라인 코드 | `` `path/example.md` `` | 코드 표기 |

---

## 4. 명시 면제 디렉티브

repo 외부 경로 (예: 사용자 home `~/.claude/projects/...`) 를 link 로 보존해야 할 때 라인 끝에 디렉티브를 추가한다.

```markdown
- 참조: [memory](../../../../../.claude/projects/.../memory.md) <!-- doc-ref-lint: ignore -->
```

**판정 기준**:
- ✅ 사용자 home memory 경로 — repo 트리 외부, 머신마다 다름
- ✅ 의도적으로 미작성 상태 stub link — 본문에서 명시적으로 "예정" 표기 필요
- ❌ 단순 누락 broken link — 즉시 fix 또는 면제 사유 없이 면제 금지

---

## 5. 신규 .md 추가 시 의무

1. **이동/리네이밍 후 cross-ref grep 의무**: `git ls-files '*.md' | xargs grep -l "<이전 경로>"` 로 잔여 ref 전수 점검
2. **삭제 후 grep 의무**: 동일 명령으로 잔여 ref 0건 확인
3. **slug 도입 시 lint 즉시 실행**: `node scripts/check-doc-refs.mjs` 로 신규 broken ref 없음 확인
4. **CI paths filter**: `docs` filter (`docs/**/*.md`, `*.md`, `.claude/commands/**/*.md`, `blog/content/**/*.mdx`, `scripts/check-doc-refs.mjs`) 가 변경을 감지하여 자동 실행

---

## 6. self-test fixture

스크립트는 매 실행 Sprint 153 Phase G 5종 슬러그를 inline fixture 로 검증한다 (`runRegressionFixtures()`).

- ✅ 5/5 모두 broken 으로 검출 → exit 진행
- ❌ 검출 수 불일치 → **exit 2 self-test 실패** — 어떤 룰이 너무 좁아지거나 면제가 과도해진 시점에 즉시 인지

본 fixture 는 5종 슬러그가 해소된 후에도 **회귀 차단 기준선** 역할을 한다.

---

## 7. exit code 정책

| exit | 상태 | 처리 |
|------|------|------|
| 0 | 모든 ref 정상 | CI green |
| 1 | broken ref 존재 | CI fail — 본 문서 §4 면제 디렉티브 또는 즉시 fix |
| 2 | self-test fixture 실패 | CI fail — 룰/면제 로직 검토 + RUNBOOK §6 참조 |

---

## 8. 운영 절차

### 로컬 실행
```bash
# tracked 파일만 스캔 (기본)
node scripts/check-doc-refs.mjs

# untracked .md 포함 스캔 (Sprint 155 신규 옵션)
node scripts/check-doc-refs.mjs --include-untracked
```

### CI 실행
- Job: `quality-docs` (`.github/workflows/ci.yml`)
- 트리거: `docs` paths filter 매치 시 자동 실행
- 결과: GitHub PR Checks 에 `Quality — docs` 항목으로 노출

### untracked .md 한계 및 보완

> **⚠️ 본 lint 는 `git ls-files` 기반 → untracked 파일 미커버.**
>
> Sprint 154 PR #246 사후 적발 사례: `sprint-149~153.md` 가 untracked 상태일 때 로컬 lint 통과 → commit 후 CI 에서 처음 적발. Sprint 154 교훈 #4 직접 인용.
>
> **보완**: pre-push hook (`docs/runbook/pre-push-check.md`) 이 push 직전 untracked .md broken ref 를 `git ls-files --others --exclude-standard` 로 추가 스캔. `--include-untracked` 옵션으로 로컬 수동 검증도 가능.

### 부채 발견 시
1. **단순 누락**: 정확한 경로로 link 수정 또는 새 파일 stub 생성
2. **외부 경로 의도적 보존**: §4 디렉티브 추가
3. **lint 룰 자체 결함 의심**: §6 fixture 재실행 후 RUNBOOK §2 룰 정합성 검토
4. **untracked 파일 broken ref**: `node scripts/check-doc-refs.mjs --include-untracked` 또는 `node scripts/check-staging-integrity.mjs` 로 확인

---

## 9. 이력

- **2026-05-14** — Sprint 154 시드 #21: 본 RUNBOOK 신설 + `scripts/check-doc-refs.mjs` 도입 + CI `quality-docs` job 추가. Sprint 153 Phase G 5종 슬러그 self-test fixture 등록
- **2026-05-14** — Sprint 155 시드 #22: §8 untracked 한계 명시 + `--include-untracked` 옵션 안내 + pre-push hook cross-ref (`docs/runbook/pre-push-check.md`) 추가. Sprint 154 교훈 #4 1:1 매핑
