---
sprint: 247
title: "AI 분석 기능 버그 수정 + Oracle 추론 프로토콜 강화"
date: "2026-07-07"
status: completed
agents: [Oracle, Sensei]
related_adrs: ["sprint-246"]
related_memory: ["sprint-window", "hermes-oracle-claude-acp", "project-model-selection-strategy"]
topics: ["ai-analysis", "bugfix", "circuit-breaker", "oracle-protocol", "tooling"]
tldr: "ai-analysis 서비스 ANTHROPIC_API_KEY 미설정 → Circuit Breaker OPEN 고착 → 무음 장애 패턴을 config.py validator 추가로 서비스 시작 즉시 실패(CrashLoopBackOff) 전환, CLAUDE_MODEL_ID 환경변수화, errorType 로그 필드 추가(PR #458, Critic CLEAN, pytest 346 passed / 99.11%). Oracle 내부 개선: reasoning_effort medium→high, SOUL.md 추론 프로토콜 B1~B5 + Verification Gate 2섹션 추가(49→110줄), Tier 1 에이전트 스킬 5종 구현 전 추론 검증 삽입. Claude Code start/stop → sprint-open/sprint-close 명령어 이름 충돌 해소(PR #457). 교훈: 무음 장애는 fail-fast 패턴으로 전환, Fable-5 암묵적 추론을 Opus에서 명시적 프로토콜로 강제 가능, Critic/auto-merge 완료 알림 패턴 미비 확인 → SOUL.md 명문화."
---
# Sprint 247 — AI 분석 기능 버그 수정 + Oracle 추론 프로토콜 강화

## 목표

- ai-analysis 서비스의 AI 분석 실패 원인을 파악하고 수정한다.
- Oracle 추론 프로토콜을 강화해 Opus에서도 Fable-5 수준의 추론 패턴을 재현한다.
- Claude Code `/start`·`/stop` 명령어 이름 충돌(Hermes 스킬과 중복)을 해소한다.

## 배경

- 사용자 보고: ai-analysis 서비스에서 "AI 분석 실패" 응답이 반복됨.
- 원인 조사 결과: `ANTHROPIC_API_KEY` 미설정(또는 만료) 시 Anthropic SDK 초기화는 성공(초기화 시점에 키 검증 없음) → 첫 API 호출에서 `AuthenticationError` → Circuit Breaker `record_failure()` 5회 → **CB OPEN 고착** → 이후 모든 요청 즉시 `status: failed` 반환. 로그에 에러 기록은 있으나 운영자 인지 경보 없는 **무음 장애** 패턴.
- Oracle 측: Hermes 이전(Sprint 246) 이후 Critic 실행 중 응답 지연·PR 머지 완료 알림 미전달 문제 확인.
- 명령어 충돌: Claude Code `/start`·`/stop` ↔ Hermes `algosu-lifecycle-start`·`algosu-lifecycle-stop` 이름 중복으로 Telegram에서 혼선.

## 결정

### D1. AI 분석 — fail-fast validator 도입

- `services/ai-analysis/src/config.py`에 `ANTHROPIC_API_KEY` 빈 값 검증 로직 추가 → 서비스 시작 시 즉시 `ValueError` 발생(k8s CrashLoopBackOff). 이전: 무음 장애(서비스는 뜨지만 모든 분석 요청 실패) → 이후: 즉각적·명시적 운영 신호.
- 근거: **무음 장애는 fail-fast 패턴으로 전환**해야 운영자가 즉시 감지 가능. "실패하면 시끄럽게"가 "조용히 틀린 결과"보다 낫다.

### D2. CLAUDE_MODEL_ID 환경변수화

- 하드코딩된 `MODEL_ID = "claude-haiku-4-5-20251001"` → `CLAUDE_MODEL_ID` 환경변수로 전환(기본값 유지). 코드 재배포 없이 모델 변경 가능.
- 근거: Sprint 246에서 확인한 Codex 모델 핀 필요성 교훈 적용 — 모델 ID를 코드에 박으면 모델 교체 비용이 재배포 사이클 전체가 됨.

### D3. Oracle reasoning_effort 상향

- `config.yaml` `reasoning_effort: medium → high`. Fable-5는 모델 내부 최고 추론 강도를 사용하므로 Opus 전환 시 동등한 깊이를 확보하려면 Hermes 추론 예산을 `high`로 올려야 함.

### D4. Claude Code 명령어 이름 변경

- `.claude/commands/start.md → sprint-open.md`, `stop.md → sprint-close.md`. Hermes 스킬 `source:` 메타데이터도 동기화. 연관 docs 8파일 참조 갱신.
- 근거: Telegram `sprint-open`·`sprint-close` 슬래시 명령 등록 시 `start`·`stop`은 범용 단어라 명확성이 낮고 Hermes 스킬과 이름이 충돌함.

## 구현

### AI 분석 버그 수정 (PR #458, Sensei)

