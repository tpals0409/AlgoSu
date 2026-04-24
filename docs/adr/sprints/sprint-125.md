---
sprint: 125
title: "Sprint 124 이월 9항목 마감 — i18n 완결 + OAuth 에러 정규화 + Oracle 인프라"
period: "2026-04-24"
status: completed
start_commit: 7f753a8
end_commit: f627971
prs:
  - "#142 feat(i18n): Wave A 기계적 품질 개선 + Critic follow-up (squash f6c0391)"
  - "#143 feat(i18n): Wave B i18n 번역 보강 + B5 Critic follow-up (squash 83313ee)"
  - "#144 feat(auth): Wave C Gateway OAuth 정규화 (ADR-025) + identity atomicUpsert (squash 27d3f95)"
  - "#145 docs(adr): Wave D Oracle 인프라 조사 리포트 (squash f627971)"
---

# Sprint 125 — Sprint 124 이월 9항목 마감

## 배경

Sprint 124에서 이월된 9개 품질/기술부채 항목을 마감하여 i18n 시스템 + Oracle 인프라 성숙도를
완결 수준으로 끌어올리는 것이 목표. PM 원칙: **이월 0** — 각 Wave Critic Medium은 해당 Wave 내
follow-up으로 흡수, Low는 즉시 처리 또는 유지 근거 기록 후 종결.

### Sprint 124 이월 9항목 마감 현황

| # | 항목 | Wave | 상태 |
|---|------|------|------|
| 1 | useRouter 전역 locale-aware 교체 (15+ 파일) | A | ✅ |
| 2 | studies/[id]/room 하위 컴포넌트 텍스트 번역 | B-1 | ✅ |
| 3 | problems/create/edit 자체 i18n 잔여 | B-3 | ✅ |
| 4 | ADR-025 Gateway OAuth 에러 정규화 구현 | C | ✅ |
| 5 | 테스트 3건 ko-KR 하드코딩 정리 | A | ✅ |
| 6 | analytics 네임스페이스 기술부채 | B-2 | ✅ |
| 7 | admin-guard defaultLocale 하드코딩 제거 | A | ✅ (탐색 결과 이미 해소) |
| 8 | Oracle 인프라: short-task inbox Write permission 조사 | D | ✅ (조사 리포트 완료, 구현은 Sprint 126 예약) |
| 9 | Critic API 529 재시도 정책 | D | ✅ (조사 리포트 완료, 구현은 Sprint 126 예약) |

---

## Wave A — 기계적 품질 개선 (PR #142, squash `f6c0391`)

담당: palette (i18n), scribe (기록)

### A1 — useRouter 전역 locale-aware 교체

- 21 소스 파일 + 13 테스트 파일 = **34파일** `next/navigation useRouter` → `@/i18n/navigation useRouter` 전환
- 대상 디렉토리: `app/[locale]` 전체, `contexts/`, `components/`
- 이미 `@/i18n/navigation`을 쓰던 파일 누락 없이 전수 교체

### A2 — 테스트 3건 ko-KR 하드코딩 정리

- `NotificationBell.test.tsx`: `'알림'` 리터럴 → `t('notifications.title')` 모킹
- `ReplyItem.test.tsx`: `'답글'` 리터럴 → `t('reviews.reply')` 모킹
- `CommentThread.test.tsx`: `'댓글'` 리터럴 → `t('reviews.comment')` 모킹

### A3 — Sprint 123 Critic Low 흡수

- `FeedbackForm` / `FeedbackWidget` `useMemo` 의존성 배열 최적화
- `reviews.commentThread.replies` ICU 메시지 EN 복수형 (`{count, plural, =0{No replies} one{# reply} other{# replies}}`)

### A4 — Critic Medium follow-up 흡수

- `next/link` → `@/i18n/navigation Link` 전환 8파일
- `reviews.json` `=0` plural dead code 제거 ko/en
- `CommentThread` 테스트 정규식 6곳 정밀화 (`/n개의 댓글/` → `/\d+개의 댓글/`)

### A5 — admin-guard 탐색

- `admin-guard defaultLocale 하드코딩` grep 결과: `routing.defaultLocale` 이미 참조 중 → 변경 불필요, 항목 종결

**Critic 결과**: ✅ 머지 가능

---

## Wave B — i18n 번역 보강 (PR #143, squash `83313ee`)

