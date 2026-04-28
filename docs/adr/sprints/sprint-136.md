---
sprint: 136
title: "Critic 도입 회고 블로그 포스트 — 종속 없는 하네스를 향해"
date: "2026-04-27"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["ADR-026"]
---

# Sprint 136: Critic 도입 회고 블로그 포스트 작성

## Sprint Goal

Sprint 114 Critic(Codex gpt-5 기반 교차 코드 리뷰) 도입 ~ Sprint 135 17 라운드 검증 경험을 회고 블로그 포스트로 정리한다. 기술 디테일이 아닌 **"왜 그렇게 했는지"** 중심으로 — 추가 결단(전면 교체 아닌)·머지 직전 자리 선정·다른 시선의 가치·Critic의 한계·하네스 자체의 편향·종속성 메타 학습·하네스 추상화 비전을 한 글로 묶는다.

## 최종 결과 요약

| 항목 | 결과 |
|------|------|
| **머지된 PR** | 1건 (#173) |
| **변경** | 2 files +196 insertions (KR/EN mdx) |
| **블로그 글 신설** | `toward-model-agnostic-harness.mdx` (KR + EN) |
| **MDX 컴포넌트** | 2종 미니멀 적용 (`<MetricGrid>` + `<Callout>`) |
| **Critic 호출** | 미호출 (정책 일관성 — mdx 콘텐츠 변경) |
| **카테고리 / Order** | challenge / 9 |
| **CI** | 모든 체크 SUCCESS, mergeStateStatus CLEAN |

## Decisions

### D1: 글 무게중심 — "왜" 중심 (기술 디테일 제거)

- **Context**: v1 초안에 codex CLI 명령(`/codex:*` 슬래시 미파싱, 0.122.0 파서 변경), opossum v8 디테일, `@Global()`/WeakSet 코드 디테일 다수 포함
- **사용자 피드백**: "기술적인 관점보다는 왜 그렇게 했는지 중심의 글"
- **Choice**: 기술 디테일 대부분 삭제 또는 추상화. 살린 디테일은 17 라운드 / P1 8 / P2 9 / Sprint 번호(114/134/135) 정도
- **결과**: 글의 깊이를 "결단의 동기"와 "학습된 통찰"로 옮김 — v2 회고록 톤 확정

### D2: Thesis — 모델 종속 메타 학습

- **Context**: 사용자 인사이트 — "지금 세팅된 하네스는 클로드 편향적이다. 진정한 서비스가 다른 서비스에 종속되어 있는 것은 좋지 않다(백준이 사라졌다 — 에서 배움)"
- **Choice**: thesis = "백준이 사라진 경험에서 배운 종속성의 비용. 이번엔 AI 모델에서 같은 패턴이 반복됐다. Critic 도입은 첫 발이고, 진짜 답은 하네스 자체를 모델·환경 종속에서 해방시키는 것."
- **결과**: 글이 단순 "Codex 도입기"가 아니라 "종속성에서 해방되는 시스템 설계 회고"로 격상. 본문에 자기 블로그 [백준이 사라졌다](/posts/baekjoon-gone) 회귀 인용 구조 적용

### D3: 오프닝 = 워크플로우 위반 자가 고백 (a + b + D)

- **Context**: 글의 trigger를 "Claude 성능 저하 체감"으로 시작할 때 막연함. 구체적 일화 필요
- **사용자 일화**: "워크플로우를 무시하는 빈도 늘었어"
- **Choice**: a (Sprint 134 ADR follow-up main 직접 push 자가 고백) + b (Sprint 133/134 셸 글로빙 같은 실수 두 번) + D (Codex 외부 자극)
- **결과**: 메인 a + 보강 b + 외부 자극 D 3단 합류 구조 — 결단 동기를 자연스럽게 연결

### D4: 결말 = 두 층 비전 (스왑 스위치 → 하네스 추상화)

- **Context**: 사용자 인사이트 — "에이전트의 역할은 그대로 하되 모델만 변경하는 스위치 구조 + 모델에 종속적이지 않은 하네스를 구축하고 가장 생산성 좋은 모델을 즉시 도입할 수 있는 구조"
- **Choice**: 결말 = (1) 에이전트 모델 스왑 스위치 + (2) 하네스 자체를 모델·환경 종속에서 해방
- **결과**: 결말이 단순 마무리가 아니라 "Critic 도입은 시작점, 진짜 목적지는 종속성으로부터의 해방"이라는 비전 제시

### D5: 제목 = "종속 없는 하네스를 향해 — Critic 도입기"

- **Context**: 후보 5개 중 비전 강조형(5번 패턴) 선택, 사용자 직접 결정
- **Choice**: 메인 = 비전("종속 없는 하네스를 향해"), 부제 = 도입기 라벨("Critic 도입기")
- **결과**: 글 결말과 정확히 호응 (제목 = 비전 → 본문 = 도입기 → 결말 = 비전 회귀)

### D6: MDX 컴포넌트 미니멀 적용 (2종만)

- **Context**: 회고형 글에서 시각 박스가 많을수록 흐름이 깨지는 패턴. sprint-journey.mdx도 264 → 105줄 압축 시 컴포넌트 의도적 삭제 사례
- **Choice**: 2종만 적용 — `<MetricGrid cols={3}>` × 5 `<MetricCard>` (17 라운드 분포) + `<Callout type="info">` (백준 회상 박스)
- **제외**: `<PhaseTimeline>`, `<DecisionBridge>`, `<HierarchyTree>`, `<Callout type="quote">` 등
- **결과**: 산문 흐름 유지하면서 핵심 두 자리만 시각 강조

### D7: Critic 미호출 (정책 일관성)

- **Context**: PR #173 변경 = 2 mdx 파일. Critic 정의(`.claude/commands/agents/critic.md`)의 검토 항목(보안·동시성·데이터 무결성·롤백 가능성)에 해당 사항 없음
- **사용자 판단**: "이건 기술블로그이고 코드 관련 내용은 없는데, critic가 개입하는건 아니라고 생각해"
- **Choice**: Critic 미호출 + PR body에 미호출 사유 명시 (`merge-gate` 프리셋 Scope 정책 일관성)
- **결과**: 글 본문이 Critic의 적용 범위를 직접 정의하므로, **Critic 미호출 자체가 글의 자가 일관성**으로 작동

## Patterns / Lessons

### P1: 사용자 단계별 합의 사이클 (글 1편 단위 정책 준수)

- 결정 순서대로 1개씩 합의: thesis → 오프닝 카테고리 → 구체적 사례 → 결말 비전 → 제목 → excerpt → MDX 적용 → 작성 → push → PR → 머지
- 사용자가 매번 답변하면서 새 인사이트(모델 스위치 → 하네스 추상화 → 백준 회상 종속성 메타)를 던지면, 그것을 글의 비전·thesis로 흡수
- v1 초안 → v2 ("왜" 중심) → v3 (MDX 적용) 진화
- `feedback-blog-workflow.md` 정책(글 1편 단위 사이클, 일괄 실행 금지) 완전 준수

### P2: 자기 블로그 회귀 인용 구조

- 본문에서 [백준이 사라졌다](/posts/baekjoon-gone) 자기 블로그 링크 (Sprint 95~97 BOJ→프로그래머스 이전 회고)
- 종속성의 비용을 한 번 겪었던 경험을 **모델 레이어에서 다시 적용**한다는 메타 학습
- 블로그 자체가 한 사람의 사고 궤적으로 읽히는 구조 강화

### P3: Critic 미호출의 정책 일관성 가치

- mdx 콘텐츠 PR에 Critic 호출은 명목적이며 토큰 비용만 발생
- "글 본문에서 Critic의 적용 범위(코드 정확성·동시성·롤백)를 정의하고, 본 PR 변경(mdx)은 그 범위 외"라는 메타 일관성
- PR body에 미호출 사유를 명시 → 자가 일관성 시그널

### P4: 워크플로우 위반 자가 고백을 통한 신뢰 회복

- Sprint 134 main 직접 push 위반(`a528a66`)을 본문 오프닝에서 직접 인용 (자가 메모리 기록까지 포함)
- 셸 글로빙 같은 실수 두 번(Sprint 133·134)을 보강으로 추가 → 단발 사고가 아닌 패턴임을 입증
- 자가 고백은 Critic 도입 결단의 정당화로 자연스럽게 연결

## 산출물

- 블로그 글 (KR): `blog/content/posts/toward-model-agnostic-harness.mdx`
- 블로그 글 (EN): `blog/content/posts-en/toward-model-agnostic-harness.mdx`
- ADR: 본 문서 (`docs/adr/sprints/sprint-136.md`)

## 머지 정보

- PR: [#173](https://github.com/tpals0409/AlgoSu/pull/173) — MERGED 2026-04-27 05:52:07Z
- Squash commit: `f580ce8`
- start_commit: `180efa5` (Sprint 135 종료 시점)
- end_commit: `f580ce8` (origin/main, 2026-04-27)
- 브랜치: `feat/sprint-136-critic-blog-post` (자동 삭제)

## Sprint 137+ 이월

Sprint 135에서 넘겨받은 시드 4건은 Sprint 137+로 그대로 유지:

- github-worker errorFilter wrapper + WeakSet 동기화 (Wave A 일관성 회복)
- ai-analysis Python CB schema 통일 (state 0/0.5/1 → 0/1/2 + name label)
- CLAUDE.md "ai-feedback" → 실제 "ai-analysis" 명명 정정
- E2E 자동 PR CI 통합 (Sprint 134 이월 유지)
