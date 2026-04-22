---
sprint: 117
title: "전체 에이전트 Critic 피드백 통합 + 코드 리팩토링"
period: "2026-04-22"
status: complete
start_commit: 78e43d2
end_commit: fff8314
---

# Sprint 117 — 전체 에이전트 Critic 피드백 통합 + 코드 리팩토링

## 배경

Sprint 114~116에서 Critic(Codex 교차 리뷰) 에이전트 신설과 dispatch 파이프라인 통합을 완료했지만, 호출은 여전히 **수동 트리거**에 머물러 있었다. code-changing 에이전트가 커밋을 남겨도 자동으로 Critic 리뷰가 걸리지 않아, 실제 merge-gate 역할이 불완전했다.

또한 `frontend/src/lib/api.ts` 가 860줄 단일 파일로 17개 도메인 API가 혼재해 있어, 이번 기회에 **Critic 피드백 루프를 실증할 시범 리팩토링 대상**으로 선정했다.

## 목표

| Phase | 내용 | 상태 |
|-------|------|------|
| A | 코드 변경 에이전트 완료 후 Critic 자동 체인 워크플로우 구축 | ✅ 완료 |
| B | `api.ts` (860줄) → `api/` 12개 도메인 모듈 분리 (시범 사례) | ✅ 완료 |
| C | Critic 교차 리뷰 수령 + 판정 | ✅ 완료 |

## 핵심 결정 (D1~D5)

### D1. Runner script cleanup()에 auto-critic 체인 삽입
**선택**: `oracle-spawn.sh` runner 템플릿의 `cleanup()` 함수에 HEAD 비교 로직 추가.
**대안**: dispatch post-run, 에이전트별 훅.
**근거**: 에이전트 단위 `HEAD_BEFORE` 보존이 가장 정확. dispatch post-run은 여러 에이전트 완료가 뭉쳐서 커밋 범위 특정 불가.

### D2. 새 스크립트 `oracle-auto-critic.sh` 분리
**선택**: 자동 Critic 체인 로직을 별도 스크립트로 분리.
**근거**: 단일 책임 원칙. 독립 스모크 테스트 가능. runner 템플릿은 단순히 호출만.

### D3. code-changing 에이전트 9개를 `.claude-team.json` 에 단일 소스로 명시
**포함**: conductor, gatekeeper, librarian, architect, postman, curator, herald, palette, sensei
**제외**: scribe(기록), critic(자기참조 방지), scout(검증)
**근거**: 정합성 단일 지점. `oracle-auto-critic.sh` 의 `CODE_CHANGING_AGENTS` 와 동기화.

### D4. Critic 자기참조 방지
**선택**: `oracle-auto-critic.sh` 에서 입력 에이전트가 critic이면 즉시 스킵.
**근거**: 무한 루프(Critic → Critic → ...) 방지.

### D5. Phase B 시범 대상은 `api.ts` 도메인 분리
**근거**: (1) 860줄 단일 파일로 가장 표면적 부채, (2) 17개 도메인 섹션이 이미 `// ──` 주석으로 명확히 분리되어 있어 저위험, (3) barrel export로 72개 import 무변경 유지 가능.

## 구현

### Phase A — 인프라 (리포 외부 + 리포 내)
**리포 외부 (`~/.claude/oracle/bin/`)**:
- `oracle-auto-critic.sh` **신규**: 에이전트명 + task_id + base_commit 인자 수신, code-changing 에이전트이고 HEAD가 변경되었으면 `oracle-create-task.sh --simple` 로 Critic task 자동 생성
- `oracle-spawn.sh` 수정: runner 템플릿에 `HEAD_BEFORE=$(git rev-parse HEAD)` + `cleanup()`에서 `oracle-auto-critic.sh` 호출 삽입

**리포 내**:
- `.claude-team.json`: `dispatch.codeChangingAgents[9]` + `dispatch.autoCritic{enabled,trigger,method}` 추가 (commit `17cf39a`)
- `.claude/commands/agents/_base.md`: 자동 Critic 리뷰 규칙 섹션 추가 (gitignore로 커밋 안 됨)

### Phase B — `api.ts` 860줄 → `api/` 12파일