담당: palette (번역), scribe (기록)

### B1 — studies/[id]/room 번역

- `AnalysisView.tsx` 5줄 한글 리터럴 번역
- 네임스페이스: `studies` (Sprint 124에서 신설, 재사용)

### B2 — analytics 네임스페이스 이관

- `dashboard.analyticsSection.*` → `analytics.*` 네임스페이스 독립 분리
- 영향 파일: `analytics/page.tsx`, `analytics/components/*`
- 기존 `dashboard` 네임스페이스 잔여 키 정리

### B3 — problems/create·edit 자체 i18n

- `problems/create/page.tsx` + `problems/[id]/edit/page.tsx` 자체 번역 52키
- 커밋: `4961053` (B3 본체) + `dfaf7c2` (fix: TypeScript strict 오류 교정)

### B4 — OnboardingStepper 번역 (Wave A Critic Low 편입)

- `OnboardingStepper.tsx` 한글 리터럴 3개 → `common.onboarding.*` 키

### B5 — Wave B Critic Medium+Low 흡수

- analytics `'미분류'` 카테고리 → `t('analytics.uncategorized')`
- problems 아이콘 `aria-label` → `t('problems.filter.ariaLabel')`

**신규 번역 키**: 153개 (ko 76 + en 77)
**Critic 결과**: ✅ 2회 모두 머지 가능

### Sprint 126 기술부채 등록 (Wave B에서 발견)

- `difficultyData` 배열 `useMemo` 추출 (analytics/page.tsx 인라인 상수 — pre-existing)
- unclassified 차트 비대칭: ko `'미분류'` vs en `'Unclassified'` 데이터 레이어 불일치 (pre-existing)

---

## Wave C — Gateway OAuth 에러 코드 정규화 (ADR-025 구현)

담당: gatekeeper (C1), palette (C2), scribe (C3)

브랜치: `feat/sprint-125-wave-c-oauth-normalization`

### C1 — Gateway 백엔드 enum + Exception 7종 (commit `0d13282`)

- `services/gateway/src/auth/oauth/exceptions/` 신규 디렉토리
  - `oauth-callback.exception.ts` — `OAuthCallbackErrorCode` type + 기반 클래스 + 7 Exception 클래스
  - `index.ts` — 배럴 익스포트
- `oauth.service.ts`: `validateAndConsumeState()` → `OAuthInvalidStateException`, 토큰 교환 → `OAuthTokenExchangeException`, 프로필 조회 → `OAuthProfileFetchException`, 계정 충돌 → `OAuthAccountConflictException`
- `oauth.controller.ts` catch 블록: `instanceof OAuthCallbackException` 분기 → `e.code` redirect (한글 `encodeURIComponent` 방식 폐지)
- `oauth.controller.spec.ts`: Exception 7종 분기별 redirect URL 검증 테스트 추가
- `oauth.service.spec.ts`: 각 throw 지점 Exception 클래스 검증 테스트 추가

### C2 — 프론트엔드 ALLOWED_ERRORS 확장 + i18n 6키 (commit `98a1621`)

- `callback/page.tsx` `ALLOWED_ERRORS` 7종 완성 (기존 4종 → `token_exchange`, `profile_fetch`, `account_conflict` 추가)
- `ERROR_KEY_MAP` 동일 3개 `callback.error.*` 키 매핑 추가
- `messages/ko/auth.json` `callback.error.*` 3키 추가
- `messages/en/auth.json` `callback.error.*` 3키 추가

### C3 — ADR-025 Accepted 승격 + sprint-125.md 초안 (본 커밋)

- `docs/adr/ADR-025-gateway-oauth-error-normalization.md`: 상태 `proposed` → `accepted`, 구현 결과 섹션 추가
- `docs/adr/sprints/sprint-125.md`: 본 파일 신규 생성

---

## Wave D — Oracle 인프라 (herald + sensei) — ✅ 조사 완료, Oracle 적용 대기

### D1 — Critic API 529 재시도 로직 조사 및 설계 (herald)

#### 근본 원인 분석

Sprint 124 Critic 7회 중 1회 (`critic-task-20260424-115243-51116`) 529 Overloaded 발생.
로그 확인 결과:

