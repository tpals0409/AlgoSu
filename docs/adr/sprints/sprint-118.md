---
sprint: 118
title: "Critic 에이전트로 전체 코드베이스 전수 감사 — 워크플로우 구축 + 7개 서비스 1차 감사 실행"
period: "2026-04-22"
status: complete
start_commit: fff8314
end_commit: TBD
---

# Sprint 118 — Critic 전수 감사 워크플로우 + 7개 서비스 1차 감사

## 배경

Sprint 117에서 `oracle-auto-critic.sh` 기반 **diff-only 자동 Critic 체인**을 완성했지만, 한 가지 구조적 한계가 남아 있었다: **마지막에 변경되지 않은 파일은 영원히 리뷰 사각지대에 머문다.** 오래된 레거시 코드의 누적 부채는 diff-only로는 절대 드러나지 않는다.

Sprint 117 시범 리팩토링(`api.ts` 860줄 도메인 분리)에서 "숨은 대형 파일" 한 건만으로도 리팩토링 가치를 증명한 만큼, **전체 코드베이스를 대상으로 1차 전수 감사**를 수행해 유사 부채를 한 번에 드러내는 것이 다음 단계였다.

## 목표

| Phase | 내용 | 상태 |
|-------|------|------|
| A | 전수 감사 래퍼 스크립트 (`oracle-full-audit.sh`) 신설 + 프롬프트 + JSON→MD 헬퍼 | ✅ 완료 |
| B | 파인딩 저장 스키마 확정 (`docs/audits/sprint-118/`) | ✅ 완료 |
| C | 7개 서비스 전수 리뷰 실행 (frontend + 6개 백엔드) | ✅ 완료 |
| D | P0/P1 자동 위임 큐 설계 + 트리아지 스크립트 (`oracle-audit-triage.sh`) | ✅ 설계 완료 |
| E | ADR·메모리·커밋 | ✅ 완료 |

> Phase D 실제 dispatch는 Sprint 119에서 수행 (591건 규모는 단일 스프린트로 감당 불가).

## 핵심 결정 (D1~D6)

### D1. codex review(diff) 대신 `codex exec`(비-review) 로 전수 감사
**선택**: `codex exec "<prompt>"` 에 Critic 체크리스트 + 파일 경로 + JSON Lines 출력 스키마 주입.
**대안**: `codex review --base <empty-tree>` 트릭, codex 외 타 도구.
**근거**: (1) codex review는 diff 기반이라 전수 리뷰 부적합, (2) `codex exec`는 read-only sandbox로 파일 내용 직접 읽음, (3) 출력 포맷(JSON Lines) 통제 가능. 파일럿(config.py 38라인)에서 JSON Lines만 출력됨을 검증.

### D2. 파일 배치 크기 = 8 (1코덱스 호출당)
**선택**: 배치 크기 8로 고정 (커맨드라인 옵션으로 조정 가능).
**근거**: 파일당 평균 ~100 LOC × 8 = ~800 LOC ≈ 5~6K 토큰. codex 단일 세션 컨텍스트로 충분. 더 크게 하면 후반부 파일에 대한 집중도 저하 관찰.

### D3. 파인딩 저장 = `docs/audits/sprint-118/` (리포 내 커밋)
**선택**: 서비스별 MD + 원본 JSONL을 리포 내에 커밋.
**대안**: `~/.claude/oracle/inbox/` 리포 외부.
**근거**: git blame·PR 참조·이력 추적 가능. 다음 스프린트 리팩토링 PR에서 "출처" 명시 용이.

### D4. severity 4단계 (P0/P1/P2/Low) — Sprint 115~117 규약 준수
**P0**: 머지 차단 (security/runtime crash/data corruption)
**P1**: 재검증 후 머지 (performance/API 파괴)
**P2**: 비차단 (convention/code smell)
**Low**: 선택적 개선

### D5. P0/P1 자동 위임 라우팅 매트릭스
**1차 (category 기반)**: security / data-integrity → architect (고정)
**2차 (service 기반)**:
- frontend → palette (convention/maintainability) / herald (그 외)
- problem, submission → curator (도메인 로직)
- gateway, identity, github-worker, ai-analysis → postman (백엔드 서비스)

