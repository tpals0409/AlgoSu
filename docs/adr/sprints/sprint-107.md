---
sprint: 107
title: "CI 리팩토링 블로그 — 채널톡 레퍼런스 적용기 단일 종합 글"
period: "2026-04-21"
status: complete
start_commit: bbaf974
end_commit: a3ab0b4
---

# Sprint 107 — CI 리팩토링 블로그: 채널톡 레퍼런스 적용기

## 배경

Sprint 102~106은 채널톡 Backend CI Refactoring 글([https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d](https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d))을 레퍼런스 삼아 AlgoSu의 CI 파이프라인을 5스프린트에 걸쳐 리팩토링했다. 결정·수치·교훈은 `docs/adr/sprints/sprint-102.md ~ sprint-106.md`와 `memory/project-ci-refactoring-roadmap.md`에 남아있지만, 독자 관점의 서사로는 흩어진 상태였다.

Sprint 107은 이 5스프린트 여정을 **단일 종합 블로그 포스트**로 정리한다. 차별점은 "레퍼런스를 그대로 번역하지 않고, 1인 개발자 + AI 에이전트 오케스트레이션 맥락에 맞게 번역한 과정"을 중심 서사로 둔다는 점이다.

## 목표

| 항목 | 내용 | 상태 |
|------|------|------|
| 단일 종합 글 작성 | 채널톡 레퍼런스 적용기 프레임, 500~700줄 | ✅ 완료 (501줄) |
| 팩트 검증 | Sprint 102~106 ADR 수치 직접 대조 | ✅ 완료 (13 항목 일치) |
| 블로그 빌드 검증 | `blog/ npm run build` SSG 20/20 | ✅ 완료 |
| 배포 (main 머지) | PR squash merge | ✅ 완료 (#128, #129) |

---

## 결정 사항

### D1. 구성: 단일 종합 글 (시리즈 아님)

**결정**: 4~5편 시리즈가 아닌 단일 글 1편으로 구성.

**근거**:
- 레퍼런스인 채널톡 글 자체가 단일 포스트 형식
- 5스프린트 전체를 관통하는 중심 메시지("레퍼런스 → 맥락 번역 → 구현 0줄 결론")가 시리즈로 나누면 약화됨
- 사용자 블로그 워크플로 피드백: "글 하나 단위 사이클(플랜→보완→작성)" — 단일 글이 자연스러움

**대안 보류**: 시리즈 확장은 Sprint 108+ 이월 후보로 유지하되 강제 아님.

### D2. 프레임: "레퍼런스 적용기"

**결정**: "원리 차용 + 맥락 번역" 프레임으로 서사 전개.

**근거**:
- 기존 블로그 포스트 중 `cicd-ai-guardrails.mdx`가 CI 주제 다룸 → 중복 방지를 위해 각도 차별화 필요
- 채널톡 글을 단순 번역/요약하는 게 아니라, 채용/차용하지 않음을 명시하는 비교 관점이 독자 가치 제공
- 1인 개발 + AI 에이전트 구조라는 AlgoSu 고유 맥락을 부각

### D3. 에이전트 배정 보정 — Scribe 단독

**결정**: 플랜 원안의 Librarian/Herald 배정을 Scribe 단독으로 단순화.

**근거**:
- **Librarian**: 역할은 DB 스키마/TypeORM Migration 관리 — 블로그 팩트 검증 부적합
- **Herald**: 역할은 Frontend UI 구현 — 커밋/PR 역할은 Oracle/PM 영역
- **Scribe**: 문서·메모리·프롬프트 전담 → 팩트 검증(ADR 직접 Read) + MDX 초안 작성 병행 가능

**교훈**: 에이전트 본업 매칭은 플랜 승인 단계와 별개로 디스패치 직전 Oracle이 재검증해야 함. Sprint 102 "CI는 Gatekeeper 담당 → Architect 재조정" 교훈의 연장선.

### D4. 제목 간결화

**결정**: 초안 제목 "채널톡 CI 글을 보고, 5스프린트 리팩토링을 직접 해봤다" → **"AlgoSu CI 리팩토링"**.

**근거**: 사용자 피드백. 담백하고 짧은 형태. 레퍼런스 언급은 본문 도입부에서 충분히 수행되므로 제목에서 중복 제거.

### D5. "우리" → "AlgoSu" 톤 통일

**결정**: 1인 개발 맥락에 맞지 않는 복수 주체 표현 "우리"(4곳)를 모두 "AlgoSu"로 교체.

**근거**: AlgoSu는 1인 개발자 + AI 에이전트 구조이므로 "우리"는 주체가 모호. 고유명사 주체로 통일.

---

## 산출물

- **신규 파일**: `blog/content/posts/ci-refactoring-reference-to-reality.mdx` (501줄)
  - frontmatter: title="AlgoSu CI 리팩토링", category=journey, order=8, tags=["ci-cd", "github-actions", "ai-dev", "refactoring"]
  - 9 섹션: 도입 → 레퍼런스 이유 → 4스프린트 로드맵 → S102 → S103-104 → S105 → S106 → 4 원칙 → 끝나지 않은 이야기
  - MDX 컴포넌트: `<PhaseTimeline>`, `<PhaseMilestone>`, `<Callout>`(info/warn/success), `<MetricGrid>`, `<MetricCard>`
  - 코드 블록 6개: dependabot.yml, auto-merge workflow YAML, Branch Protection, Composite action YAML, check-coverage.mjs, commitlint + husky setup
  - 채널톡 URL 인용 2회
- **PR #128** (`599a71f`): 신규 501줄 생성
- **PR #129** (`a3ab0b4`): 제목 간결화 (1줄 수정)
- **검증**: `blog/ npm run build` SSG 20/20 성공, `/posts/ci-refactoring-reference-to-reality` 경로 정상 렌더

## 팩트 검증 결과 (Scribe 대조, 13 항목)

| 항목 | ADR 출처 | 반영값 |
|------|---------|-------|
| Dependabot 대기 PR | sprint-102 | 30건 → 2건 |
| PR #102 SHA | sprint-102 | `46aeb73` |
| Composite 삭제 줄 수 | sprint-104 | 67줄 |
| Post 런 번호 3개 | sprint-105 | `24702740418` · `24702828670` · `24703075569` |
| Quality Pre→Post | sprint-105 | +0.4% (+0.1s) |
| Audit Pre→Post | sprint-105 | -8.9% (-1.8s) |
| Test Pre→Post | sprint-105 | +3.9% (+0.8s) |
| runner-minutes 절감 | sprint-105 | 75% |
| Frontend branches Before | sprint-106 | 69.55% (1302/1872) |
| Frontend branches After | sprint-106 | 76.42% |
| 신규 테스트 수 | sprint-106 | 77개 |
| PR #121·#122 | sprint-106 | 일치 |
| 채널톡 URL | plan + 전 ADR | 정확 |

전 13 항목 `✅` 일치.

---

## 교훈

### 1. 블로그 워크플로 피드백의 실효성

"글 하나 단위 사이클(플랜→보완→작성)" 피드백이 Sprint 107 전체 흐름을 지배했다. 플랜 단계에서 단일 글/시리즈 선택을 사용자와 합의 → 초안 후 "우리→AlgoSu" 톤 조정 1회 → 제목 간결화 1회의 보완 사이클. 일괄 실행이었으면 둘 다 작성 후 교정이 되어 재작업 비용이 컸을 것.

### 2. 에이전트 본업 매칭의 재검증 타이밍

플랜에서 Librarian/Herald를 배정했지만 디스패치 직전 Oracle이 에이전트 스펙을 재검증하고 Scribe 단독으로 보정했다. 플랜 승인 시점과 디스패치 시점 사이에 "본업 매칭 재확인" 단계가 필요함을 재확인. Sprint 102의 동일 교훈이 운영 규칙으로 정착.

### 3. ADR 수치 직접 대조의 중요성

블로그는 외부 공개물이므로 팩트 오류가 신뢰를 훼손한다. Scribe가 ADR 5개를 직접 Read하고 13 항목 대조표를 결과 리포트에 포함한 방식이 사후 검증 부담을 크게 줄였다. "에이전트 자체 대조표" 패턴을 블로그/공개 문서 작업의 표준으로 승격 고려.

### 4. MDX 컴포넌트 재사용으로 톤 일관성 확보

기존 `cicd-ai-guardrails.mdx`의 `<PhaseTimeline>`, `<Callout>`, `<MetricGrid>` 사용 패턴을 그대로 차용하여 블로그 전체 톤 일관성 유지. 신규 컴포넌트 생성 없이 재사용만으로 충분했다.

### 5. 커밋 금지 제약의 효용

"초안 작성 후 커밋 금지, 사용자 리뷰 대기" 제약이 블로그 워크플로 피드백과 정확히 맞물렸다. Scribe 결과 리포트가 inbox에 올라온 시점에 사용자 보완(톤 조정 → 제목)이 개입해 2번의 별도 PR로 자연스럽게 분리됐다.

---

## 이월 항목 (Sprint 108+)

### Sprint 106에서 승계된 이월 (변화 없음)

- **Sprint 108 핵심 의사결정 후보**: Blog/Frontend host-side 빌드 전환 (진정한 L2 달성 경로, 40~60% 단축 기대)
- APK_CACHE_BUST 조건화, NestJS tsc incremental, Monaco dynamic import, heavy deps audit
- ai-analysis `branch=true`, submission/problem/identity lcov 실측 수집
- `check-coverage.mjs` 서비스별 독립 게이트

### Sprint 107에서 신규 이월

- **시리즈 확장 후보**: 현재 단일 종합 글 1편. 특정 주제(선자문 패턴, Composite Action, Coverage Gate 등)의 심화편 작성은 강제하지 않으나 Sprint 108+ 옵션으로 유지.
- **블로그 포스트 메타데이터 정책**: `order` 필드가 수동 관리 중 (최대값 +1 방식). 포스트 증가 시 자동 할당 또는 date 기반 정렬로 전환 검토 여지.

---

## 관련 문서

- `blog/content/posts/ci-refactoring-reference-to-reality.mdx` — 산출물
- `blog/content/posts/cicd-ai-guardrails.mdx` — 톤·컴포넌트 레퍼런스
- `docs/adr/sprints/sprint-102.md ~ sprint-106.md` — 팩트 소스
- `memory/project-ci-refactoring-roadmap.md` — 전체 로드맵
- `/Users/leokim/.claude/plans/drifting-wishing-thacker.md` — 승인된 플랜
- 외부: [채널톡 Backend CI Refactoring](https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d)