```
# ~/.claude/oracle/logs/critic-task-20260424-115243-51116.out
API Error: 529 Overloaded. This is a server-side issue, usually temporary — try again in a moment.
If it persists, check status.claude.com.
```

**발생 지점**: `claude -p` 자체 호출 실패 (Claude API 레이어). Critic 에이전트 내부의
`codex review` Bash 호출이 아님. 즉, 에이전트가 시작조차 되지 못한 상태.

#### 재시도 옵션 비교

| 옵션 | 위치 | 실효성 | 구현 주체 |
|------|------|--------|-----------|
| A | `critic.md` 프롬프트에 재시도 지시 | ❌ 에이전트가 시작되지 않으므로 무효 | Oracle |
| B | `oracle-spawn.sh` 러너 템플릿에 `claude -p` 재시도 루프 | ✅ 근본 지점 직접 처리, 전체 에이전트 커버 | Oracle (민감 파일) |
| C | `oracle-auto-critic.sh`에서 이전 실패 감지 후 재시도 task 재큐잉 | △ 간접 처리, 재시도 간격 길어짐 | Oracle (민감 파일) |

**권장: 옵션 B** — `oracle-spawn.sh` 러너 템플릿의 `claude -p` 호출부를 재시도 루프로 래핑.
모든 에이전트(Critic 포함)에 일괄 적용되며 근본 지점을 직접 처리.

#### Oracle 적용 diff (옵션 B)

파일: `~/.claude/oracle/bin/oracle-spawn.sh`

**변경 위치**: `RUNNER_EOF` heredoc 내 `claude -p` 호출부 (현재 줄 175~182 근방)

```diff
-env -u CLAUDECODE NO_COLOR=1 TERM=dumb \\
-  claude -p "\$TASK_PROMPT" \\
-  --model "${model}" \\
-  --system-prompt "\$SYSTEM_PROMPT" \\
-  --permission-mode bypassPermissions \\
-  --add-dir "${INBOX_DIR}" \\
-  --output-format text \\
-  2>&1 | tee "${log_file}"
+# Sprint 125 D1: API 529 Overloaded 재시도 래퍼 (최대 3회, 지수 백오프 2s/4s/8s)
+_RETRY_MAX=3
+_RETRY_N=0
+_RETRY_BACKOFF=2
+
+while true; do
+  _TMP=\$(mktemp /tmp/oracle-runner-XXXXXX)
+  env -u CLAUDECODE NO_COLOR=1 TERM=dumb \\
+    claude -p "\$TASK_PROMPT" \\
+    --model "${model}" \\
+    --system-prompt "\$SYSTEM_PROMPT" \\
+    --permission-mode bypassPermissions \\
+    --add-dir "${INBOX_DIR}" \\
+    --output-format text \\
+    2>&1 | tee "\$_TMP" | tee -a "${log_file}" || true
+
+  if grep -qF "API Error: 529 Overloaded" "\$_TMP" && [[ "\$_RETRY_N" -lt "\$_RETRY_MAX" ]]; then
+    _RETRY_N=\$((_RETRY_N + 1))
+    echo "[runner][retry] API 529 Overloaded — \${_RETRY_BACKOFF}s 후 재시도 (\${_RETRY_N}/\${_RETRY_MAX})" | tee -a "${log_file}"
+    printf '%s\t%s\t%s\tretry=%s\tbackoff=%ss\n' \
+      "\$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${agent}" "${task_id}" "\$_RETRY_N" "\$_RETRY_BACKOFF" \
+      >> "${LOGS_DIR}/auto-critic-retry.log" 2>/dev/null || true
+    sleep "\$_RETRY_BACKOFF"
+    _RETRY_BACKOFF=\$((_RETRY_BACKOFF * 2))
+    rm -f "\$_TMP"
+  else
+    rm -f "\$_TMP"
+    break
+  fi
+done
```

#### HEREDOC 이스케이핑 주의사항

`<<RUNNER_EOF` (비quoted) heredoc에서:
- `\$_TMP` → runner에서 `$_TMP` (런타임 변수) ✅
- `\$(mktemp ...)` → runner에서 `$(mktemp ...)` (런타임 명령 치환) ✅
- `\${_RETRY_N}` → runner에서 `${_RETRY_N}` (런타임 변수) ✅
- `${model}`, `${INBOX_DIR}`, `${log_file}`, `${LOGS_DIR}`, `${agent}`, `${task_id}` → 러너 생성 시점 확장 (outer bash 변수) ✅
- `\\` at EOL → runner에서 `\` (줄 이음) ✅

#### 보조: oracle-auto-critic.sh 헤더 주석 추가 (옵션)

파일: `~/.claude/oracle/bin/oracle-auto-critic.sh`

```diff
 # 사용법: oracle-auto-critic.sh <agent> <task_id> <base_commit>