| 파일 | 라인 수 | 도메인 |
|------|---------|--------|
| `client.ts` | 147 | fetchApi, fetchPublicApi, ApiError, StudyRequiredError |
| `types.ts` | 126 | Problem, Submission, Study 등 공유 인터페이스 12개 |
| `auth.ts` | 69 | authApi, settingsApi |
| `study.ts` | 133 | studyApi, shareLinkApi, StudyStats |
| `problem.ts` | 26 | problemApi |
| `submission.ts` | 80 | submissionApi, draftApi, aiQuotaApi |
| `external.ts` | 86 | solvedacApi, programmersApi |
| `notification.ts` | 43 | notificationApi |
| `review.ts` | 82 | reviewApi, studyNoteApi |
| `public.ts` | 54 | publicApi (인증 불필요) |
| `feedback.ts` | 77 | feedbackApi, adminApi |
| `index.ts` | 59 | barrel re-export |

**호환성**: 72개 import(`@/lib/api`) 지점 무변경. `tsc --noEmit` 0 errors. (commit `fff8314`)

### Phase C — Critic 교차 리뷰
- **세션 ID**: `019db399-45eb-7343-9295-bc072cdbd085`
- **명령**: `codex review --base 78e43d2`
- **판정**: ✅ "no actionable regressions were identified"
- **스코프 외 P1 발견 (즉시 교정)**: `critic.md` stdin 문법(`--base <ref> - <<< "..."`)이 codex 0.122.0 CLI와 비호환 — `--base`/`--commit`과 `[PROMPT]`(`-` stdin 포함) 상호 배타. `--uncommitted "prompt"` 또는 프롬프트 단독 사용으로 교정.

## 검증

### 5곳 정합성 검증 (Sprint 116 교훈 적용)
| # | 검증 지점 | 상태 |
|---|----------|------|
| 1 | `.claude-team.json` codeChangingAgents (9개) | ✅ |
| 2 | `oracle-auto-critic.sh` CODE_CHANGING_AGENTS | ✅ |
| 3 | `oracle-create-task.sh` VALID_AGENTS | ✅ |
| 4 | `oracle-spawn.sh` VALID_AGENTS + cleanup() auto-critic 호출 | ✅ |
| 5 | `oracle-watchdog.sh` get_tier() | ✅ |
| 6 | `_base.md` 자동 Critic 섹션 | ✅ |

### 스모크 테스트 (4/4 PASS)
| 시나리오 | 예상 | 결과 |
|----------|------|------|
| code-changing agent + HEAD 동일 | 스킵 | ✅ |
| 비 code-changing (scribe) | 스킵 | ✅ |
| 자기참조 방지 (critic) | 스킵 | ✅ |
| code-changing agent + HEAD 변경 | Critic task 자동 생성 | ✅ |

### 리팩토링 회귀 검증
- `tsc --noEmit`: 0 errors
- Jest: 120 suites / 1259 tests PASS
- 커버리지: lines 85.99% / branches 76.95% (threshold 83/71 상회)

## 주요 교훈

1. **Critic 리뷰 범위는 diff only**: `codex review --base <ref>` 는 변경분만 검토. 전체 레포 감사는 별도 설계 필요 (Sprint 118 대상).
2. **Codex 출력 오염 주의**: `frontend/coverage/` HTML과 `.next/` 빌드 아티팩트가 리뷰 컨텍스트에 끼어들어 출력 1MB+ 폭증. 리뷰 전 `rm -rf coverage .next` 필요.
3. **critic.md CLI 문법 테스트 필수**: Sprint 114 신설 시 문서화한 stdin 문법이 실제 codex 0.122.0과 다름. 다음 codex 버전 업 시 재검증.
4. **인터랙티브 vs tmux dispatch**: 자동 Critic 체인은 runner 스크립트 cleanup()에서만 발동. 인터랙티브 세션에서는 Oracle 수동 호출 필요. Sprint 118 E2E 검증은 tmux 기반.

## 이월 항목

- auto-Critic 체인 tmux dispatch 모드 E2E 검증 (인터랙티브에서 스모크만 완료)
- P0/P1 자동 검출 → 자동 수정 위임 루프 (현재는 Oracle 수동 중재)

## 커밋 맵

| Commit | 범위 | 내용 |
|--------|------|------|
| `17cf39a` | chore(infra) | `.claude-team.json` autoCritic 메타 |
| `fff8314` | refactor(frontend) | `api.ts` 860줄 → `api/` 12파일 분리 |
| (리포 외부) | - | `oracle-auto-critic.sh` 신규, `oracle-spawn.sh` runner 템플릿 수정 |
| (.claude/ gitignore) | - | `_base.md` 자동 Critic 섹션, `critic.md` stdin 문법 교정, prompts 12/12 리빌드 |
