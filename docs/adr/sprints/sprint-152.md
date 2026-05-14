# Sprint 152 — 블로그 [기술 챌린지] — 슬라이딩 윈도우로 agent 컨텍스트 최적화 글 작성

- **상태**: 완료 ✅
- **기간**: 2026-05-13 (단일 일자)
- **트리거**: 사용자 요청 (블로그 글 작성)
- **start_commit**: `4313561` (Sprint 151 hotfix end)
- **end_commit**: `3873f6d` (Sprint 152 영문판 end)
- **머지된 PR**: 3건 (squash merge)

## 1. 배경 / 사용자 요청

AlgoSu의 agent 협업 워크플로우에서 누적된 운영 경험 — 특히 **유지보수 관점의 문서화 필요성** + **슬라이딩 윈도우 시스템 도입을 통한 컨텍스트 최적화**를 [기술 챌린지] 카테고리 블로그 글로 정리. Sprint 145~151 누적된 회귀 0건 운영 사례를 실증으로 활용.

## 2. 결정 사항

### 2.1 글 컨셉
- **카테고리**: `challenge` (기존 3편: `toward-model-agnostic-harness` / `baekjoon-gone` / `session-policy-sync` 와 동일 카테고리, order: 10 — 직전 max=9)
- **3단 핵심 논리** (사용자 직접 제시):
  1. 기억의 휘발성 → 문서화 필수 (특히 agent 협업)
  2. 모든 문서 매 세션 참조 = "꽉 찬 물통에 물을 계속 부어 넣는 행위" (역설)
  3. 슬라이딩 윈도우 알고리즘에 착안 → 도입 (해결)
- **제목**: "기억은 휘발되고 문서는 무한히 쌓인다 — 슬라이딩 윈도우로 agent 컨텍스트를 최적화하다"

