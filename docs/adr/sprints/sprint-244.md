---
sprint: 244
title: "모델 선택 전략 블로그 글 작성 (KR+EN) + Critic 모델 귀속 정정"
date: "2026-06-10"
status: completed
agents: [Oracle, Scribe, Critic]
related_adrs: ["sprint-238", "sprint-241", "sprint-242", "sprint-237"]
related_memory: ["sprint-window", "project-model-selection-strategy", "feedback-blog-workflow"]
topics: ["blog", "ai-agent", "model-selection"]
tldr: "사용자 회고를 채택해 블로그 글 「어떤 모델을, 언제, 어디에 — 프리미엄 모델 타깃 투입 전략」 KR+EN 집필(model-selection-strategy.mdx, order 11, category ai-agent, relatedAdrs sprint-238/241/242). 논지: Fable 5(mythos) 출시 당일 전환 후 S238 보안 감사+ADR-030 5스프린트 로드맵(S239~243)을 돌렸고 결과는 좋았으나 토큰 부족을 겪음 → '일상은 Opus/Sonnet, 주기적 대형 리팩토링은 프리미엄 모델 타깃 투입 = 기술부채 원금 상환'. toward-model-agnostic-harness(order 9)의 후속. scribe 자체리뷰 P1 3건 자체 교정(세션한도 S241→S243·머지게이트 라운드 귀속·S239 events API vs DLQ) + Critic(Codex gpt-5.5) CLEAN. 검증 crosscheck --strict 0·SSG 423페이지·CI 38 pass/0 fail·post-merge green, PR #435 squash 32f24fa. 머지 후 사용자 적발: L48이 Fable 5의 토큰 소모를 Codex 기반 Critic에 잘못 귀속 → '모델이 한 번에 안고 추론하는 컨텍스트'로 정정(KR+EN), PR #436 squash c1d70cc. 교훈: 모델 귀속 오류는 도메인 지식 기반 검증 필요 — scribe·Codex Critic 모두 미탐."
---
# Sprint 244 — 모델 선택 전략 블로그 글 작성 (KR+EN) + Critic 모델 귀속 정정

## 목표

- 이월 블로그 소재 대신, **사용자의 실시간 회고를 채택**해 "모델 선택 전략" 블로그 글을 KR+EN으로 집필한다.
- 논지: Fable 5(mythos 기반) 출시 당일 전환 후 S238~243 전체를 Fable 5로 진행한 실험에서, 결과는 좋았으나 토큰 부족을 겪음 → "일상 스프린트는 Opus/Sonnet, 중·장기적으로 주기적 대형 리팩토링은 최고 성능 프리미엄 모델을 타깃 투입하는 것이 장기 유지보수 비용에 유리"(기술부채 원금 상환).
- Sprint 237 확립 블로그 패턴(어투 레지스터 정합 + crosscheck --strict + blog Critic) 적용.

## 배경

- /start 단계에서 이월 소재 3건(CS 퀴즈 S215~229 / 만들었다가 지운 것들 S185~189·193·201 / zstd) 중 선택 예정이었으나, 사용자가 플랜 중단 후 **Fable 5 사용 경험 회고를 직접 공유**: "오늘 새로 나온 Fable 5(mythos 기반)로 보안·리팩토링을 진행했는데 결과는 좋았지만 토큰 부족에 시달렸다. 당분간 Opus/Sonnet을 쓰겠지만, 중·장기적으로 한 번씩 최고 성능 모델로 크게 리팩토링하는 게 장기 유지보수 비용에는 더 좋지 않을까."
- 이 회고가 그 자체로 강력한 블로그 소재로 판단됨 — 시의성(Fable 5 출시 당일), 실제 ADR 근거(S238~243 전부 Fable 5 실험), 기존 포스트 toward-model-agnostic-harness(order 9)와의 연속성.
- AskUserQuestion으로 방향 확인 → "모델 전략 회고로 교체" 확정. 이월 소재 "만들었다가 지운 것들"은 다음 스프린트로 연기.

## 결정

### D1. 소재 교체 — 모델 선택 전략 회고 (사용자)
- 이월 소재 대신 사용자 회고를 채택. 근거: ADR 근거 단단함(S238 "fable 모델로 변경했습니다" 전환 기록 실재) + 시의성.

### D2. category·메타 — ai-agent / order 11 / relatedAdrs 3건
- category `ai-agent` (toward-model-agnostic-harness와 동일 분류, 모델/에이전트 주제).
- order 11 (직전 최대 10=sliding-window). relatedAdrs ["sprint-238","sprint-241","sprint-242"] — 각각 Fable 전환+감사, BE 분해, FE 분해.

### D3. 전략 통찰 메모리 SSOT 분리
- 모델 운용 전략은 블로그 글과 별개로 `memory/project-model-selection-strategy.md`에 SSOT 기록(Oracle 직접). 향후 재참조 자산.

