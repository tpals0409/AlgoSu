---
sprint: 192
title: "파이썬 호환성 해결 — asyncio.get_event_loop + Pydantic class Config"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-191", "sprint-110"]
related_memory: ["sprint-window"]
topics: ["cicd"]
tldr: "로컬 Python 3.14에서 ai-analysis test_main.py 4건이 asyncio.get_event_loop() 비호환(RuntimeError: no current event loop)으로 실패하던 문제를 해결한다. 4건을 asyncio.run()으로 교체하고, Pydantic V2.0 deprecated class Config:를 model_config = SettingsConfigDict로 마이그레이션. 3.12(CI)·3.13(Docker)·3.14(로컬) 공통 동작 입증, Critic 0건, CI 38 pass / 0 fail."
---
# Sprint 192 — 파이썬 호환성 해결 (asyncio.get_event_loop + Pydantic class Config)

## 목표

- 로컬 Python 3.14에서 `services/ai-analysis/tests/test_main.py`의 `TestStartupShutdownEvents` 4건이 실패하는 `asyncio.get_event_loop()` 비호환을 해결한다.
- CI는 Python 3.12라 통과하지만, Dockerfile 3.13·로컬 3.14 간 호환성 격차를 정리해 3.12~3.14 공통 동작을 보장한다.

## 배경

- Sprint 191 이월 신규 시드: `test_main.py` 4건이 로컬 Python 3.14에서 `RuntimeError: There is no current event loop in thread 'MainThread'`로 실패했다(sprint-191 §이월). CI는 Python 3.12라 통과해 빌드는 무관했으나, 로컬 개발 환경(3.14)과 CI(3.12)·Docker(3.13) 간 버전 격차가 잠재 리스크로 남아 있었다.
- 원인: Python 3.10+에서 `asyncio.get_event_loop()`는 실행 중 루프가 없을 때 deprecation 경고를 거쳐, 3.14에서는 현재 루프가 없으면 더 이상 자동 생성하지 않고 `RuntimeError`를 던진다. 테스트가 `get_event_loop().run_until_complete()` 패턴으로 coroutine을 직접 실행하던 4곳이 이 변경에 노출됐다.
- 부수적으로 `src/config.py`의 Pydantic `class Config:`(V1 스타일)가 V2.0에서 deprecated되어(`PydanticDeprecatedSince20`) V3.0 제거 예정 경고를 발생시켰다.

## 결정

### D1. 범위 확정 — 코드 호환성 수정에 집중, CI 버전 상향은 제외 (사용자)

- 착수 조사로 3건의 호환성 문제를 재현·확정: ① test_main.py 4건 실패 ② config.py Pydantic deprecation ③ pytest_asyncio 내부 경고.
- 사용자에게 "CI Python 3.12 → 3.13(Dockerfile 정합) 상향" 포함 여부를 질문 → **제외** 확정. 근거: 블라스트 반경(전 Python 파이프라인 재검증)이 크고, 버전 정합은 별도 스프린트로 분리하는 것이 안전.

### D2. asyncio 패턴 — `asyncio.run()` 채택

- `asyncio.get_event_loop().run_until_complete(coro)` → `asyncio.run(coro)`.
- 각 테스트가 독립 coroutine(`startup_event()` 1건 / `shutdown_event()` 3건)을 1회 await하는 구조라, 매번 새 루프를 생성·종료하는 `asyncio.run()`이 가장 적합. `new_event_loop()` 수동 관리보다 간결하며 3.12~3.14 공통 동작.

### D3. Pydantic V2 마이그레이션 — `SettingsConfigDict`

- `class Config: env_file = ".env"` → `model_config = SettingsConfigDict(env_file=".env")`. import에 `SettingsConfigDict` 추가. 동작은 `.env` 로드로 동일, deprecation 경고만 제거. `@field_validator` 등 기존 로직 무변경.

### D4. pytest_asyncio 경고 — 범위 외 (문서화만)

- `get_event_loop_policy`/`set_event_loop_policy` 경고(잔존 19건)는 pytest-asyncio 0.26.0 **라이브러리 내부 호출**이라 우리 코드에서 수정 불가. Python 3.16 제거 예정으로 즉시성 없음. 라이브러리 상위 버전에서 자연 해소될 잔존 경고로 기록.

## 구현

### 구현 커밋 (2커밋, PR #337 squash → `5370c78`)

- `4d21d18` fix(ai-analysis) — Python 3.14 asyncio.get_event_loop 비호환 해결 (test_main 4건): `asyncio.run()` 교체 (startup 1·shutdown 3)
- `b1d0554` refactor(ai-analysis) — Pydantic class Config → SettingsConfigDict (V2 마이그레이션)

## 검증

- **로컬 (Python 3.14)**: `pytest tests/ -q` → **327 passed**, 커버리지 **99.09%**(게이트 97%+), `config.py` 100%.
- **우리 코드 DeprecationWarning 0건**: `PydanticDeprecatedSince20`(config.py) 제거 확인. 잔존 19건은 전부 pytest_asyncio 내부 `get_event_loop_policy`(범위 외, D4).
- **ruff**: lint(src+tests) `All checks passed!` · format --check(src) 통과.
- **Critic**: `codex review --base main` — 이슈 0건("변경은 Pydantic 설정 구문 갱신과 테스트 이벤트 루프 접근을 asyncio.run으로 교체한 것에 한정. 기존 코드/테스트를 깨뜨릴 동작 없음").
- **CI #337**: **Failed 0 / Passed 38**. ai-analysis 전 잡 SUCCESS — Quality(ruff)·Test AI Analysis(**Python 3.12**)·Build AI Analysis Service(**Docker 3.13**)·Trivy. → 3.12·3.13·3.14 공통 동작 입증.

## 교훈 / 패턴

- ① **런타임 버전 격차는 "최신 로컬 = 조기 경보"로 활용** — CI(3.12)는 통과하지만 로컬(3.14)이 먼저 실패해 미래 호환성 부채를 조기 노출. CI만 green이라고 안심하지 말고, 가장 앞선 로컬 버전의 실패를 선제 신호로 처리하면 버전 상향 시점의 일괄 파손을 예방.
- ② **"우리 코드 경고 0"과 "전체 경고 0"을 구분** — 잔존 19 경고를 출처별로 분류해 우리 코드(`src/`·`tests/`) 0건 vs 3rd-party(pytest_asyncio) 19건을 명확히 가름. 라이브러리 내부 경고를 무리하게 억제(버전 강제 상향)하기보다, 출처 분류 후 범위 외로 명문화하는 것이 블라스트 반경을 최소화.
- ③ **호환성 수정과 버전 정합 상향은 분리** — 코드 호환성(asyncio/Pydantic)은 블라스트 반경이 작아 즉시 처리, CI 버전 상향(3.12→3.13)은 전 파이프라인 재검증이 필요하므로 별도 스프린트로 분리(사용자 결정). 한 스프린트에 묶지 않아 회귀 위험과 검증 부담을 격리.

## 이월 항목

- 선택 후속: **CI PYTHON_VERSION 3.12 → 3.13 상향** (Dockerfile 3.13 정합) — 본 스프린트 범위 제외(D1), 별도 스프린트로 분리 검토.
- 잔존(범위 외): `pytest_asyncio` `get_event_loop_policy`/`set_event_loop_policy` 경고 — 라이브러리 내부, Python 3.16 제거 예정. pytest-asyncio 상위 버전 채택 시 자연 해소.
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard / Sprint 160~191 누적 UAT.
