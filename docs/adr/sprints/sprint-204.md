---
sprint: 204
title: "Discord 처분 + BOT_TOKEN 회수 — `.claude-tools/` 정리 파이프라인 종결"
date: "2026-05-27"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-156", "sprint-191", "sprint-202"]
related_memory: ["sprint-window"]
topics: ["security", "operations", "cleanup"]
tldr: "Sprint 156에서 명문화한 `.claude-tools/` 정리 로드맵의 마지막 단계(Phase 4)를 실행. dormant 3파일(`discord-send.sh`·`oracle-system-prompt.md`·`discord-inbox.md`)을 로컬 삭제(repo 측 정리 완료). BOT_TOKEN은 사용자에게 Discord Developer Portal에서 revoke하도록 안내(Phase 3 외부 트랙 — 머지 후 사용자 직접 진행, Sprint 205 시작 시점 재확인). 3개월 무활성(2026-02-28 마지막 입력) + live caller 0건 검증 + git history 노출 0(`.gitignore` 등록) 조건 충족으로 Agent↔Discord 통합 폐기 결정. Sprint 191→202→204의 4-스프린트 점진 정리 파이프라인 종결. 신규 패턴 3건(dormant 자산 시크릿 노출 처분 / 정리 파이프라인 마무리 / 외부 시스템 트랙 분리) 영속화."
---
# Sprint 204 — Discord 처분 + BOT_TOKEN 회수 — `.claude-tools/` 정리 파이프라인 종결

## 목표

- `.claude-tools/`에 dormant 상태로 잔존하던 Discord 통합 자산 3종을 처분하여 평문 BOT_TOKEN 노출 위험을 종결.
- Sprint 156(RUNBOOK 명문화) → Sprint 191(deprecated 삭제) → Sprint 202(dormant 일부 삭제 + 재분류)로 이어진 4-스프린트 정리 파이프라인 종결.
- 외부 시스템(Discord 측) 토큰 회수와 repo 작업의 트랙 분리를 패턴으로 영속화.

## 배경

Sprint 156에서 작성한 `docs/runbook/claude-tools.md`의 §4 정리 로드맵 Phase 4는 "discord-send.sh 처분 결정 (재활성화 / 삭제 / BOT_TOKEN 회수) — Agent 간 통신 아키텍처 확정 대기"로 미정 상태로 남아 있었다. Sprint 202 Phase 3에서 dormant 일부(`oracle-respond.sh`·`discord-receiver.py`·`discord-last-id`)를 삭제하면서 `discord-send.sh`를 live → dormant로 재분류했으나, 평문 BOT_TOKEN 보유로 단순 삭제는 보류되어 있었다.

Sprint 204 착수 시점에서 다음 조건이 충족되어 처분 결정 환경이 성숙했다:

- `discord-inbox.md` 마지막 입력 **2026-02-28** (약 3개월 무활성) — Agent↔Discord 운영 사실상 중단.
- `~/.claude/oracle/bin/` 17 스크립트 + repo 전역 grep에서 **live caller 0건** (Sprint 202 검증 결과 그대로).
- `.claude-tools/`가 `.gitignore` 등록 상태라 `discord-send.sh`의 BOT_TOKEN이 **git history에 한 번도 노출된 적 없음** (`git log --all -- .claude-tools/discord-send.sh` 빈 결과 — BFG/`git filter-repo`로 역사 정화 불필요).
- BOT_TOKEN 평문은 `.claude-tools/discord-send.sh:6` **단일 위치** — 처분 범위 명확.

## 결정

### D0. 사용자 결정

처분 옵션 3종 중 **완전 삭제 + 토큰 revoke** 선택. 나머지 옵션은 다음과 같이 평가:

- **재활성화 + Secret-store 이전** (macOS Keychain 또는 1Password CLI) — Agent↔Discord 통합 재개 의향 부재로 비용 정당화 불가.
- **토큰만 revoke + 파일 placeholder 보존** — dormant 이력 보존은 sprint 152·191·202·204의 정리 파이프라인 SSOT인 RUNBOOK §정리 로드맵으로 이미 영속화되어 있어 placeholder 추가 가치 미미.

### D1. 처분 범위 확정

`.claude-tools/` 내 dormant 3파일 모두 삭제 대상으로 확정:

- `discord-send.sh` — BOT_TOKEN 평문 보유 (line 6).
- `oracle-system-prompt.md` — `claude-tools.md:28`에서 "reference (SSOT는 `.claude/commands/algosu-oracle.md`)"로 명시된 dead reference. line 32~36이 `/Users/leokim/.claude/discord-send.sh`를 가리키나 해당 경로 파일 부재.
- `discord-inbox.md` — Discord PM 메시지 로그 (`append-only`, 수신 trigger 부재로 3개월 freeze 상태).

