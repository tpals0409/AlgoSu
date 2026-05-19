---
sprint: 159
title: "AI 분석 데이터 파싱 핫픽스 + base image CVE deploy unblock"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-158"]
related_memory: ["sprint-window"]
---
# Sprint 159 — AI 분석 데이터 파싱 핫픽스 + base image CVE deploy unblock

## 목표

- AlgoSu 스터디 사용자 dh4m 의 최근 제출 AI 분석 결과 페이지에서 raw JSON/마크다운 텍스트가 그대로 노출되는 버그 핫픽스
- 핫픽스 본 PR 머지 직후 post-merge `Trivy Scan — ai-analysis` 실패로 GitOps update + Deploy Notification skipped → production 배포 차단 → forward-fix 로 unblock
- /start 호출 없이 진행된 긴급 hotfix sprint 의 정식 회고 기록

## 결정

- **3중 방어선 패턴 채택**: 단일 지점 fix 대신 (A) 백엔드 envelope + (B) 프론트 string-aware brace counter + (C) 프론트 친화 fallback 3중 적용. 한 단계 우회 시 다음 단계 방어. Sprint 155 3단 안전망 패턴 직접 계승
- **Auto-Critic P2 옵션 분기 판정**: Critic R1 P2 1건(`raw_excerpt` logger 노출) → Oracle 옵션 A(허용)/B(수용) 중 **B 채택**. 본 sprint 목표 = raw 노출 차단인데 logger 노출 잔존은 자기 모순. sprint 목표를 기준으로 옵션 결정 (Sprint 155 패턴 계승)
- **"메인 머지 실패" forward-fix 채택**: PR #272 머지 자체는 성공이나 post-merge Trivy fail로 deploy pipeline 차단. revert 가 아닌 base image 패치 PR 추가로 unblock. 코드는 정상이므로 forward-fix 가 올바른 방향
- **base image 패치 방식**: alpine 전환 대신 `apt-get update && upgrade -y` 양 stage 적용. alpine 은 build-time 의존성 변경 위험으로 별도 sprint 범위. `.trivyignore` 는 보안 노출 fix sprint 에서 보안 스캔 우회 모순으로 거부
- **Critic 1차 통과 후 자기 모순 검출 가능**: P1 envelope 도입은 OK 였으나 logger raw_excerpt 잔존이 sprint 목표 자기 모순. Codex 교차 검증의 hotfix sprint 일관성 가드 효과 재확인

## 구현 (2 PR squash merge, origin/main `a73c596` → **`2ec3747`**)