**실측 분포** (P0 17건 + P1 상위 5건 = 22건): architect 18건 (P0 16 + P1 2), postman 3건 (P1), herald 1건 (P0).
**근거**: security/correctness가 P0의 압도적 다수(94%) → architect 집중이 자연스러움.

### D6. 배치 실패 복원력 = 재시도 1회 후 스킵 (전체 중단 금지)
**선택**: `codex exec` 실패 시 1회 재시도 → 그래도 실패하면 해당 배치만 건너뛰고 다음 진행.
**근거**: frontend 배치 30, 31이 실패했지만 나머지 29개 배치(94%)는 정상 완료. 전수 감사는 한 건의 실패로 중단되면 재실행 비용 큼.

## 구현

### Phase A — 전수 감사 스크립트 (리포 외부, `~/.claude/oracle/`)

**신규 파일**:
- `bin/oracle-full-audit.sh` — 서비스 단위 전수 감사 래퍼. 옵션: `--files`, `--severity-min`, `--batch-size`, `--dry-run`.
- `bin/oracle-audit-triage.sh` — 파인딩 → 에이전트 큐 변환. 옵션: `--severity-min`, `--limit`, `--dry-run`.
- `bin/lib/audit-schema.sh` — JSONL → 서비스 MD + 종합 README 변환 헬퍼.
- `prompts/full-audit.txt` — 전수 감사용 Critic 체크리스트 + JSON Lines 출력 스키마.

**구현 과정 발견된 버그 5건** (모두 즉시 교정):
1. `count_severity`의 `grep -c` 이중 출력 — 0매칭 시 exit 1 + `|| echo 0` 중복 트리거. `|| true; echo ${var:-0}` 패턴으로 수정.
2. `run_codex_batch` stdout 오염 — log/ok/warn이 stdout 출력 → 세션 ID 캡처에 로그 섞임. 전부 stderr로 이관.
3. **Critical**: `codex exec`가 while 루프의 stdin(`< $all_files`) 을 소비 — 배치 1만 실행되던 숨은 버그. `codex exec ... < /dev/null` 로 차단. 수정 전: identity 22건 파인딩 → 수정 후: 86건 (4배 증가).
4. 트리아지 `grep -o '[0-9]\+'` 이중 매칭 — `P0: 5` 에서 "0"(P0의) + "5"(값) 두 매칭. `sed -E 's/.*P0: ([0-9]+).*/\1/'` 로 교체.
5. `${var,,}` bash 4+ 전용 소문자 변환 macOS 3.2 실패 — `tr '[:upper:]' '[:lower:]'` 로 교체.

### Phase C — 7개 서비스 전수 리뷰 실행 결과

| 서비스 | LOC | 파일 | 파인딩 | P0 | P1 | P2 | Low |
|--------|-----|------|--------|----|----|----|----|
| ai-analysis | 2,351 | 9 | 18 | 1 | 12 | 5 | 0 |
| github-worker | 1,611 | 8 | 18 | 1 | 13 | 4 | 0 |
| problem | 2,542 | 32 | 41 | 2 | 31 | 8 | 0 |
| identity | 4,265 | 69 | 86 | 5 | 37 | 44 | 0 |
| submission | 4,860 | 56 | 65 | 3 | 41 | 21 | 0 |
| gateway | 8,863 | 82 | 111 | 2 | 64 | 44 | 1 |
| frontend | 32,320 | 248 | 252 | 3 | 81 | 163 | 5 |
| **합계** | **56,812** | **504** | **591** | **17** | **279** | **289** | **6** |

> frontend 배치 30, 31은 codex exec 재시도 실패로 마지막 16파일 누락 (실제 232/248 = 94% 커버). Sprint 119+에서 재실행 예정.

### Phase D — P0/P1 자동 위임 큐

**트리아지 실행**: `oracle-audit-triage.sh --severity-min P1 --limit 5`
- **큐잉 파인딩**: 22건 (P0 전건 17 + P1 상위 5)
- **에이전트 배분**: architect 18, postman 3, herald 1
- **큐 위치**: `~/.claude/oracle/audit-queue/audit-20260422-*.json`

**Sprint 119 dispatch 계획**: 각 task JSON을 `oracle-spawn.sh` 로 해당 에이전트에 할당 → 수정 → auto-Critic 재검증 → 큐에서 제거.

## 주요 P0 파인딩 샘플 (17건 중 5건)

