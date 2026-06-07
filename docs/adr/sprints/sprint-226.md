---
sprint: 226
title: "라이브 /quiz 검증 런북 작성 (UI 221·a11y 222/223·UX 224)"
date: "2026-06-07"
status: completed
agents: [Oracle, Librarian, Critic]
related_adrs: ["sprint-221", "sprint-222", "sprint-223", "sprint-224", "sprint-220"]
related_memory: ["sprint-window"]
topics: ["quiz", "frontend", "accessibility", "docs", "runbook"]
tldr: "Sprint 221~224로 코드측 완성된 CS 퀴즈(/quiz)의 UI 개편(221)·접근성(222/223)·UX 심화(224)는 merge≠라이브(빌드 자동/롤아웃 수동 ops)라 라이브 육안·스크린리더 검증이 매 스프린트 이월돼 왔다. 라이브 /quiz는 미들웨어상 로그인 필수(PUBLIC_PATHS 제외)이고 롤아웃도 수동이라 에이전트 자율 라이브 구동이 불가하므로, 검증을 1회성 수동 작업이 아니라 repo 영속 절차서로 산출했다. 신규 런북 docs/runbook/quiz-ui-verification.md를 작성 — §0 전제조건(로그인 필수·merge≠라이브·검증 매트릭스) / §1 UI(분야 5색+아이콘·난이도 semantic·3화면 애니메이션·피드백 톤·Trophy) / §2 a11y(단계 전환 포커스·progressbar 시맨틱·sr-only 라이브 공지) / §3 UX(PillRadioGroup 키보드 네비·통계 막대·전환 모션·reduced-motion) / §4 i18n(ko↔en) / §5 결과 기록 템플릿. 모든 항목에 파일:라인 출처를 붙여 검증자가 라이브에서 무엇을 확인할지 도출 가능. 코드 변경 0(순수 docs). Critic 교차 리뷰로 출처 정확성 확인."
---
# Sprint 226 — 라이브 /quiz 검증 런북 작성

## 목표

- Sprint 221~224로 **코드측 완성·검증**된 CS 퀴즈(`/quiz`)의 UI 개편(221)·접근성(222/223)·UX 심화(224)를 라이브에서 사람이 검증할 수 있는 **사실 기반 절차서**를 산출한다.
- 매 스프린트 이월돼 온 "재배포 후 라이브 /quiz 검증"을 1회성 수동 작업이 아니라 **repo 영속 런북**으로 고정해 향후 quiz UI 변경마다 재사용 가능하게 한다.
- 순수 docs — 서비스/프론트 코드 무변경.

## 배경

Sprint 221~224는 quiz `/quiz`를 다음과 같이 개선·머지했다:

- **221**: 분야별 accent 색 토큰(`--quiz-cat-*`) + lucide 아이콘 도입, 3화면 재설계
- **222/223**: 단계 전환 포커스 관리, progressbar 접근 이름/`aria-valuenow`(223에서 공통 래퍼 전역 정석화), 결과 신기록 sr-only 라이브 공지
- **224**: PillRadioGroup radiogroup 키보드 네비, "내 기록" 분야별 통계 막대, 전환 모션

그러나 이 프로젝트의 배포 모델은 **merge ≠ 라이브**다(이미지 빌드는 머지 시 자동, 롤아웃은 수동 ops). 그 결과 "재배포 후 라이브 육안·스크린리더 검증"이 221→222→223→224 내내 이월 항목으로만 누적됐다.

검증을 막는 두 제약:

1. **라이브 `/quiz`는 로그인 필수** — `frontend/src/middleware.ts`의 `PUBLIC_PATHS`(26~34행)에 `/quiz`가 없어 미인증 시 `/login`으로 307 리다이렉트. 에이전트는 비밀번호 입력이 금지(안전 규칙)라 자율 로그인 불가.
2. **롤아웃은 수동 ops** — 에이전트가 재배포 불가.

따라서 에이전트가 라이브를 직접 구동해 검증하는 것은 불가능하고, **사람(사용자/운영)이 라이브에서 실행할 정확한 절차서**가 가장 현실적이고 repo에 영속하는 산출물이다. 기존 `docs/runbook/sp217-quiz-records-cutover.md`는 기록 컷오버 + 기능 E2E 6항목만 다루고 221~224의 **시각·접근성·UX 검증은 미커버** — 이 갭을 메운다.

## 결정

### D1. 라이브 검증을 repo 영속 런북으로 산출

`docs/runbook/quiz-ui-verification.md`를 신규 작성한다. 구조:

- **§0 전제조건**: `/quiz` 로그인 필수(미들웨어 근거 + curl 307 예시), merge≠라이브, 검증 매트릭스(테마 라이트/다크 · 로케일 ko/en · 입력 마우스/키보드/스크린리더)
- **§1 UI(221)**: 분야 5색 표(라이트/다크 hex) + lucide 아이콘 매핑, 난이도 semantic 재사용, 3화면 애니메이션 표, 피드백 정답/오답 톤 + 신기록 Trophy
- **§2 a11y(222/223)**: 단계 전환 포커스 이동(피드백→다음, 결과→다시하기), progressbar 시맨틱(Radix 자동 ARIA + QuizPlay aria-label/valuetext), 결과 신기록 sr-only `role=status aria-live=polite` 공지
- **§3 UX(224)**: PillRadioGroup 3그룹 radiogroup 키보드(화살표/Home/End/roving tabindex), QuizStats 통계 막대(progressbar 시맨틱·내림차순), 전환 모션 + reduced-motion 존중
- **§4 i18n**: ko↔en 핵심 라벨/공지 대조표
- **§5 결과 기록 템플릿**: PASS/FAIL/N/A 표 + 발견 이슈 → 후속 시드 양식

### D2. 모든 검증 항목에 파일:라인 출처 명시

추측 0 원칙. 각 기대값은 실제 코드 출처(`frontend/src/components/quiz/*`, `globals.css`, `category-meta.ts`, `messages/*/quiz.json`, `middleware.ts`)와 라인 번호로 뒷받침한다. Critic 교차 리뷰가 출처 정확성을 검사한다.

### D3. 코드 변경 0

순수 docs 스프린트. frontend/services 무변경 → 코드 게이트(jest/tsc/lint/coverage) 영향 없음.

## 구현

총 atomic commit (start `544ac8d`):

| 커밋 | 에이전트 | 내용 |
|---|---|---|
| (runbook) | Librarian | `docs/runbook/quiz-ui-verification.md` 신규 (§0~§5, 파일:라인 출처 포함) |
| (ADR) | Librarian | ADR sprint-226 KR+EN + `docs/adr/README.md` 인덱스 163→164 |

## 검증

- **출처 정확성**: 런북 작성 전 핵심 출처 11종(globals.css quiz-cat 변수·keyframe, category-meta 아이콘, QuizStart DIFFICULTY_TONE, QuizPlay Progress aria, QuizFeedback/QuizResult 포커스·role·announce, PillRadioGroup 키보드/role, QuizStats progressbar, QuizQuestion 모션, middleware PUBLIC_PATHS, i18n 키)을 현재 코드와 직접 대조해 라인 번호 검증.
- **ADR 게이트**: index count(sprint **164**, --strict) / adr-en coverage(KR/EN 1:1) / adr-links 0 broken / doc-refs no broken.
- **CI**: PR 게이트 통과 후 Squash 머지. 문서 전용이라 코드 게이트 무영향.
- **Critic**: 머지 직전 교차 리뷰(문서 정확성 — 출처가 실제와 일치하는지).

## 교훈

1. **자율 불가능한 운영 검증은 "실행"이 아니라 "실행 가능한 절차서"가 올바른 산출물** — 라이브 검증이 로그인(에이전트 금지) + 수동 롤아웃에 막혀 4스프린트 이월됐다. 에이전트가 직접 못 하는 작업을 매번 이월로만 남기는 대신, 사람이 정확히 실행할 수 있는 repo 영속 런북으로 고정하면 갭이 닫히고 재사용된다.
2. **검증 런북의 가치는 출처에서 나온다** — "분야 색이 맞는지 확인"이 아니라 "`globals.css:103` 기준 자료구조=`#2563EB`(라이트)/`#60A5FA`(다크)인지 확인"처럼 파일:라인 + 기대 hex를 명시해야 검증자가 PASS/FAIL을 객관적으로 판정할 수 있다.
3. **검증 매트릭스를 명시해 누락을 차단** — 같은 항목이라도 라이트/다크 · ko/en · 마우스/키보드/스크린리더 축에서 결과가 갈린다. 매트릭스로 축을 박아두면 "한 번 봤으니 됐다"식 부분 검증을 막는다.

신규패턴: **운영 검증 런북 패턴** — 에이전트가 자율 실행할 수 없는(로그인·수동 롤아웃 등) 라이브 검증은, 파일:라인 출처 + 기대값 + 검증 매트릭스 + 결과 기록 템플릿을 갖춘 repo 영속 런북으로 산출한다.

## Sprint 227+ 이월

- **(운영 실행) `docs/runbook/quiz-ui-verification.md`를 따라 라이브 `/quiz` 실제 검증 수행** — §5 결과 표를 채우고 FAIL 항목은 후속 시드로 등록(사용자/운영).
- **(운영 실행) SP217 컷오버** — `sp217-quiz-records-cutover.md` 따라 frontend 롤아웃 + 라이브 E2E 6항목(본 런북과 같은 frontend 롤아웃으로 일괄 가능).
- (참고) apk_bust 메커니즘(Sprint 225) — 향후 베이스 이미지 CVE는 `gh workflow run ci.yml --ref main -f apk_bust=true`.
- GA4 / Sprint 196 problem_db / 하네스 --full cron — 기존 이월 유지.

## Critic 교차 리뷰

- **도구**: Codex codex-cli, `codex review --base 544ac8d`
- **라운드**: (머지 직전 실행 — 결과 반영)

**판정**: (Critic 결과 반영 예정 — 문서 출처 정확성 중심)