### 2.2 i18n 정책
- 기존 9편 모두 KR (`blog/content/posts/`) + EN (`blog/content/posts-en/`) 양면 보유
- 신규 글도 양면 작성 의무 — 본 스프린트에서 누락 후 사용자 지적으로 즉시 보정 (PR #235)
- 영문판 톤 일치 기준: `toward-model-agnostic-harness.mdx` (1인칭, dash 강조, **bold** 패턴)

### 2.3 본문 형식
- mdx 컴포넌트: `MetricGrid`/`MetricCard` × 2, `Callout` × 1
- mermaid × 2 (상태머신 + 4계층 저장 구조)
- ASCII 다이어그램 × 2 (컨텍스트 누적 + 슬라이딩 윈도우 원리)
- GitHub URL 7곳 본문 직접 노출 (각주 X) — ADR 디렉토리 / sprint-145·151 ADR / CLAUDE.md / `.claude/commands/agents/`

### 2.4 Plan 가정 즉시 재라우팅 (Sprint 147 교훈 직접 적용)
- 사용자 plan에 "librarian 디스패치" 명시되어 있었으나 페르소나 cross-check 결과 librarian = DB 영속성/마이그레이션 전담 (자료 수집/문서 큐레이션 외 도메인)
- Scribe 단독 처리로 즉시 재라우팅 — Scribe가 "프로젝트의 모든 기억·문서·프롬프트의 정확성과 최신성을 전담"하는 정확한 도메인
- 블로그 작업은 사용자 리뷰 사이클 빠름 → tmux dispatch 대신 Oracle이 scribe 페르소나로 직접 진행

## 3. 구현 흐름

### 3.1 PR #233 — 한국어판 신규 (`9034a66`)
**1 commit, 1 file, +297**

- `blog/content/posts/sliding-window-agent-context.mdx` 신규
- frontmatter: title / date(2026-05-13) / category(challenge) / order(10) / tags 5종(`agent`, `documentation`, `sliding-window`, `context-optimization`, `claude-code`)
- 본문 10 섹션:
  1. 152번째 스프린트, 그리고 152개의 ADR (도입)
  2. 기억의 휘발성 — 사람도 agent도 잊는다
  3. 문서화는 진짜로 효과가 있었습니다 — Sprint 145~151 회귀 차단 8 차원 누적 실증
  4. 그런데 — 문서 자체가 적이 되기 시작했어요
  5. 꽉 찬 물통 비유 — lost-in-the-middle, attention 분산
  6. 슬라이딩 윈도우 알고리즘 — 알고리즘 시간으로 돌아가다
  7. sprint-window.md 크기 2 + status idle/active 상태머신
  8. 4계층 저장 구조 — "잊는 곳"과 "기억하는 곳"의 분리
  9. 운영 결과 — 7 스프린트 회귀 0건 + Auto-Critic 한 세트 철학
  10. 잊는 법을 배우는 것이 기억하는 법이었어요 (마무리)

### 3.2 PR #234 — 사실 정정 hotfix (`9c8caa3`)
**1 commit, 1 file, +4 -4**

- 머지 직후 사용자 fact-check 지적: sprint별 ADR은 Sprint 62부터 도입됐고 현재 90개 가까이 쌓인 상태인데, 초안에 4곳 부정확 표현
- 정정 4곳:
  - H2: "152번째 스프린트, 그리고 152개의 ADR" → "차곡차곡 쌓인 ADR들"
  - 도입부: "sprint-001부터 sprint-151까지" → Sprint 62 도입 배경 + "sprint-62부터 sprint-151까지 90개 가까이"
  - 본문 중반: "ADR이 100개를 넘어가던 시점부터" → "sprint별 ADR이 40개 가까이 쌓이던 시점부터"
  - 마무리: "ADR은 152개에서 200개, 300개로" → "sprint별 ADR은 90개에서 100개, 200개로"
- 사실 근거: `git ls-tree -r main --name-only | grep "docs/adr/sprints/"` → sprint-62.md ~ sprint-148.md, **85개 tracked** (sprint-149/150/151 untracked 별도)

### 3.3 PR #235 — 영문판 추가 (`3873f6d`)
**1 commit, 1 file, +297**

- 머지 직후 사용자 i18n 누락 지적
- `blog/content/posts-en/sliding-window-agent-context.mdx` 신규
- 영문 제목: "Memory Fades, Documents Pile Up — A Sliding Window for Agent Context"
- 한국어판 PR #234 사실 정정사항 모두 동시 반영 (Sprint 62 도입 / 90개 가까이 / 40개 누적 시점 / 90~200개 전망)
- 톤 일치: `toward-model-agnostic-harness.mdx` 기준 1인칭 + dash 강조 + **bold** 패턴
- mdx 컴포넌트 / mermaid / ASCII / GitHub URL 7곳 모두 한국어판과 1:1 동일

## 4. 검증

| PR | CI | mergeStateStatus | 비고 |
|----|----|------------------|------|
| #233 | 28 SUCCESS / 0 FAIL / 11 SKIPPED | BEHIND → CLEAN | update-branch 후 merge |
| #234 | 28 SUCCESS / 0 FAIL / 11 SKIPPED | CLEAN | hotfix 즉시 통과 |
| #235 | 28 SUCCESS / 0 FAIL / 11 SKIPPED | CLEAN | 영문판 즉시 통과 |

- **i18n 검증**: KR (`blog/content/posts/`) **10편** = EN (`blog/content/posts-en/`) **10편** ✅
- **mdx 컴포넌트 실재 검증**: `MetricGrid`/`MetricCard` (`blog/src/components/blog/metric-grid.tsx`), `Callout` (`blog/src/components/blog/callout.tsx`)
- **브랜치 규율 ✅**: 3 PR 모두 신규 브랜치 + Squash merge — **18 스프린트 연속 준수** (Sprint 134 위반 이후), main 직접 commit 0건

## 5. 신규 패턴

- **Plan 가정 깨짐 즉시 재라우팅 (Sprint 147 교훈 직접 재적용)**: 사용자 plan에 "librarian 디스패치" 명시되었으나 페르소나 cross-check 결과 도메인 불일치 → 즉시 scribe 단독 처리로 재라우팅, cycle 영향 0. 5 스프린트 만에 재현된 동일 패턴
- **블로그 작업 dispatch 우회 패턴**: 코드 변경 0 + 사용자 리뷰 사이클 빠름 → tmux dispatch 대신 Oracle 직접 페르소나 채택. 단일 글 단위 (플랜→보완→작성) 사이클(feedback-blog-workflow)에 적합
- **사용자 직접 fact-check가 글의 마지막 안전망**: Auto-Critic이나 CI는 사실 정합성을 잡지 못함. 도메인 사실(ADR 시작 시점 / 누적 갯수 등)은 글 머지 직전 grep cross-check 절차가 필요 — 자동화 후보
- **i18n 누락 즉시 hotfix 패턴**: 신규 블로그 글은 KR + EN 양면 작성이 의무이나 본 스프린트에서 누락 → 사용자 지적 후 즉시 보정 PR. plan 단계 i18n 의무 명시 절차 필요 — 자동화 후보
- **단일 일자 3 PR 묶음 응답 패턴 (Sprint 150/151 hotfix 패턴 직접 계승)**: 사용자 지적 → 새 PR → CI green → Squash merge 평균 ~5분 cycle. 사실 정정 / i18n 누락 모두 별도 hotfix PR로 빠르게 응답 (대기/연기 X)

## 6. 교훈

- **Plan의 에이전트 매핑은 도메인 cross-check 필수 (Sprint 147 교훈 재확인)**: librarian = DB 영속성, scribe = 문서 — 페르소나 파일(`.claude/commands/agents/{name}.md`)의 `## 역할 & 핵심 책임` + `## 금지 사항` 확인 의무. plan 작성 시 도메인 검증 누락 시 cycle 영향
- **사용자 직접 fact-check는 자동화로 대체 불가능한 마지막 안전망**: CI/Critic은 코드 정합성 검증 도구이지 도메인 사실 검증 도구 아님. 블로그 글의 도메인 사실(스프린트 번호/ADR 도입 시점/누적 갯수 등)은 grep cross-check를 plan 단계 체크리스트에 명시화 필요
- **i18n 누락은 신규 콘텐츠 작성 시 가장 빈번한 부채**: 양면 보유 정책이 명시되어 있으나 plan 단계에서 누락되기 쉬움. plan 템플릿에 "EN 영문판" 작업 항목 기본 포함 필요
- **머지 직후 지적 → 즉시 hotfix가 표준 (Sprint 150/151 검증 → Sprint 152 재확인)**: 사실 정정/i18n 누락/Trivy CVE 모두 별개 hotfix PR로 빠르게 응답하는 패턴이 표준. 대기/연기는 부채 누적 위험. 단일 일자 3 PR도 cycle 영향 작음
- **블로그 작업 단일 글 단위 (플랜→보완→작성) 사이클 검증**: feedback-blog-workflow 정책 정확히 적용. 글 하나 = 단일 스프린트, 플랜 단계 사용자 합의 → scribe 작성 → 사용자 리뷰 → 머지 흐름이 잘 작동. tmux dispatch 없이 인라인으로 충분

## 7. Sprint 153 이월 시드

### UAT 사용자 직접 (Oracle 작업 외)
- 시드 #5: 프로그래머스 재제출 채점 통과 확인 (9 스프린트 누적 — Sprint 145~152)
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합 (9 스프린트 누적)

### 자동화 후보 (Sprint 152 신규 시드 2건)
- 시드 #18: 블로그 글 머지 전 도메인 사실 cross-check 자동화 (예: ADR 누적 갯수 / 스프린트 번호 / GitHub URL 유효성). plan 템플릿에 명시화 + 가능하면 lint 룰
- 시드 #19: 신규 블로그 글 작성 시 KR/EN 양면 동시 작성 plan 의무 — plan 템플릿 갱신 + CI 룰("posts/X.mdx 추가 시 posts-en/X.mdx 의무" 매칭)

### 후속 (Sprint 151 그대로 + 본 스프린트 신규 0건)
- create/edit page.tsx category UI 추가 (palette 평가: 사용자 시나리오 빈도 낮음)
- Programmers URL 자동 카테고리 추론 (sourceUrl 패턴 매칭)
- 기존 SQL 문제 데이터 백필 (수동 ADMIN 또는 import 스크립트)
- Sprint 150 후보 미해소 3건 (`.claude-tools/` 정리 / CI paths filter 우회 부채 점검 자동화 / prom-client default metric stale 점검)

## 8. 산출물 링크

- **블로그 글 (KR)**: `blog/content/posts/sliding-window-agent-context.mdx`
- **블로그 글 (EN)**: `blog/content/posts-en/sliding-window-agent-context.mdx`
- **PR #233**: <https://github.com/tpals0409/AlgoSu/pull/233> (한국어판 신규)
- **PR #234**: <https://github.com/tpals0409/AlgoSu/pull/234> (사실 정정 hotfix)
- **PR #235**: <https://github.com/tpals0409/AlgoSu/pull/235> (영문판 추가)