| # | 파일 | 내용 |
|---|------|------|
| P0-01 | `services/ai-analysis/src/config.py:24` | `internal_api_key` 빈 문자열 기본값 → X-Internal-Key 인증 우회 |
| P0-02 | `frontend/src/app/shared/[token]/page.tsx:42` | (상세는 해당 audit MD 참조) |
| P0-05 | `services/gateway/src/auth/token-refresh.interceptor.ts:54` | 토큰 리프레시 인터셉터 이슈 |
| P0-08 | `services/identity/src/database/data-source.ts:22` | DB 연결 설정 보안 이슈 |
| P0-13 | `services/problem/src/problem/internal-problem.controller.ts:67` | 내부 컨트롤러 인증 이슈 |

## 검증

- ✅ `oracle-full-audit.sh <service>` 7개 서비스 모두 실행 성공
- ✅ `oracle-audit-triage.sh --severity-min P1 --limit 5` → 22건 큐 생성
- ✅ JSON 스키마 준수: `finding_id`, `assigned_agent`, `service`, `status` 전건 기록
- ✅ `docs/audits/sprint-118/README.md` 종합 대시보드 생성 (7 서비스 합계 표)
- ✅ 서비스별 MD 7개 frontmatter 정상 (severity_counts, codex_sessions 포함)

## 교훈

1. **stdin 상속은 while 루프의 숨은 함정** — `codex exec` 같은 자식 프로세스가 루프 stdin을 소비하면 배치가 조기 중단된다. **명시적 `< /dev/null` 리다이렉션이 필수**. identity 파인딩이 22건→86건으로 4배 증가한 것이 증거.
2. **배치 복원력 설계의 가치** — frontend 배치 30/31 실패에도 나머지 29개 배치가 완료되어 **94% 커버리지** 확보. "전체 중단 vs 부분 건너뛰기" 선택에서 후자가 옳았다.
3. **P0 파인딩은 architect에 집중됨** (94%) — security/correctness 카테고리 특성. 라우팅 매트릭스는 카테고리 우선이 맞다.
4. **codex exec가 review보다 유연** — 전수 감사처럼 diff 없는 시나리오에서 `codex exec`에 프롬프트로 체크리스트를 주입하는 방식이 `codex review --base <trick>` 대안보다 깔끔하고 출력 통제 쉬움.
5. **스크립트 버그 5건 모두 bash 특유 함정** — macOS bash 3.2 호환, grep/`||` 패턴 이중 출력, `${var,,}` 대소문자, stdin 상속, `grep -o` 다중 매칭. **macOS 대상 bash 스크립트 체크리스트 필요**.

## 이월 항목

- [ ] **Sprint 117 이월 재이월**: auto-Critic tmux dispatch E2E 검증 (인터랙티브에서는 cleanup 훅 미발동).
- [ ] **Phase D 실제 dispatch 실행** (Sprint 119 최우선): P0 17건 → architect 자동 위임, Critic 재검증 루프 실증.
- [ ] **frontend 배치 30/31 재실행**: 마지막 16파일 누락분 보강.
- [ ] **Sprint 119 로드맵 초안**: 591건 파인딩 기반 리팩토링 스프린트 분할 (P0 17 → P1 279 → P2 289 순차).
- [ ] **감사 정기 실행** 검토: 분기 1회 전수 감사 스케줄 (cron/CI).

## 메트릭

- **코드 커버리지 변화 없음** (audit MD 추가만, 프로덕션 코드 무변경)
- **감사 실행 시간**: 7개 서비스 약 2~3시간 (일부 병렬, codex rate limit 감안)
- **총 codex 세션**: 약 70개 (배치당 1세션)
- **스크립트 버그 사이클**: 5건 발견 → 5건 즉시 수정

## 관련 ADR

- Sprint 114 — Critic 에이전트 신설 (Codex gpt-5 기반)
- Sprint 115 — Phase E 검증 (P0/P1/P2 규약 확립)
- Sprint 116 — Critic tmux dispatch 통합
- Sprint 117 — auto-Critic 체인 (diff-only) + api.ts 시범 분리
- **Sprint 118 (본 문서)** — 전수 감사 워크플로우 + 591건 파인딩 발견
- Sprint 119 (예정) — Phase D 실제 dispatch + 591건 리팩토링 착수
