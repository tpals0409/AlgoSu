---
sprint: 246
title: "AlgoSu 운영·개발 프로세스 Hermes Agent 마이그레이션 (Phase 1)"
date: "2026-06-22"
status: completed
agents: [Oracle, Sensei, Gatekeeper, Critic]
related_adrs: ["sprint-244"]
related_memory: ["sprint-window", "oracle-dispatch", "hermes-oracle-claude-acp"]
topics: ["orchestration", "hermes-agent", "migration", "tooling"]
tldr: "AlgoSu 오케스트레이션(Oracle + 12 에이전트)을 Claude Code tmux 디스패치에서 Hermes Agent 네이티브 경로(skill + delegate_task + Oracle 직접 codex + memory)로 이전하는 Phase 1. 사용자와 결정 7건 합의: ①완전 대체(tmux 폐기) ②동시성 max_concurrent_children 3→6·depth 1 유지·auto-critic은 Oracle 순차 호출 ③개별 스킬 12개 ④Critic은 Oracle 직접 codex review(자기보고 리스크 0) ⑤라이프사이클은 절차만 스킬·검증된 scripts/*.mjs 그대로 호출(하이브리드) ⑥inbox 폐기→delegate 반환·MEMORY.md 정본 유지+Hermes memory 인덱스 미러 ⑦스파이크 선행 후 정식 전환. 스파이크 2사이클 실증: Sensei(read-only 분석 품질 합격)·Gatekeeper(풀 사이클 jwt.middleware.ts 로그 2건 2-인자 구조화 7bb885a → Oracle 직접 검증 diff/tsc/eslint/jest 18/18 → Oracle 직접 codex review CLEAN). 중대 발견: Codex 기본 모델 gpt-5.3-codex·gpt-5.5-codex는 ChatGPT 계정 미지원(400), gpt-5.5(접미사 없음)만 작동 → critic 절차에 -c model=gpt-5.5 핀 박제(메모리 이월 'Codex 모델 핀' 해소). Phase 1 산출물: 12 페르소나 스킬(algosu-agent-*)·algosu-agent-critic(codex 핀)·/start·/stop 라이프사이클 스킬·max_concurrent_children 3→6·Hermes memory 미러. 산출물 대부분은 ~/.hermes/ 프로파일에 있어 repo git 밖이며, repo 변경은 스파이크 커밋 7bb885a 1건 + 본 ADR. Phase 2~4(실운영 검증·라이프사이클 실구동·.claude/commands thin-shim화) 이월."
---
# Sprint 246 — AlgoSu 운영·개발 프로세스 Hermes Agent 마이그레이션 (Phase 1)

## 목표

- AlgoSu의 오케스트레이션 근간(Oracle 단일 지휘 + 12 전문 에이전트)을 Claude Code 기반 **tmux 디스패치**(`oracle-*.sh`, `inbox/*.md`, `oracle-auto-critic.sh`)에서 **Hermes Agent 네이티브 경로**(Hermes skill + `delegate_task` + Oracle 직접 `codex review` + Hermes memory)로 이전한다.
- 이번은 **Phase 1** — 페르소나 스킬화 + 기반 인프라 + 스파이크 실증. 실운영 완전 이전·라이프사이클 실구동·`.claude/commands` 정리는 Phase 2~4로 분리(다중 스프린트 로드맵).
- 전면 교체가 아닌 **스파이크 선행 → 검증 → 정식 전환** 순서로 리스크를 낮춘다.

## 배경

- 기존 시스템: tmux로 12 에이전트를 **무제한 병렬 + 체인 + auto-critic 중첩(depth 2)** 으로 spawn. 결과는 `inbox/{agent}-{task}.md` 파일 회신, 스프린트 기억은 `MEMORY.md`+`memory/*.md` 파일 SSOT.
- Hermes `delegate_task`는 이 프로필 기준 **동시 3 / 중첩 깊이 1** 제약 → 1:1 포팅 시 병렬 규모·중첩이 깨짐. 따라서 "무엇을 네이티브로 옮기고 무엇을 유지할지"를 결정으로 명시화해야 했다.
- 핵심 통찰: tmux의 중첩(auto-critic)은 "에이전트가 에이전트를 부르는" 구조 때문이었고, Hermes에서는 **Oracle 자신이 메인 오케스트레이터**이므로 "Oracle의 작업 후 순차 호출 2번"으로 평탄화(flatten)하면 `depth 1`에서 무손실 재현 가능.

## 결정

### D1. 이관 방식 — 완전 대체 (사용자)
- tmux 디스패치 폐기, 모든 에이전트 실행을 Hermes `delegate_task` 위로. 커스텀 shell 글루(`oracle-dispatch/reap/auto-critic.sh`)·`inbox` 파일 회신 제거 대상.

