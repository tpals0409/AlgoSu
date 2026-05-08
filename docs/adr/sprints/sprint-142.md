---
sprint: 142
title: 프롬프트 최적화 — AI 개선 코드 정답성 게이트
status: completed
period: 2026-05-08 (단일 일자)
start_commit: 5c89967
end_commit: 8d3e760
prs:
  - https://github.com/tpals0409/AlgoSu/pull/197 (단일 PR — 5 라운드 Critic 검증)
related_sprints:
  - sprint-95~97 (BOJ→프로그래머스 이전 — 모델/플랫폼 종속성 첫 인식)
  - sprint-135~136 (Critic 도입 회고 — 모델 종속 비용 + 외부 검증층)
  - sprint-141 (이월 시드 일괄 정리 — Critic 정책 강화 패턴)
---

# Sprint 142 — 프롬프트 최적화 — AI 개선 코드 정답성 게이트

## 컨텍스트

사용자 피드백: **"AI 개선 코드 프로그래머스 돌려보면 틀렸다고 나와요."**

ai-analysis 서비스가 생성하는 `optimizedCode`가 채점 플랫폼에서 오답으로 판정되는 회귀.

### 진단된 결함 8건 (P0~P3)

| 우선순위 | 결함 | 위치 |
|---------|------|------|
| P0 | 행동 동등성 강제 부재 | `prompt.py:61` SYSTEM_PROMPT 응답 규칙 |
| P0 | 함수 시그니처 보존 명령 부재 | `prompt.py:216-224` `_build_platform_context` |
| P1 | correctness 평가 대상 모호 | `prompt.py:22-24` |
| P1 | optimizedCode 자가 검증 필드 부재 | `prompt.py:64-85` JSON 스키마 |
| P2 | 문제 컨텍스트 부재 시 silent skip | `prompt.py:248-254` `build_user_prompt` |
| P2 | 가중치 편향 (correctness 30% < 가독성+구조+모범 45%) | `prompt.py:164-170` |
| P3 | `MAX_TOKENS = 8192` 절단 위험 | `claude_client.py:32` |
| P3 | Group 분석 코드 `[:500]` 잘림 | `prompt.py:325` |

### 인프라 조사 결과 (별건 — 본 스프린트 범위 외)

`Submission` 엔티티에 `problemTitle`/`problemDescription` 컬럼 없음 + saga publisher payload에도 미포함 → ai-analysis worker에서 항상 빈 문자열로 호출됨. **문제 컨텍스트 자체가 LLM에 전달되지 않는 구조적 결함**. 본 스프린트는 프롬프트 측 가드만 강화하고 인프라 fix는 Sprint 143+ 시드로 이월.

## 결정

### 범위: Wave A+B (옵션 b — 표준 분량)

- **Wave A (P0)**: SYSTEM_PROMPT/SQL_SYSTEM_PROMPT 행동 동등성 절대 규칙 + `_build_platform_context` 명령형 강화
- **Wave B (P1)**: JSON 스키마 `optimizedCodeMeta` 추가 + claude_client 자가 검증 폴백
- **Wave C (P2)**: Sprint 143+ 이월 — 가중치 재조정은 점수 분포 회귀 위험 + 기존 데이터 비교 기준 상실

근거: Wave A만(P0)은 LLM 무시 시 감지 불가. 자가 검증 필드(P1) violation 감지+안전 폴백이 ROI 보장. Frontend 호환성 변경 0건 확인 후 결정.

### Wave A — 행동 동등성 절대 규칙

SYSTEM_PROMPT/SQL_SYSTEM_PROMPT 응답 규칙 **앞에** `[최우선 규칙]` 섹션 신설:
- 함수 시그니처 / 입출력 형식 / 결과 컬럼명·순서 절대 변경 금지
- 변경 허용 범위는 내부 구현만
- 위반 시 채점 실패 명시 + "확신 없으면 원본 반환" 안전장치

`_build_platform_context` 명령형 강화:
- PROGRAMMERS: 함수 시그니처 보존 명령 (Sprint 142 R3에서 SQL 분기 추가)
- BOJ: 표준 입출력 형식 보존 명령 (Sprint 142 R1에서 Python API 하드코딩 제거 → 언어 중립화)

### Wave B — 자가 검증 메타데이터 + 안전 폴백

JSON 스키마 `optimizedCodeMeta` 추가:
```json
{
  "signaturePreserved": true/false,  // SQL은 미포함
  "behaviorEquivalent": true/false,
  "changes": ["변경 사항 요약"]
}
```

`claude_client._parse_response`에서:
1. `_is_explicit_false` 헬퍼로 엄격 boolean 검증 (Sprint 142 R1 P2 fix)
2. 명시적 `false` 또는 `"false"` 문자열만 폴백 트리거
3. 폴백 시 `optimized_code = None` + **`parsed["optimizedCode"] = None` 동시 적용** (Sprint 142 R2 P1 fix — frontend `parseFeedback`이 feedback JSON의 optimizedCode를 우선 사용하므로 양쪽 정리 필요)

### 점수 ↔ 자가 검증 분리 정책 (Sprint 142 R4 P1 fix)

correctness 루브릭:
- ❌ "제출된 코드와 optimizedCode 모두 평가" (초안 — LLM이 잘못된 개선 코드 제안 시 사용자 점수 페널티 유발)
- ✅ "제출된 코드만 평가, optimizedCode는 자가 검증 메타로 별도 처리"

**핵심 원칙**: 점수(사용자 코드 평가) ↔ 검증(LLM 자가 검증 메타)의 책임 분리. 사용자가 LLM 실수로 페널티 받지 않도록 보장.