- `services/ai-analysis/src/config.py`: `ANTHROPIC_API_KEY` 빈값 검증 validator 추가, `CLAUDE_MODEL_ID` 환경변수 읽기.
- `services/ai-analysis/src/claude_client.py`: `errorType` 로그 필드 추가 → `AuthenticationError` 등 종류 식별 가능.
- `services/ai-analysis/requirements.txt`: Anthropic SDK 하한 `0.103.0` (Dependabot 채택).
- 테스트: `TestAnthropicApiKeyValidation` 4케이스 추가, pytest **346 passed**, 커버리지 **99.11%**.
- ruff: `test_main.py:705` F841 미사용 변수 제거 + 3 테스트 파일 format 정렬.
- **Critic (Codex gpt-5.5) CLEAN** — "변경이 의도한 fail-fast 구성과 일치, AI 분석 테스트 스위트 전 통과, 실행 가능한 회귀 없음."

### Oracle 추론 프로토콜 강화 (PR #457, Oracle 자체 작업)

- `SOUL.md` 49줄 → 110줄: `## Reasoning Protocol` (B1~B5) + `## Verification Gate` 2섹션 추가.
  - **B1. 관찰→가설→증거 수집**: 복잡한 판단 전 가설 최소 2개 명시, 병렬 증거 수집, "A가 맞다. 근거: ___" 합성.
  - **B2. 실패 모드 선제 탐색**: 코드 변경·배포 전 실패 시나리오 최소 1개 도출, 검증 가능하면 선행.
  - **B3. ADR 교차 참조**: 아키텍처 판단 시 실제 ADR 열람 후 결정 (grep 없이 "ADR 근거" 주장 금지).
  - **B4. 자기보고 불신**: 에이전트 "tsc exit 0" 주장 → Oracle 직접 재실행 (Sprint 246 Gatekeeper 오보 교훈 박제).
  - **B5. 불확실성 명시**: "아마"·"보통은" 근거 없는 사용 금지, 불확실하면 "파일 X 읽기 전까지 단정 불가" 형식.
  - **Verification Gate**: 코드 변경 보고 전 5게이트(물리 확인·tsc·eslint·jest·문서) 필수.
- Tier 1 에이전트 스킬 3종 (Gatekeeper·Conductor·Librarian): `[3.5 구현 전 추론 검증]` 단계 삽입.
- Sensei: `[3.5 AI 분석 추론 프로토콜]` 삽입 (프롬프트 가설·모델 적합성·출력 검증 계획·fallback 로직).
- Lifecycle 스킬 2종: 5.5단계(컨텍스트 합성), 4.5단계(종료 전 일관성 추론) 삽입.
- SOUL.md Critic/auto-merge 완료 알림 패턴 명문화 (백그라운드 실행 + "완료 시 알림" 사전 선언 의무).

## 검증

- pytest 346 passed, 커버리지 99.11% (임계치 98% 초과) ✅
- Ruff lint·format CLEAN ✅
- CI 38 SUCCESS, 12 SKIPPED (PR #458 기준) ✅
- Critic (Codex gpt-5.5, base `ee93b0b`) CLEAN — Critical/High/Medium 0건 ✅
- doc-refs check: 469 files, broken refs 0 ✅
- ADR 게이트: index **185** (sprint-247 추가), EN 대기.

## 교훈

1. **무음 장애는 fail-fast로 전환이 근본 해결이다.** Circuit Breaker가 OPEN이 되더라도 서비스 자체가 뜨면 운영자가 인지하기 어렵다. 키 미설정 같은 필수 설정은 서비스 시작 시점에 검증해야 CrashLoopBackOff로 즉각 감지 가능.

2. **Fable-5의 암묵적 추론 패턴을 Opus에서 명시적 프로토콜로 강제할 수 있다.** `reasoning_effort: high` + SOUL.md B1~B5는 모델이 내재적으로 하는 사고 흐름을 명문화해 Opus에서도 같은 패턴을 강제한다.

3. **Critic 완료·PR 머지 알림은 사전 선언 + 비동기 전달이 필수.** 포어그라운드 Codex 실행은 timeout 초과 시 결과 유실. 앞으로: 백그라운드 실행 → "완료 시 알림" 먼저 전달 → 완료 후 결과 보고.

4. **auto-merge 후 상태 폴링 없이 진행 → 머지 완료 알림 미전달.** `gh pr merge --auto` 설정 후 CI 완료 대기 시간 동안 상태 전달 절차 없으면 사용자가 완료 여부를 모름. 앞으로: cron/폴링 또는 즉시 확인 후 보고.

## 이월

- **운영 필수**: aether-gitops `ANTHROPIC_API_KEY` SealedSecret 유효 여부 확인 + 배포 (사용자 직접, 중요). 유효한 키 없으면 배포 후 CrashLoopBackOff 발생.
- GA4 Enhanced Measurement OFF (사용자 직접)
- GA4 프로덕션 동작 UAT
- 서버 재배포 + 라이브 SEO 검증
- GA4 admin 데이터 스트림 URL 정합