### D2. 동시성·중첩 한계 대응 — config 상향(옵션 2)
- `delegation.max_concurrent_children: 3 → 6` (병렬 폭 회복, 실사용 거의 전부 커버), `max_spawn_depth: 1` 유지.
- auto-critic은 "에이전트 커밋 훅(중첩)"이 아니라 **Oracle의 작업 후 순차 루틴**으로 재설계 → 중첩 불필요. depth 2 허용(옵션 3)은 토큰 비용↑·미검증 자기보고 누적·Oracle 단독 지휘 원칙과 충돌로 기각.

### D3. 페르소나 이식 — 개별 스킬 12개
- 12 에이전트 페르소나(`.claude/commands/agents/*.md`)를 각각 독립 Hermes 네이티브 스킬(`algosu-agent-{name}`)로 이식. `delegate_task` 위임 시 해당 스킬을 context로 주입.
- 현재 `agents:*`로 노출되던 것은 Claude Code ACP 브리지의 **프롬프트 전용 슬래시**(오케스트레이션 미연결)였으므로 정식 스킬화가 필요했다.

### D4. Critic 실행 — Oracle 직접 codex review (옵션 A)
- Critic은 검증 게이트이므로 서브에이전트 경유(자기보고 신뢰) 대신 **Oracle이 직접** `codex review --commit <SHA>`(또는 `--base`)로 raw 출력을 받아 판단. `oracle-auto-critic.sh`의 "변경분만 리뷰" 로직과 1:1 정합, 자기보고 리스크 0.

### D5. 라이프사이클 이식 — 하이브리드 (옵션 B)
- `/start`·`/stop`의 **절차(단계 정의)** 만 Hermes 스킬로, **실제 작업**(ADR 생성·`translate-adr.mjs` 자동번역·슬라이딩 윈도우 갱신·4파일 일관성 검증)은 **검증된 기존 `scripts/*.mjs`를 그대로 호출**. 결정적 node 로직을 모델 산문으로 재기술하지 않음(드리프트·퇴화 방지).
- 근거: 헤르메스 이전의 가치는 **오케스트레이션·인터페이스·런타임 통합**이지 결정적 빌드 스크립트의 산문화가 아니다. `.mjs`는 `scripts/`(repo)에 있어 `.claude` SSOT 제거(Phase 4)와 직교.

### D6. 결과 회신·기억 — inbox 폐기 + MEMORY 정본 유지 (옵션 B)
- `inbox/{agent}-{task}.md` 파일 회신은 tmux 비동기 구조 글루 → 폐기, `delegate_task` 반환 요약으로 대체.
- 스프린트 기억은 `MEMORY.md`+`memory/*.md`를 **정본 유지**(ADR 생성·블로그 변환·`/stop` 4파일 일관성 검증이 직접 참조하는 도메인 자산). Hermes 프로파일 memory에는 **빠른 회상용 요약 인덱스만 미러**(정본 아님 명시).

### D7. 실행 단위 — 스파이크 선행 후 정식 전환
- 첫 네이티브 전환의 미검증 영역(페르소나 주입 위임 품질·Oracle-순차 critic)을 가장 싸게 검증하기 위해 스파이크 2사이클 선행 → 검증 OK 시 정식 스프린트로 승격(A방안: 스파이크 브랜치를 정식 시작점으로).

## 구현

### 스파이크 실증 (2사이클)
- **Sensei (read-only)**: 페르소나 주입 → 위임 → 구조화 보고 품질 검증. `ai-analysis/src/circuit_breaker.py`를 cockatiel CB 명세(`config.py:37-39`)와 대조, 실유효 발견(`can_execute()` 42줄=20줄 규칙 위반, lock 밖 콜백 재입장 문서화 필요). 보고 형식·라인 인용·추측 배제 전 항목 합격.
- **Gatekeeper (풀 사이클)**: `services/gateway/src/.../jwt.middleware.ts` 문자열 보간 로그 2건 → 2-인자 구조화 (`7bb885a`, +2/−2, S241/242 로깅 정합 방향). Oracle 직접 검증(diff clean·해당 파일 타입에러 0·eslint exit 0·jest 18/18) → **Oracle 직접 `codex review --commit 7bb885a` → CLEAN**(P0/P1 0건, 결정 4 실증). 자기보고 부정확 1건(에이전트 "tsc exit 0" 주장 → 실제 exit 2는 사전 존재 `tsconfig.json:12` baseUrl deprecation, 변경 파일 자체 무해)을 Oracle 직접 검증이 적발 → 결정 6 가치 실증.

### 기반 인프라
- `delegation.max_concurrent_children: 3 → 6` (결정 2), `max_spawn_depth: 1` 유지.
- `algosu-agent-critic` 스킬 신규 — Oracle 직접 호출 절차 + Codex `-c model="gpt-5.5"` 핀 박제(중대 발견 반영).
- `/start`·`/stop` → `algosu-lifecycle-start`·`algosu-lifecycle-stop` 스킬(결정 5, `translate-adr.mjs`·`check-adr-en-coverage.mjs` **호출만** 보존).
- Hermes 프로파일 memory에 스프린트 인덱스+결정+Codex 핀 미러(결정 6, 정본 아님 명시).