디렉토리 자체(`.claude-tools/`)는 보존 — 향후 신규 dispatch 산출물 대비.

### D2. 외부 시스템 트랙 분리

Discord Developer Portal의 BOT_TOKEN revoke는 Oracle/Claude가 직접 수행 불가(외부 시스템). repo 작업(코드/문서 정리)과 외부 작업(토큰 revoke)을 **별도 트랙**으로 분리하여 진행. ADR 머지 후 사용자에게 별도 안내.

### D3. tracked 문서 정리 범위

- `.claude/commands/agents/_base.md:51` — 금지 규칙에서 `discord-send.sh` 직접 호출 항목 제거. 파일 자체 부재로 금지 명시 불필요. 나머지 두 항목(`memory/` 수정, 다른 에이전트 inbox 접근)은 보존.
- `docs/runbook/claude-tools.md` — §1·§2·§3·§4·§5 5개 섹션 갱신 (헤더·Git 정책·파일 분류 표·보안 주의·Discord 정책·정리 로드맵·이력).

## 구현

### Phase 1 — 로컬 dormant 파일 삭제 (Oracle 직접)

`.claude-tools/`는 `.gitignore`에 등록되어 있어 `rm` 후 `git status`/`git diff` 변화 없음. 삭제 명령:

```
rm .claude-tools/discord-send.sh
rm .claude-tools/discord-inbox.md
rm .claude-tools/oracle-system-prompt.md
```

검증: `ls .claude-tools/` 빈 결과, `git status --short` 변화 없음.

### Phase 2-1 — `_base.md` 금지 규칙 정리 (커밋 9eaa0ed)

`.claude/commands/agents/_base.md:51`의 금지 규칙에서 `discord-send.sh` 직접 호출 항목 제거.

변경 전:
```
- **금지**: `discord-send.sh` 직접 호출, `memory/` 수정, 다른 에이전트 inbox 접근
```

변경 후:
```
- **금지**: `memory/` 수정, 다른 에이전트 inbox 접근
```

### Phase 2-2 — `claude-tools.md` Phase 4 반영 (커밋 9eaa0ed)

5개 섹션 갱신을 단일 커밋에 포함:

- 헤더: Sprint 204 정리 이력 추가 (Sprint 191→202→204 흐름 명시).
- §1 Git 정책: "민감 정보(BOT_TOKEN) 보호" → "로컬 dispatch 산출물 격리용 (Sprint 204 Phase 4에서 dormant 자산 repo 제거 완료, 외부 BOT_TOKEN revoke는 사용자 직접 트랙으로 분리 — Sprint 205 시작 시점 재확인)".
- §2 파일별 상태 분류 표: 3행(`discord-send.sh`·`oracle-system-prompt.md`·`discord-inbox.md`) 모두 제거 → "현재 추적 대상 산출물 없음" 한 줄로 대체. 상태 정의 섹션은 신규 산출물 분류 기준으로 보존.
- §3 보안 주의: 평문 BOT_TOKEN 보유 파일 부재 반영. 신규 산출물은 Secret-store 경유 필수로 정책 일반화.
- §3 Discord 관련 정책: Phase 4 폐기 결과 명시 + 향후 재개 시 Secret-store 기반 재설계 가이드.
- §4 정리 로드맵: Phase 4 행 (미정) → (Sprint 204 ✅), 내용을 실제 처분 결과로 갱신.
- §5 이력: Sprint 204 행 추가 — 3개월 무활성 + live caller 0건 검증 + BOT_TOKEN 외부 트랙 분리 명시.

### Phase 2-3·2-4 — ADR sprint-204 KR+EN 신설 + README index 갱신

본 ADR(KR+EN) + `docs/adr/README.md` 회고형 sprint ADR 카운트 141→142 / sprint range 62~203→62~204.

### Phase 3 — 사용자 직접 (외부 시스템)

PR 머지 후 사용자에게 다음 안내:

