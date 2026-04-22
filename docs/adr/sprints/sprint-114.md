---
sprint: 114
title: "Critic 에이전트 신설 — Codex 기반 교차 코드리뷰"
period: "2026-04-22"
status: complete
start_commit: e4f0641
end_commit: 84e044e
---

# Sprint 114 — Critic 에이전트 신설 (Codex 기반 교차 코드리뷰)

## 배경

AlgoSu는 11개 에이전트(Echelon 1~3)가 Oracle 지휘 아래 MSA 전환을 분업하고 있다. 코드리뷰는 지금까지 Gatekeeper(보안·계약)·Oracle(기획·ADR) 두 축이 담당했으나, **모두 Claude 모델 패밀리** 안에서 동작하므로 동일 모델이 놓치는 맹점(동일 훈련 분포에서 오는 blind spot)을 교차 검증할 수 없었다.

OpenAI가 공개한 `codex-plugin-cc`(https://github.com/openai/codex-plugin-cc)는 Claude Code 안에서 Codex(gpt-5) CLI를 슬래시 커맨드로 호출 가능하게 한다:
- `/codex:review` — 일반 코드리뷰
- `/codex:adversarial-review` — 설계 의사결정·실패 모드 압박 리뷰
- `/codex:status`, `/codex:result`, `/codex:cancel` — 백그라운드 작업 관리

이를 활용해 **merge-gate 전담 Critic(비평가)** 에이전트를 Echelon 2 Core로 신설한다.

## 목표

| Phase | 내용 | 상태 |
|-------|------|------|
| A | Codex CLI 설치 + codex-plugin-cc 플러그인 설정 | ✅ 부분(A1) / ⏸ 사용자 작업 대기(A2 로그인, A3 플러그인) |
| B | `.claude/commands/agents/critic.md` 페르소나 작성 | ✅ 완료 |
| C | Oracle 파이프라인 통합 (algosu-oracle.md, oracle-spawn.sh, oracle-build-prompts.sh, prompts/critic.txt) | ✅ 완료 |
| D | 문서 갱신 (CLAUDE.md, start.md, 본 ADR) | ✅ 완료 |
| E | 검증 (Sprint 113 SWR 커밋 대상 `/codex:review --base 75cb80f` 시연) | ⏸ 사용자 로그인 후 |

---

## 결정 사항

### D1. 에이전트 명칭 = Critic(비평가)

**배경**: OpenAI Codex 기반 2차 리뷰 전담 에이전트에 적합한 이름 선택 필요.

**선택지**:
- (A) Reviewer — 너무 일반적, 기존 Gatekeeper 역할과 혼동
- (B) Auditor / Inspector — 감사·검사 뉘앙스는 맞으나 창의적 비평 축소
- (C) **Critic(비평가)** ← 선택 — `adversarial-review`(설계 도전)와 의미 정합, 기존 네이밍(Gatekeeper·Sensei·Palette) 톤 일치

**결과**: 페르소나 파일 `critic.md`, 프롬프트 빌드 `prompts/critic.txt`, 스킬 네임스페이스 `agents:critic`로 등록.

---

### D2. Echelon 2 — Core 배치

**배경**: 머지 차단 권한을 가진 에이전트의 등급.

**선택지**:
- (A) Echelon 1 (Mission Critical, opus) — Oracle·Gatekeeper·Librarian과 동급
- (B) **Echelon 2 (Core, sonnet)** ← 선택 — Architect/Scribe/Postman/Curator와 동급
- (C) Echelon 3 (Enhancement) — 부가 기능 격하

**선택**: (B) — Critic 자체는 Codex로 리뷰를 **위임**하는 래퍼이므로 Claude 모델은 sonnet으로 충분. 머지-게이트 영향력은 크지만 직접 의사결정(기획·ADR)은 없어 Echelon 1에는 미해당.

**결과**: `oracle-spawn.sh`의 `get_tier()` = 2, `get_model()` = `claude-sonnet-4-6`.

---

### D3. 인터랙티브 모드만 지원 (tmux dispatch 후속)

**배경**: 기존 파이프라인은 `oracle-spawn.sh`가 `claude -p` 독립 프로세스를 tmux pane에 spawn하는 구조. `/codex:*` 슬래시 커맨드가 독립 프로세스에서 동작하는지 미검증.

**선택지**:
- (A) 초기부터 `codex exec` 직접 호출 runner 작성
- (B) **인터랙티브 모드(Oracle 세션 내 호출) 전용, dispatch는 후속** ← 선택

**선택**: (B) — 리스크 회피. Critic이 Oracle 메인 세션에서 직접 `/codex:review`를 실행하면 플러그인 맥락이 보존되고 사용자 구독/인증이 자연스럽게 상속됨. Spawn 경로는 `VALID_AGENTS` 등록만 하고 실제 dispatch는 "현재 미지원"으로 명시.

**결과**: `critic.md` "작업 수신" 섹션에 "독립 실행 모드: 현재 미지원" 명시.

---

### D4. 스코프 = Review 전담 (Rescue 제외)

**배경**: codex-plugin-cc는 `/codex:rescue`(버그 조사·수정 위임)도 제공.

**선택지**:
- (A) Rescue까지 포함 — Critic이 코드 수정 권한까지 보유
- (B) **Review 전담 (rescue 제외)** ← 선택 — 읽기 전용, 수정은 Herald/Architect/Postman 등에 위임

**선택**: (B) — 단일 책임 원칙. 비평가가 고치기까지 하면 역할 경계 붕괴. Rescue는 필요 시 Oracle이 명시 승인한 경우만 예외 허용.

**결과**: `critic.md` 금지사항에 "직접 코드 수정 금지", "/codex:rescue 사용 금지 (Oracle 승인 시 예외)" 명시.

---

### D5. Critic 모델 = sonnet / 실제 분석 = Codex gpt-5

**배경**: Claude-sonnet-4-6 vs Claude-opus-4-6 선택.

**선택**: sonnet — Critic의 Claude 측 역할은 "Codex 결과를 한국어 요약·구조화"로 경량. 실제 추론은 Codex gpt-5가 수행하므로 이중 opus 비용 불필요.

---

## 주요 산출물

**신규 1**:
- `.claude/commands/agents/critic.md`

**수정 5**:
- `.claude/commands/algosu-oracle.md` — 에이전트 목록 11→12, 코드리뷰 위임 규칙 추가
- `~/.claude/oracle/bin/oracle-spawn.sh` — `VALID_AGENTS` + `get_tier()`에 critic 등록
- `~/.claude/oracle/bin/oracle-build-prompts.sh` — `AGENTS` 배열에 critic 추가
- `CLAUDE.md` — Agent 워크플로우 섹션 12 에이전트
- `.claude/commands/start.md` — 대시보드 에이전트 목록

**자동 생성 1**:
- `~/.claude/oracle/prompts/critic.txt` (oracle-build-prompts.sh 실행 결과)

**설치**:
- Codex CLI 0.122.0 (글로벌 `@openai/codex`)

---

## 사용자 후속 작업

1. `! codex login` — OAuth 또는 API 키 등록
2. Claude Code 내부:
   ```
   /plugin marketplace add openai/codex-plugin-cc
   /plugin install codex@openai-codex
   /reload-plugins
   /codex:setup
   ```
3. 검증: Oracle에게 `Critic으로 Sprint 113 변경사항 리뷰해줘` 요청 → Critic이 `/codex:review --base 75cb80f` 실행

## 리스크 & 완화

- **R1 Codex 사용량**: ChatGPT 구독 한도 소모 — Oracle이 머지 직전 또는 대규모 변경에만 호출
- **R2 민감 정보 유출**: `.env`·JWT 포함 diff 주의 — 페르소나 금지사항에 명시
- **R3 한국어 응답 규칙**: Codex는 영문 응답 — Critic 페르소나가 한국어 요약으로 변환

## 교훈

- **Claude Code 내장 슬래시 커맨드는 AI 도구에 노출되지 않음**: `/reload-plugins`·`/codex:setup` 등 CLI 빌트인은 Bash·Skill·MCP 어떤 경로로도 호출 불가. 4개 대안(Bash/Skill/tmux-send-keys/osascript) 모두 차단 확인. osascript는 macOS 접근성 권한(-25211) 미부여로 실패. 결론: 플러그인 활성화는 사용자 슬래시 커맨드 또는 세션 재시작 필수
- **플러그인 수동 설치 경로의 등가성**: `known_marketplaces.json` 등록 + `cache/{market}/{plugin}/{version}/` 파일 복사 + `installed_plugins.json` 엔트리 추가 3단계가 `/plugin install` 내부 동작과 동등. 단 활성화만 `/reload-plugins` 필요
- **원격 OAuth는 device-auth 모드가 표준**: 일반 `codex login`은 localhost:1455 콜백 필요 → 원격 기기 승인 시 콜백 미도달로 실패. `--device-auth` 모드는 디바이스 코드만 공유하면 외부 기기 어디서든 승인 가능 → 원격/자동화 환경 기본값으로 권장
- **codex-plugin-cc 구조 표준 준수**: commands(7) + agents(1: codex-rescue) + hooks + skills + prompts로 Claude Code 플러그인 스펙 완전 준수. Critic 페르소나 작성 시 플러그인 내부 문서(`commands/review.md` 등)를 참고해 인자 포맷 정합성 확보 가능
- **플랜 모드에서 설치 단계를 조기 분리**: Phase A(인프라 설치)를 Phase B~D(파일 작성)과 병렬화 가능한 독립 단계로 명시 → 사용자 수동 작업(로그인, 슬래시 커맨드)이 블로커가 되어도 문서·페르소나 작업은 진행. 원격 환경의 시간 손실을 최소화

## 이월

- **Phase E 검증 완료 (Sprint 115)**: 다음 세션에서 `codex review --base 75cb80f` CLI 직접 호출로 시연 리뷰 수행 → P2 2건 발견 → Herald 수정 → 재리뷰 P1 1건 발견 → 수정 → 최종 ✅. Critic 3중 가치 입증. 상세: [sprint-115.md](./sprint-115.md)