### 12 페르소나 스킬
- `algosu-agent-{conductor,gatekeeper,librarian,architect,scribe,postman,curator,critic,herald,palette,scout,sensei}` 생성. Echelon tier/model 매핑 정합(Tier1 opus 3 · Tier2 sonnet 4 + critic codex · Tier3 sonnet 3 + palette opus 예외). 9개는 새 `width-6` 동시성으로 병렬 위임 이식(= 마이그레이션 자체 dogfooding).

### ⚠️ 중대 발견 — Codex 모델 핀 필수
- 기본 모델 `gpt-5.3-codex` → ChatGPT 계정 미지원(400), `gpt-5.5-codex` → 동일 미지원, **`gpt-5.5`(접미사 없음) → 정상 작동**. codex `config.toml`에 top-level `model` 미설정이 원인. critic 호출에 `-c model="gpt-5.5"` 핀 필수. 메모리 누적 이월 항목 "Codex 모델 핀"과 정확히 일치 → 해소.

## 검증

- 스파이크 커밋 `7bb885a`: diff +2/−2 clean(그 외 변경 0), `jwt.middleware.ts` 타입에러 0, eslint exit 0, jest 18/18 pass — Oracle 직접 재실행.
- **Critic(Codex `gpt-5.5`) CLEAN** — "두 JWT 미들웨어 로그 호출을 구조화 로거 인자로 변경한 것뿐, StructuredLoggerService 동작과 호환, 기능 회귀 없음".
- 12 스킬 전수 직접 검증: 존재·frontmatter tier/model 정합·디스패치 글루 누출 0(critic 1건은 의도된 대조 표현)·평문 시크릿 0·포맷 일관성.
- 라이프사이클 스킬 2종: 등록·frontmatter 정합·검증 스크립트 호출 라인 보존(로직 재기술 0)·미러 블록 반영.

## 교훈

1. **tmux 중첩은 Hermes에서 "잃는 것"이 아니라 평탄화 대상이다.** auto-critic이 중첩이었던 건 순전히 "에이전트가 독립 프로세스"인 tmux 구조 탓. Oracle이 메인 루프인 Hermes에서는 "Oracle의 순차 호출 2번"으로 같은 결과를 `depth 1`에서 무손실 재현 — 제약을 한계가 아닌 설계 정렬 기회로 전환.
2. **헤르메스 이전의 가치는 오케스트레이션·런타임 통합이지 결정적 스크립트의 산문화가 아니다.** 검증된 `.mjs`(번역·윈도우·일관성 검증)는 그대로 `terminal()` 호출이 정답. 이를 스킬 본문으로 흡수하는 "더 네이티브" 유혹은 비결정 추론으로의 퇴화 안티패턴.
3. **Oracle 직접 검증이 자기보고 오차를 잡는다.** Gatekeeper의 "tsc exit 0" 보고가 실제 exit 2(사전 존재 deprecation)와 어긋난 것을 Oracle 직접 재실행이 적발 — "서브 보고=미검증 자기보고" 원칙(결정 6)의 가치를 한 사이클 만에 실증.
4. **스파이크 선행이 첫 네이티브 전환의 미검증 영역을 싸게 닫았다.** 12개 전량 이식 전에 Sensei(흐름)·Gatekeeper(풀 사이클·critic 게이트) 2사이클로 결정 1~6 설계가 현실에서 도는 것을 확인 → 정식 전환을 확신 위에 진행.
5. **운영 블로커는 실제 호출에서만 드러난다.** Codex 모델 핀 필요성은 정적 분석이 아니라 실제 `codex review` 호출의 400 에러로 실측됨 — 메모리 이월 항목을 실증으로 해소.

## 이월

- **Phase 2** — 디스패치 완전 이전 실운영 검증(다수 에이전트 동시 위임·auto-critic Oracle-순차 실전 운영), 나머지 라이프사이클 실구동.
- **Phase 3** — 하네스 점검·라이프사이클 cron 이관 검토.
- **Phase 4** — `.claude/commands` thin-shim화 / SSOT 단일화, 런북 갱신.
- 산출물 대부분이 `~/.hermes/` 프로파일(repo git 밖)에 있는 구조 → 향후 프로파일 자산 백업·버전관리 정책 검토.
- 기존 메모리 이월: (하네스 슬롯) pane 가드 항구화+윈도우 장식+상태 오기록 3연속 · `Quality — docs` required 승격 · 블로그 소재(CS 퀴즈 S215~229·zstd) · 사실 게이트 모델 귀속 점검 정식화 · (사용자 콘솔) GA4 3건·라이브 SEO·하네스 cron·webhook regenerate·누적 UAT.