+#
+# Sprint 125 D1: 재시도 로그 경로 — oracle-spawn.sh runner가 append
+# RETRY_LOG: ~/.claude/oracle/logs/auto-critic-retry.log
 set -euo pipefail
+
+RETRY_LOG="${ORACLE_DIR}/logs/auto-critic-retry.log"
```

#### 재시도 로그 스펙

경로: `~/.claude/oracle/logs/auto-critic-retry.log`
형식 (TSV): `<ISO8601_UTC>\t<agent>\t<task_id>\tretry=<N>\tbackoff=<Xs>`
예시:
```
2026-04-24T16:44:00Z	critic	task-20260424-115243-51116	retry=1	backoff=2s
2026-04-24T16:44:02Z	critic	task-20260424-115243-51116	retry=2	backoff=4s
```

#### Oracle 승인 필요 항목

- [ ] `oracle-spawn.sh` 러너 템플릿 위 diff 적용 (민감 파일 — Oracle 직접 편집)
- [ ] `oracle-auto-critic.sh` 헤더 주석 추가 (옵션, Oracle 직접 편집)
- [ ] `~/.claude/oracle/logs/auto-critic-retry.log` 초기 파일 생성: `touch ~/.claude/oracle/logs/auto-critic-retry.log`

### D2 — short-task inbox Write permission 조사 리포트 (sensei)

#### 재현 사례 3건 요약

| # | task_id | 에이전트 | 타임라인 | 실패 형태 | Oracle 처리 |
|---|---------|----------|----------|-----------|-------------|
| 1 | task-20260424-151306-69314 | palette | 15:13~15:16 | **인지 스킵** — Write 미시도, stdout 요약만 출력 | completed_no_result (미복구) |
| 2 | task-20260424-161529-80208 | critic | 16:15~16:19 | **성공** — inbox 파일 3,498 bytes 정상 기록 | completed (baseline) |
| 3 | task-20260424-163101-82662 | critic | 16:31~16:33 | **권한 차단** — 에이전트가 명시적 오류 보고, stdout fallback | Oracle 수동 복구 → 16:37 inbox 파일 생성 |

**사례 3 에이전트 메시지 (원문)**:
> ⚠️ `/Users/leokim/.claude/oracle/inbox/` 경로 쓰기 권한이 차단되어 결과 파일 생성 실패.
> `.claude/settings.json` 또는 허용 목록에 해당 경로 추가가 필요합니다.

**성공 사례(#2) vs 실패 사례(#3)의 차이**: 두 작업 모두 동일한 모델(`claude-sonnet-4-6`), 동일한 runner 스크립트, 동일한 `--permission-mode bypassPermissions --add-dir ~/.claude/oracle/inbox` 플래그 사용. 외부적으로 구분 가능한 차이 없음.

#### 근본 원인 가설

현재 `oracle-spawn.sh` runner는 다음 조합을 사용:
```
claude -p ... --permission-mode bypassPermissions --add-dir ~/.claude/oracle/inbox
```

**H1 (주 가설)**: Claude Code는 `~/.claude/` 경로를 자체 설정 디렉토리로 인식해
내부 "sensitive path" 보호를 적용. 이 보호는 `bypassPermissions` 이후 단계에서
동작하여 `--add-dir`로 화이트리스트에 올려도 **비결정적으로** 차단이 발동.
→ 동일 플래그로도 세션마다 결과가 다른 이유 설명 가능.

**H2 (보조 가설)**: `env -u CLAUDECODE` 로 CLAUDECODE 환경변수를 제거하면
Claude Code가 "헤드리스 모드"로 동작하며, `--add-dir` 화이트리스트를
세션 컨텍스트에 정상 등록하지 못하는 타이밍 버그 존재.

**H3 (인지 실패)**: 사례 1(palette)처럼 일부 에이전트는 코드 작업 완료 후
결과 파일 Write 단계를 건너뛰는 인지 오류 발생 — 권한 문제가 아닌 프롬프트 준수 실패.

#### 후보 해결책 장단점 비교

| 해결책 | 방식 | 효과 | 노력 | 부작용 |
|--------|------|------|------|--------|
| **A. inbox 경로 rename** (`~/.claude/oracle/inbox` → `~/oracle-results`) | 구조 변경 — `~/.claude/` 보호 영역 완전 회피 | ✅ 근본 해결 | Medium (oracle-spawn/reap/watchdog 전 경로 갱신) | 기존 inbox 파일 이전 필요 |
| **B. oracle-reap.sh 자동 stdout 추출** | inbox 없으면 `.out` 파일 파싱 후 결과 자동 복구 | △ 우회 (근본 미해결) | Low | 포맷 의존성 — YAML frontmatter 누락 시 복구 실패 |
| **C. 프로젝트 settings.local.json 명시 Write 추가** | `/AlgoSu/.claude/settings.local.json`에 `Write(~/.claude/oracle/*)` 추가 | △ 부분 해결 (전역 `Write(*)` 있음에도 차단 발생 — 효과 불확실) | Very Low | 없음 |
| **D. 에이전트 프롬프트 Bash fallback 지시** | 에이전트 persona에 "Write 실패 시 Bash(cat > file) 재시도" 명시 | ✅ 실용적 자가회복 | Low (Oracle 승인 필요) | 토큰 소모 ↑, 에이전트 행동 변경 |
| **E. runner에 Write 사전 테스트 + 조기 경고** | runner 시작 시 `touch inbox_file` → 실패하면 로그 경고 | △ 조기 감지, 해결 아님 | Low | `__AGENT_DONE__` 전 실패 감지 → Oracle 수동 개입 유도 |

**권장 조합**: **A (장기) + D (단기)** — 경로 rename으로 근본 해결, 그 전까지 에이전트 Bash fallback으로 자가회복.

#### Oracle 승인 필요 항목 (Sprint 126)

- [ ] **D (단기)**: 에이전트 공통 persona `_base.md` 또는 개별 persona에 Bash fallback 지시 추가 (Oracle 직접 수정)
  ```
  결과 파일 Write가 거부되면: Bash("cat > {결과파일경로} << 'EOF'\n{내용}\nEOF")로 재시도
  ```
- [ ] **A (장기)**: `oracle-spawn.sh` `INBOX_DIR` 변수를 `~/oracle-results`로 rename, 관련 스크립트 전수 갱신
- [ ] **B (단기, 선택)**: `oracle-reap.sh`에 stdout 추출 로직 추가 — `inbox` 없음 + `.out` 에 YAML frontmatter 패턴 있으면 자동 복구

---

## 성과 요약

| 지표 | 수치 |
|------|------|
| 총 커밋 (Wave A~C) | ~50+ |
| 신규 번역 키 (Wave A~B) | ~200+ (ko+en) |
| 네임스페이스 도달 (Sprint 125 기준) | 18개 (Wave B 확정) |
| OAuth 에러 코드 정규화 | 7종 enum 완성 |
| Sprint 124 이월 9항목 마감 | 9/9 ✅ (D1·D2 조사완료, Oracle 적용 대기) |

---

## 기술부채 및 Sprint 126 등록 목록

| 항목 | 출처 | 우선순위 |
|------|------|---------|
| `errors.authFailed` / `errors.serviceFailed` 미참조 레거시 키 검토 | ADR-025 후속 | Low |
| `difficultyData` useMemo 추출 | Wave B Critic Low | Low |
| unclassified 차트 ko/en 비대칭 데이터 레이어 정렬 | Wave B Critic Low | Low |
| oracle-spawn.sh 529 재시도 diff 적용 (Oracle 직접 적용 필요) | Sprint 125 D1 | Medium |
| oracle inbox 경로 rename (`~/.claude/oracle/inbox` → `~/oracle-results`) — 근본 해결 | Sprint 125 D2 (해결책 A) | Medium |
| 에이전트 persona Bash fallback 지시 추가 — Write 차단 시 자가회복 | Sprint 125 D2 (해결책 D) | Medium |
| oracle-reap.sh stdout 자동 추출 — inbox 없음 시 `.out` 파싱 복구 | Sprint 125 D2 (해결책 B) | Low |