- Discord Developer Portal(https://discord.com/developers/applications) 접속.
- 대상 봇 애플리케이션의 BOT_TOKEN **Reset** (기존 토큰 즉시 무효화) 또는 애플리케이션 자체 삭제.
- 채널 4종(`CHANNEL_ORACLE_CHAT`/`CHANNEL_WORK_REPORT`/`CHANNEL_WORK_APPROVAL`/`CHANNEL_EMERGENCY_ALERT`)은 사용자 재량으로 보존/삭제.

> 이 단계는 외부 시스템(Discord 측)이므로 repo 작업과 비동기 진행. ADR §이월에 미완료 시 후속 sprint 재확인 항목으로 명시.

## 검증

머지 전 게이트:

- `git grep -n "BOT_TOKEN" -- ':!.gitignore' ':!docs/adr/' ':!docs/adr-en/' ':!docs/runbook/'` — **0건**. ADR/RUNBOOK는 Sprint 204 처분 결과·이력·신규 패턴(시크릿 노출 처분 표준)을 기술하는 의도된 historical reference로 제외 (단독 grep 시 `docs/runbook/claude-tools.md` 5건 / `docs/adr/sprints/sprint-204.md` 다수 잔존이 정상).
- `git grep -n "discord-send" -- ':!docs/adr/' ':!docs/adr-en/' ':!docs/runbook/claude-tools.md'` — **0건** (`_base.md` 정리 후). RUNBOOK `docs/runbook/claude-tools.md`는 Sprint 204 처분 결과(헤더·§2·§3·§4·§5)를 기술하므로 의도된 historical reference로 제외 — `git grep -n "discord-send" docs/runbook/claude-tools.md`는 Sprint 204 결과 기술 hits 5건 잔존이 정상.
- `ls .claude-tools/` — 빈 결과 (3 파일 모두 부재, 디렉토리 보존).
- `scripts/check-adr-index-count.mjs --strict` — 영구 8 / 토픽 1 / sprint **142** 일치.
- `scripts/check-adr-en-coverage.mjs --lint` — **151/151** (100%).
- `scripts/check-doc-refs.mjs` — 0 broken (RUNBOOK 링크 제거 영향 확인).
- `scripts/check-i18n-residue.mjs --strict` — prose Hangul 임계 8% 이하.
- CI(PR): ALL SUCCESS, autoMerge enrolled → squash merge.

**Critic(Codex)**: Oracle 직접 처리(코드 변경 에이전트 미경유)라 `oracle-auto-critic.sh` 미트리거 → 수동 `codex review --base main` 실행.

- **R1** 세션 `019e693c-ddd5-7570-96d7-d208bc0da81a` — Critical/High **0** + **High 1건**(BOT_TOKEN revoke 시제 과장 — ADR/RUNBOOK이 "회수 완료"로 단언하나 실제는 Phase 3 사용자 직접 진행 대기) + **Medium 1건**(`git grep -n "discord-send" -- ':!docs/adr/' ':!docs/adr-en/'` 검증 명령이 RUNBOOK historical hits 미배제로 false). 커밋 `727dc3e`에서 해소 — 시제를 "안내/being decommissioned (repo-side complete, external revoke pending Phase 3)"로 정합 + discord-send grep exclusion에 `':!docs/runbook/claude-tools.md'` 추가.
- **R2** 세션 `019e6943-5fe2-7263-b7ef-88df981fe0c8` — Critical/High **0** + **P2 1건**(BOT_TOKEN grep도 동일 패턴으로 ADR/RUNBOOK historical hits 잔존, 0 hits 기록 false) + **P3 1건**(본 §검증 line의 Critic placeholder 잔존). 본 커밋에서 해소 — BOT_TOKEN grep exclusion에 `':!docs/adr/' ':!docs/adr-en/' ':!docs/runbook/'` 추가 + Critic 영역에 R1·R2 결과 + 세션 ID 영속화.
- **R3** 세션 `019e6948-2b2b-78b1-8db5-235cdb127b59` — Critical/High **0** + **P2 1건**(신규 패턴 §2 Phase 4 요약 "외부 토큰 회수/external token revoke" 표현이 ✅ 마킹과 결합해 완료를 함의 — 본 sprint 시점 외부 revoke는 Phase 3 사용자 트랙으로 미완). 본 커밋에서 해소 — "외부 토큰 revoke 안내 (Phase 3 사용자 트랙, Sprint 205 재확인)"로 시제 정합. KR+EN 동시.
- **R4** — (본 커밋 푸시 후 실행해 CLEAN 확인. 결과는 sprint-window/메모리에 별도 영속화.)

## 신규 패턴

### 1. dormant 자산의 시크릿 노출 처분 표준

`.gitignore` 등록 상태라 git history 정화가 불필요한 케이스도, 평문 시크릿 보유 파일은 dormant라는 사실만으로 위험이 종결되지 않는다. 다음 3 조건이 충족되면 "삭제 + 외부 토큰 revoke"가 표준 처분:

| 조건 | Sprint 204 케이스 |
|------|-------------------|
| live caller 0건 | `~/.claude/oracle/bin/` 17 스크립트 + repo grep 모두 0 |
| 무활성 임계치 충족 (≥3개월) | `discord-inbox.md` 마지막 입력 2026-02-28 |
| git history 노출 0 (또는 정화 가능) | `.gitignore` 등록으로 `git log --all` 빈 결과 |

평문 토큰을 보유한 채 dormant 상태로 두는 것은 "위험이 잠재된 미정"이며, 위 조건 충족 시 의사결정을 미루지 않고 종결.

### 2. 정리 파이프라인 마무리 패턴 (4-스프린트 점진 정리)

Sprint 156(명문화) → Sprint 191(deprecated 삭제) → Sprint 202(dormant 일부 삭제 + 재분류) → Sprint 204(dormant 완전 삭제)의 4-스프린트 점진 정리.

각 스프린트마다 RUNBOOK §정리 로드맵 표가 진행 상태 SSOT로 기능:

- Phase 1 (Sprint 156): RUNBOOK 명문화 자체.
- Phase 2 (Sprint 191 ✅): deprecated 2파일 삭제.
- Phase 3 (Sprint 202 ✅): dormant 일부 삭제 + 잔여 1파일 재분류.
- Phase 4 (Sprint 204 ✅): dormant 완전 삭제 + 외부 토큰 revoke 안내 (Phase 3 사용자 트랙으로 분리, 본 sprint 시점 미완·Sprint 205 재확인).

이 패턴은 "한번에 정리할 수 없는 자산"(예: 외부 토큰 회수 결정 대기, 통합 방향 재논의 필요)을 다단계로 처리할 때 표준 — RUNBOOK §정리 로드맵 표가 진행 상태 SSOT이며, 다음 sprint에서 즉시 컨텍스트 복구 가능.

### 3. 외부 시스템 트랙 분리

repo 작업(코드/문서 정리, PR)과 외부 시스템 작업(Discord BOT_TOKEN revoke)은 **동기화 불가**. ADR 머지 후 사용자가 직접 외부 시스템에 접근해야 완결.

분리 원칙:

- repo 작업은 PR/머지로 완결 — Critic·CI·squash merge로 검증.
- 외부 작업은 별도 트랙 — ADR §이월에 "사용자 외부 작업 완료 여부 후속 sprint 재확인" 명시로 누락 방지.
- 외부 시스템에 의존하는 검증(예: 토큰 revoke 후 401 응답 확인)은 ADR에 절차로만 기술하고, 실 실행은 사용자에게 위임.

## 교훈

1. **dormant 자산은 시간이 약이 아니다** — 무활성 기간이 길어진다고 위험이 자동 해소되지 않는다. 평문 시크릿 보유 자산은 무활성 임계치 충족 시 즉시 처분 결정 절차로 진입해야 한다.
2. **외부 시스템 작업은 별도 트랙으로 분리하고 누락 방지를 ADR 이월에 명시** — repo PR/머지 완료가 곧 "처분 완료"가 아니다. 외부 토큰 revoke 미완료 시 잔존 위험이 있으므로, ADR §이월에 "사용자 외부 작업 완료 여부 후속 sprint 재확인" 항목을 명시해 누락 차단.
3. **정리 로드맵 표가 다단계 처분의 SSOT** — Sprint 156에서 RUNBOOK §4를 "Phase 1~4" 표로 작성한 결정이 4-스프린트 점진 정리의 컨텍스트 복구를 가능하게 했다. 한 번에 정리할 수 없는 자산은 처음부터 다단계 표 SSOT로 설계.
4. **gitignored가 곧 안전이 아니다** — git history 노출 0은 단지 정화 부담 없음을 의미할 뿐. 로컬 파일 시스템에서 평문 토큰을 보유한 것은 여전히 위험(머신 도난/접근 권한 침해/실수 commit) — gitignored는 처분의 시작점이지 종결점이 아님.

## 이월

- **Phase 3 미완료 시 후속 sprint 재확인** — 사용자가 Discord Developer Portal에서 BOT_TOKEN을 revoke했는지 다음 sprint 시작 시점에 확인. 미완료라면 안내 재전달.
- **운영 측 Sprint 196 마이그레이션 실행 + 재배포** (사용자/운영 담당).
- (선택) `commitlint` scope-enum에 `oracle` 추가 (Sprint 202·203 이월).
- (선택) CI PYTHON 3.12 → 3.13.
- (선택) Build Blog (SSG) required check 승격.
- (시드) 하네스 정기점검 체크리스트 자동화 스크립트 (Sprint 202 신규 패턴).
- 누적 UAT (사용자 직접) → Sprint 205.