### D4. (머지 후) Critic 모델 귀속 정정 — Critic은 Codex (사용자 적발)
- 머지 후 사용자가 본문 L48 "Critic이 한 번에 보는 컨텍스트"가 Fable 5의 토큰 소모를 **Codex 기반 Critic에 잘못 귀속**함을 적발. CLAUDE.md: Critic은 Codex(gpt-5) 기반 2차 리뷰로 Fable 5와 별개 모델. 세션 한도에 닿은 주체는 Fable 5로 동작한 메인 에이전트(Gatekeeper).
- 정정: "모델이 한 번에 안고 추론하는 컨텍스트"(KR) / "the model holds a wider context in a single pass"(EN)로 교체. 나머지 Critic 언급 4건(L66 redis.keys 발견·L71 누적 라운드·L121/125 하네스 좌석)은 모두 정확(Codex Critic 실제 역할) — 변경 없음.

## 구현

### 1차 집필 (Scribe, PR #435 squash → `32f24fa`)
- 신규: `blog/content/posts/model-selection-strategy.mdx`(KR, 11.3K) + `blog/content/posts-en/model-selection-strategy.mdx`(EN, 10.3K), 2 files +258.
- 제목 「어떤 모델을, 언제, 어디에 — 프리미엄 모델 타깃 투입 전략」. 서사: 도입(S243 세션 한도 장면) → ADR-030 감사(High Risk 0·Medium 3·Low 5·개선 7) → 5스프린트 로드맵 PhaseTimeline → "회귀는 추출 경계에 모인다"(S241/242) → ROI 조건 3가지 → 균형 단서(전면 리팩토링 수익체감·비용 실재) → toward-model-agnostic-harness 연결.
- MDX 컴포넌트: PhaseTimeline/PhaseMilestone, MetricGrid/MetricCard, Callout×2, Problem/Decision/Result.
- **Scribe 자체리뷰 P1 3건 자체 교정**: ① 세션 한도 incident S241→S243 ② 머지게이트 라운드 귀속(번역키=auto-critic·setError=R1·파생상태=R2·R3 CLEAN) ③ S239 타임라인 DLQ→이벤트 API DTO.

### 2차 정정 (Oracle 직접, PR #436 squash → `c1d70cc`)
- D4 모델 귀속 정정 2줄(KR+EN L48). 2줄 정밀 교정이라 Oracle 단순 파일 수정으로 직접 처리(블로그의 "단순 작업은 저렴한 경로" 논지를 실행으로 재현).

## 검증

- **1차(#435)**: crosscheck --strict 위반 0 · blog SSG build EXIT=0(양 라우트 생성) · doc-refs 463 no broken · Critic(Codex gpt-5.5 --base 4c8693e) **CLEAN**(사실 정합 전수 대조·KR↔EN 1:1·어투 정합) · CI 38 pass/0 fail · post-merge main run success.
- **2차(#436)**: crosscheck --strict 0 · SSG 423페이지 성공 · CI fail 0 · post-merge green.
- Oracle 직접 메모리 대조: 핵심 사실 전수 정합(세션한도 S243·Fable 전환 S238·ADR-030 수치·S241/242 분해 규모·누적 라운드 BE 7+FE 8=15).

## 교훈

1. **모델 귀속 오류는 도메인 지식 기반 검증이 필요하다.** L48 "Critic이 깊은 컨텍스트를 본다"는 서술은 수치(누적 라운드 15)는 정확했지만 *모델 정체성*(Critic=Codex≠Fable 5)과 모순됐다. scribe 자체리뷰도, Codex Critic도 못 잡았다 — 둘 다 수치·구조·어투는 검증했으나 "어느 모델이 무엇인가"라는 도메인 사실은 사용자만 적발. 사실 정합 게이트에 **모델/에이전트 귀속 점검**을 추가 고려.
2. **사용자 실시간 회고는 1급 블로그 소재다.** 계획된 이월 소재보다 시의성·ADR 근거가 강했다. 플랜 중단 신호는 방향 전환 기회.
3. **scribe 자체리뷰의 사실 교정 가치 입증.** 자체 P1 3건(세션한도·라운드 귀속·events API)을 메모리 대조로 스스로 잡음 — Codex Critic 도달 전에 정확도를 끌어올림.
4. **이번 작업이 글의 논지를 실증했다.** 일상 작업(블로그 집필)은 Sonnet 기반 scribe로 충분, 사실 정합 같은 깊은 검증은 Codex Critic이 교차로 처리 — 정확히 "타깃 투입" 구조. 2줄 정정은 Oracle 직접(가장 저렴한 경로).

## 이월

- 블로그 소재 "만들었다가 지운 것들"(S185~189 ADR 그래프·검색 구축 → S193 그래프 삭제·S201 검색 삭제 회고) → 다음 스프린트.
- 사실 정합 게이트에 모델/에이전트 귀속 점검 추가 검토.
- 기존 잔여: (하네스 슬롯) pane 가드 항구화+윈도우 장식 근본 해소(--full FAIL 1)+Codex 모델 핀+상태 오기록 3연속 · `Quality — docs` required 승격 · 동기 로그 싱글톤 context·i18n·ConfirmStep tErrors·인라인 style(S242 이월) · Q-4 libs/ 스파이크(백로그) · CI 헬퍼 단위 테스트 정책 · (사용자 콘솔) GA4 3건·라이브 SEO 재배포·하네스 cron·webhook regenerate·누적 UAT.