### SQL signature 게이트 제거 (Sprint 142 R4 P2 fix)

SQL은 시그니처 개념 부재 → SQL_SYSTEM_PROMPT의 `optimizedCodeMeta` 스키마에서 `signaturePreserved` 제거. `_is_explicit_false(None)=False`이므로 누락 시 자동 통과 → behaviorEquivalent만 효과적으로 검증.

### PROGRAMMERS + SQL 분기 (Sprint 142 R3 P2 fix)

`AddProblemModal`이 `PROGRAMMERS + sql` 조합을 지원 (실 사용 케이스). `_build_platform_context(source_platform, language)`로 시그니처 변경:
- `PROGRAMMERS + sql` → 결과 컬럼명/순서/정렬 보존 규칙
- `PROGRAMMERS + 그 외` → 함수 시그니처 보존 규칙
- `BOJ` → SQL 미지원이므로 단일 메시지

## 패턴 (재사용 가능)

### Critic 다중 라운드 반복 검증 패턴

| 라운드 | 적발 |
|--------|------|
| R1 | P2×2 (string boolean 우회 / Python API 하드코딩) |
| R2 | P1×1 (feedback JSON 잔존) |
| R3 | P2×1 (PROGRAMMERS+SQL 충돌) |
| R4 | P1×1 + P2×1 (점수/검증 결합 / SQL signature 게이트) |
| R5 | **클린 통과** ✅ |

총 5 라운드 · P0 0건 · P1 2건 · P2 4건 모두 해소.

**관찰**: 단일 라운드 검증으로는 잡기 어려운 결함 패턴 (예: feedback JSON 직렬화 후 frontend 노출, SQL/algorithm 분기 충돌, 점수 안정성 회귀)이 라운드를 거듭하며 발견됨. **반복 검증의 가치**.

### LLM 자가 검증 메타데이터 패턴

LLM 출력 신뢰도를 코드 측에서 강제할 수 없을 때:
1. JSON 스키마에 자가 검증 필드 추가 (boolean + 변경 요약)
2. 코드는 명시적 `false`만 폴백 트리거 (string boolean 우회 차단)
3. 누락/None/타입 불일치는 폴백 안 함 (하위 호환)
4. 거부된 출력은 모든 직렬화 경로에서 제거

### 점수 ↔ 자가 검증 분리 원칙

LLM 출력 채점 시스템에서:
- 점수: 사용자 산출물 평가만
- 자가 검증: LLM 자체 출력의 신뢰성 검증
- **두 책임을 한 필드에 결합하면 LLM 실수가 사용자 페널티로 전이됨**

## 교훈

### 단일 주제 단일 PR + 다중 Critic 라운드 (Sprint 142) vs 그룹 PR 분할 (Sprint 141)

- 단일 주제 (Sprint 142): 작은 변경 범위 + 깊은 검증 → 다중 Critic 라운드로 점진 개선
- 그룹 분할 (Sprint 141): 다양한 주제 + 의존성 0 → PR별 단일 라운드 검증

본 스프린트는 단일 파일(prompt.py) 중심이지만 Critic 5 라운드로 머지 부담을 분산. **변경 깊이를 검증 깊이로 보완하는 패턴**.

### Frontend 호환성 사전 점검의 중요성

머지 전 `parseFeedback` 동작 분석으로 P1(feedback JSON 잔존)을 사전 차단할 수 있었음. Critic R2에서 외부 검증으로 발견 — **변경 시 소비자 스택 전체 일괄 점검** 정책 (Sprint 141 B-2 패턴)이 frontend에도 적용되어야 함.

### "사용자 시각 검증"의 가치 (재확인)

본 스프린트는 코드/CI/Critic 검증 모두 통과했지만, **실제 프로그래머스 재제출 → 채점 통과** 검증은 사용자 환경에서만 가능. Sprint 139/140 캘린더 회귀 발견 패턴과 동일 — 자동 검증 + 사용자 시각 검증 이중화 필수.

## 검증 결과

- CI: Quality/Test AI Analysis/E2E/Coverage Gate 전부 pass (5 PR push 모두 GREEN)
- 신규 테스트 36건 추가 (test_prompt 18 + test_claude_client 18)
- 기존 테스트 100% 호환 (회귀 0건)
- Critic 5 라운드 P0/P1/P2 전부 해소
- 브랜치 규율 ✅: 신규 브랜치 + PR + Squash merge — **8 스프린트 연속 준수**

## 이월 (Sprint 143+)

### Sprint 142 신규 시드
- P2: 가중치 재조정 (correctness 30% → 40% 검토)
- P2: 문제 컨텍스트 부재 시 optimizedCode 생성 보류 가드
- P3: 토큰 절단 / 그룹 분석 잘림 가드 (`MAX_TOKENS=8192`, `code_preview[:500]`)
- 인프라 신규: ai-analysis worker → problem service `/internal/:id` cross-service 호출로 문제 정보(title/description/examples) 실제 주입
- 사용자 시각 검증: 실제 프로그래머스 재제출 → 채점 통과 확인

### Sprint 141 잔여 (4건)
- Calendar provider 의존성 방어 (그룹 C P2)
- prometheus-rules / dashboard 자동 검증 CI
- E2E full integration UX 보강 (D-3 후속)
- 사용자 시각 검증 — 영문 환경 캘린더 + production Grafana CB dashboard ai-analysis 정합

총 누적 이월 9건 → Sprint 143 정리 대상.