| PR | Phase | Owner | 변경 내용 | Lines |
|----|-------|-------|----------|-------|
| [#272](https://github.com/tpals0409/AlgoSu/pull/272) | A/B/C + Critic P2 + format | architect ×4 + critic | dh4m AI 분석 파싱 3중 방어선 + Critic P2 보강 + ruff format | +226 −24 |
| [#273](https://github.com/tpals0409/AlgoSu/pull/273) | base image CVE | architect | `python:3.13-slim` OS 3건 HIGH CVE 패치로 deploy unblock | +10 |

### PR #272 세부 — AI 분석 파싱 핫픽스 (5 commit squash)

**증상**: dh4m 제출의 AI 분석 결과 페이지에 raw JSON/마크다운 텍스트가 카테고리/요약 대신 그대로 노출

**근본 원인 체인**:
1. Claude API 가 malformed JSON 응답 반환 (예: `'broken{json "totalScore": 90 more broken'` 패턴)
2. 백엔드 `services/ai-analysis/src/claude_client.py:_parse_response` (line 216~344) 의 4단계 fallback (markdown strip / 숫자 따옴표 sanitize / optimizedCode null화 / first JSON object 추출) 모두 실패
3. catch-all 블록(line 311~344) 이 `raw_text`를 `feedback` 필드에 그대로 저장 + `status=completed` 반환 (정규식으로 totalScore 추출 성공 시)
4. 프론트 `frontend/src/lib/feedback.ts:parseFeedback` (line 109~146) 의 catch 블록이 fallback 에서 `summary: feedback` 으로 raw 텍스트 노출
5. 추가 결함: 프론트 `cleanAndExtractJson` brace counter (line 95~99) 가 문자열 내부 중괄호 비인식 — 백엔드 `_extract_first_json_object` (line 497~534, in_string + escape 추적) 대비 robustness 불일치

**3중 방어선 적용**:

**(A) 백엔드 envelope** (`services/ai-analysis/src/claude_client.py:311~362`):
- catch-all 폴백이 raw 텍스트 대신 항상 유효 JSON envelope 저장
- envelope 구조: `{"totalScore": <regex>, "summary": <친화 메시지>, "categories": [], "optimizedCode": null}`
- score 유무에 따라 summary 차등: score>0 "AI 분석 결과 파싱에 일시적 오류... 점수만 확인" / score=0 "AI 분석 결과를 표시할 수 없습니다. 잠시 후 다시 시도"
- Critic P2 후속: `raw_excerpt` logger extra 제거, `error/score_extracted/raw_length` 메타데이터만 노출

**(B) 프론트 string-aware brace counter** (`frontend/src/lib/feedback.ts:78~118`):
- `findJsonObjectEnd` 함수 신규 — 백엔드 `_extract_first_json_object` 의 in_string + escape 추적 로직과 1:1 매핑
- 문자열 내부 중괄호 (예: `"optimizedCode": "def f(): return {1,2}"`) 정상 처리

**(C) 프론트 친화 fallback** (`frontend/src/lib/feedback.ts:144~158`):
- `parseFeedback` catch 블록이 raw `feedback` 텍스트를 `summary` 로 노출하지 않음
- 사용자 친화 메시지 "AI 분석 결과를 표시할 수 없습니다. 잠시 후 다시 시도해주세요." 로 대체

### PR #272 세부 — Critic P2 hotfix 사이클

**Critic R1** (Codex gpt-5, `--base main`):
- P2 1건: `services/ai-analysis/src/claude_client.py:317~320` 의 `raw_excerpt = raw_text.strip()[:200]` 후 `logger.warning(..., extra={"raw_excerpt": raw_excerpt})` 가 raw Claude 응답(사용자 코드/마크다운/잠재 비밀 포함 가능)을 logs/log aggregation 으로 노출
- 본 핫픽스의 목표(raw 텍스트 노출 차단)와 자기 모순

**Oracle 판정**: 옵션 B 수용 (차단 유지) — sprint 목표가 raw 노출 차단이므로 logger 노출도 차단

**Architect 재위임 결과** (commit `33cad49`):
- `raw_excerpt` 필드 제거, logger extra 메타데이터만 (`error[:100]`, `score_extracted`, `raw_length`)
- score 추출 로직을 logger 위로 이동시켜 `score_extracted` 라벨 활용
- 신규 테스트 `test_fallback_does_not_leak_raw_text_to_logs` (caplog 기반)

**Critic R2**: clean ✅ "did not find a discrete functional, security, or maintainability regression"

### PR #272 테스트 (백엔드 갱신 3 + 신규 2 / 프론트 갱신 1 + 신규 2)

**백엔드** (`services/ai-analysis/tests/test_claude_client.py`):
- 갱신: `test_parse_invalid_json_returns_envelope` (이전 `_returns_raw`), `test_fallback_total_failure_regex_score`, `test_fallback_total_failure_no_score` — feedback 이 유효 JSON envelope 인지 + raw 텍스트가 envelope/feedback 에 절대 노출되지 않음 검증
- 신규: `test_fallback_envelope_is_valid_json` — raw 마크다운 혼합 응답에서도 feedback 이 항상 valid JSON dict
- 신규: `test_fallback_does_not_leak_raw_text_to_logs` (caplog 기반) — raw_text/잠재 비밀 토큰이 logger 어디에도 노출되지 않음 + 메타데이터 필드만 존재

**프론트** (`frontend/src/lib/__tests__/feedback.test.ts`):
- 갱신: parseFeedback fallback 친화 메시지 검증
- 신규: `cleanAndExtractJson handles braces inside string values` — 문자열 내부 중괄호 정상 파싱
- 신규: `parseFeedback fallback shows friendly message not raw dump` — raw 텍스트가 summary 에 포함되지 않음 검증

**검증**:
- pytest `tests/test_claude_client.py`: 78/78 PASS (claude_client.py coverage 99%)
- jest `feedback.test.ts`: 44/44 PASS + tsc clean
- ruff check `src/`: All checks passed
- ruff format `src/`: 9 files already formatted (commit `44eee44` 후)

### PR #273 세부 — base image CVE deploy unblock

**증상**: PR #272 머지 자체는 성공 (origin/main `505568a`) 이나 post-merge CI run `26071766405` 에서 `Trivy Scan — ai-analysis` fail → `Update GitOps manifests` + `Deploy Notification` skipped → production 배포 차단. "메인 머지 실패" 의 실체.

**Trivy 검출 CVE 3건** (모두 base image `python:3.13-slim` = Debian 13 Bookworm OS 패키지):

| CVE | 패키지 | Installed | Fixed | Severity |
|---|---|---|---|---|
| CVE-2026-4878 | libcap2 | 1:2.75-10+b8 | 1:2.75-10+deb13u1 | HIGH |
| CVE-2026-29111 | libsystemd0 | 257.9-1~deb13u1 | 257.13-1~deb13u1 | HIGH |
| CVE-2026-29111 | libudev1 | 257.9-1~deb13u1 | 257.13-1~deb13u1 | HIGH |

**보안 표면 비교**:
- ai-analysis: `python:3.13-slim` (Debian 13) ← 영향
- 5 NestJS 서비스: `node:22-alpine` ← 영향 없음 (alpine, debian 비종속)
- Python 패키지(Pydantic, FastAPI, anthropic 등): 모두 clean (0 vulnerabilities)

**변경** (`services/ai-analysis/Dockerfile`, +10):
- builder + runner 양 stage 에 OS 보안 패치 레이어 추가:
```dockerfile
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
```
- debian security repo 의 `deb13u1` 패치 자동 적용
- `--no-install-recommends` + cache 정리로 이미지 크기 영향 최소화

**검증**:
- PR #273 CI: 29 SUCCESS / 0 FAIL (Trivy 는 PR 단계 SKIP, post-merge 만 실행)
- Critic R1: clean ✅ "package index update/upgrade/cleanup steps to both Docker build stages... no discrete regression"
- Post-merge CI run `26072326494`: ALL SUCCESS 포함:
  - `Trivy Scan — ai-analysis`: ✅ success
  - `Update GitOps manifests`: ✅ success (이전 SKIPPED → unblock)
  - `Deploy Notification`: ✅ success (이전 SKIPPED → unblock)

## 검증

| 단계 | 결과 |
|---|---|
| PR #272 pre-merge CI | 31 SUCCESS / 0 FAIL |
| PR #272 Critic R1 | P2 1건 (`raw_excerpt` logger 노출) |
| PR #272 Critic R2 | clean ✅ |
| PR #272 mergeStateStatus | CLEAN ✅ |
| **PR #272 post-merge CI** | ❌ Trivy Scan — ai-analysis fail (base image CVE) |
| **GitOps update / Deploy Notification** | ❌ SKIPPED (production 배포 차단) |
| PR #273 pre-merge CI | 29 SUCCESS / 0 FAIL |
| PR #273 Critic R1 | clean ✅ |
| PR #273 mergeStateStatus | CLEAN ✅ |
| **PR #273 post-merge CI** | ✅ ALL SUCCESS |
| **Trivy Scan — ai-analysis (재실행)** | ✅ success |
| **Update GitOps manifests** | ✅ success (unblock) |
| **Deploy Notification** | ✅ success (unblock) |

## 신규 패턴

1. **3중 방어선 패턴** — 백엔드 envelope + 프론트 string-aware parser + 사용자 친화 fallback. 한 단계 우회 시 다음 단계 방어. Sprint 155 3단 안전망(plan + pre-push + CI lint) 직접 계승, 본 sprint 는 백엔드/프론트 layer 분리 적용
2. **Auto-Critic P2 hotfix sprint 자기 모순 검출** — P1 envelope 도입은 raw 노출 차단 성공이지만 logger raw_excerpt 잔존이 sprint 목표 자기 모순. Codex 교차 검증의 sprint 일관성 가드 효과. Sprint 117~ Auto-Critic 정착 패턴 계승
3. **Oracle 옵션 분기 sprint 목표 기준 결정** — Critic 제시 옵션 A/B 중 sprint 목표 = raw 노출 차단 → 옵션 B(차단 유지) 채택. Sprint 155 패턴 직접 계승
4. **"메인 머지 실패" forward-fix 패턴** — git merge 성공 + post-merge security gate fail 로 deploy pipeline 차단 시 revert 회피, base image 패치 PR 추가로 unblock. 코드 정상 상태 유지 + 보안 패치 별도 PR로 history 분리 명확
5. **PR 단계 Trivy SKIP + post-merge fail 패턴 노출** — matrix conditional 로 PR 단계 SKIP, post-merge 만 실제 실행. base image 회귀의 pre-merge 검출 불가 → 사후 forward-fix 필수. Sprint 160 시드: PR 단계 Trivy 활성화
6. **Python(Debian) vs NestJS(alpine) 보안 표면 차이** — Python 서비스 base image 가 OS CVE 노출 빈도 높음. base image 정기 갱신 자동화 필요. Sprint 160 시드: Dependabot Dockerfile updater 또는 weekly cron
7. **/start 없이 진행된 긴급 hotfix sprint 정식 회고** — 비정상 흐름이지만 실 작업이 main 머지된 상태에서 사용자 /stop 호출 시 Sprint 159 슬롯 사용 + 정상 회고 작성. status 가드 우회 정책

## 교훈

1. **백엔드 정규식 score fallback robustness ≠ 사용자 가시성** — totalScore 정규식 추출 + status=completed 처리로 분석 자체는 success 표시되나 feedback 필드에 raw 노출 시 사용자에게는 무용. frontend 까지 envelope 일관성 필수
2. **프론트 brace counter는 백엔드 string-aware 로직과 1:1 매핑 의무** — defense in depth. 한쪽만 string-aware 면 다른쪽이 broken JSON 으로 받아 fallback 진입. Sprint 159 hotfix 본질의 기술 부채 노출
3. **Critic 1차 통과 후 sprint 목표 자기 모순 검출 가능** — P1 envelope 도입 성공이지만 logger raw_excerpt 잔존이 자기 모순. Auto-Critic 자동 큐잉(Sprint 117~) 본 sprint 효과 재확인. 메시지/심볼/exit code 일관성과 동급으로 sprint 목표 일관성 가드
4. **PR 단계 Trivy SKIP 은 base image 회귀의 pre-merge 검출 불가** → 사후 forward-fix 필수. Sprint 160 시드 활성화로 검출 시점 앞당기기
5. **git merge 성공 ≠ deploy 성공** — post-merge security gate fail 로 GitOps update + Deploy Notification skipped 시 production 미반영. "메인 머지 실패" 의 실체는 deploy pipeline 차단. 사용자 가시성 메시지가 모호하므로 가드 명확화 필요
6. **`python:3.13-slim` Debian base 는 OS CVE 정기 노출 가능성** — alpine 전환은 build-time 의존성 변경 위험이지만 base image 정기 갱신은 필수. Sprint 160 시드: Dependabot Dockerfile updater 또는 weekly cron 으로 자동화
7. **`_parse_group_response` 동일 raw_text fallback 패턴 잔존** — architect 보고에서 식별. 본 sprint 범위 외이나 그룹 분석 사용 시 동일 노출 위험. Sprint 160 이월 시드 #신규3
8. **`apt-get upgrade` 양 stage 적용은 표준 패턴** — base image 태그 변경(회귀 위험) 대비 안전. `--no-install-recommends` + cache 정리로 이미지 크기 영향 최소화 (예상 +5~10MB)
9. **PR 머지 시점이 deploy 완료가 아님** — 사용자 알림 메시지/Discord 등에서 "머지 ≠ 배포" 구분 명시 필요 (Sprint 160+ UX 시드)

## Sprint 160 이월 시드

### 신규 자동화 후보 (Sprint 159 도출)

- **시드 #신규1**: PR 단계 Trivy scan 활성화 — matrix conditional 변경으로 base image 회귀 pre-merge 검출 (본 sprint forward-fix 사이클 회피)
- **시드 #신규2**: base image 정기 갱신 자동화 — Dependabot Dockerfile updater 활성화 또는 weekly cron 으로 `apt-get upgrade` 재빌드 (Sprint 156 weekly cron 패턴 계승)
- **시드 #신규3**: `_parse_group_response` raw_text fallback 동일 envelope 적용 — 그룹 분석도 본 sprint dh4m fix 와 동일 envelope 보호 적용 (architect 식별)
- **시드 #신규4**: deploy pipeline 차단 알림 강화 — "git merge 성공 + deploy 차단" 케이스를 Discord/Slack 명확 분리 알림 (사용자 "메인 머지 실패" 모호 메시지 회피)

### Sprint 158 이월 계속

- **신규 자동화 후보**:
  - 시드 #30: 빌드 산출물 한국어 잔재 자동 검증 CI step (allowlist 기반)
  - 시드 #31: i18n 매칭 체크리스트 3계층 (메타/UI/본문) plan 템플릿 자동
- **Sprint 157 이월 계속**:
  - 시드 #24: plan 템플릿 i18n 양면 의무 체크리스트 자동
  - 시드 #26: docs/adr/README.md paths filter negation
  - 시드 #27: CI build-blog `ls out/` 산출물 실재 검증 step
  - 시드 #28: check-adr-links.mjs ROOT 자동 감지
  - 시드 #29: plan 템플릿 "신규 CI step 추가 시 probe step 동반 의무"
- **UAT 사용자 직접 (16 스프린트 누적)**:
  - 시드 #5: 프로그래머스 재제출 채점 통과 확인
  - 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합
- **이월 유지**:
  - 시드 #18: 블로그 글 머지 전 도메인 사실 cross-check 자동화
  - 시드 #23: plan 템플릿 "rebase 후 누적 카운트 fix" 체크리스트
- **후속 (선택)**:
  - create/edit page.tsx category UI
  - Programmers URL 자동 카테고리 추론
  - 기존 SQL 문제 데이터 백필
  - coverage-gate `skipped` 허용 제거 (Sprint 156 Phase B 옵션 B)
  - post-merge pre-deploy gate (Sprint 156 Phase B 옵션 C)
  - prom-client Case B~D 점검 자동화
  - `.claude-tools/` Phase 2 실제 삭제 (trigger path 검증 후)
  - `(adr)` layout 분할 (KR + EN override) — Sprint 158 description 단일화의 대안

## 브랜치 규율

✅ **27 스프린트 연속 준수** — 2 PR 모두 신규 브랜치 + Squash merge, main 직접 commit 0건, `--no-verify` 0건. 본 sprint /start 없이 진행됐지만 작업 브랜치 분리 + PR 머지 + Critic 교차 검증 정식 절차 모두 준수.

## 참고

- 이전 sprint: [sprint-158.md](sprint-158.md)
- PR #272: https://github.com/tpals0409/AlgoSu/pull/272
- PR #273: https://github.com/tpals0409/AlgoSu/pull/273
- main HEAD: `a73c596` → `2ec3747`
