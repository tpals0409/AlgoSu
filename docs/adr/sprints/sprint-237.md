---
sprint: 237
title: "ADR 검토 → 모니터링 드리프트 블로그 글 작성 (KR+EN)"
date: "2026-06-09"
status: completed
agents: [Oracle]
related_adrs: ["sprint-231", "sprint-232", "sprint-234", "sprint-235", "sprint-236"]
related_memory: ["sprint-window", "blog-reframing-decisions", "feedback-blog-workflow"]
topics: ["blog", "documentation", "observability"]
tldr: "ADR 174스프린트 ↔ 블로그 11편을 대조해 미작성 소재 군집(모니터링 드리프트·CS 퀴즈·과잉설계 회고·zstd 실험 등)을 발굴하고 강도순 제시. 사용자 선택(1번)으로 Sprint 231~236 모니터링 사가를 블로그 글로 작성: outage-that-never-happened.mdx KR+EN(category platform, relatedAdrs sprint-231~236+ADR-029). 정적 매니페스트(비배포 미러)로 런타임 결함을 단정했다가 ERRATA로 정정하고, 라이브 진단(cAdvisor scrape 부재·promtail 라벨 불일치·Loki OOM)으로 진짜 원인을 찾아 알림 채널 분리까지 적용한 6스프린트 여정을 '문제→실험→성과→성찰' 구조로 정리. 사용자 요청으로 어투를 정량 점검: 초안 격식 레지스터(습니다97/어요11)가 회고 여정 장르와 어긋남 → 따뜻한 구어체(습니다47/어요61)로 조율해 가장 닮은 글 sliding-window-agent-context(45/64)와 정합 + 핵심 깨달음 블록인용 2개. 검증: cross-check --strict 위반 0, blog SSG 빌드 EXIT=0, Critic(Codex gpt-5.5) R1 [P2 원칙(iii) 논리 모순: 폐기된 오판 재유입]→정정→R2 CLEAN. PR #424 squash merge."
---
# Sprint 237 — ADR 검토 → 모니터링 드리프트 블로그 글 작성 (KR+EN)

## 목표

- 최근 ADR/스프린트 기록을 검토하여 아직 블로그로 작성되지 않은 신규 소재 후보를 발굴·제시한다.
- 사용자가 선택한 소재로 기술 블로그 글(KR+EN)을 작성하고, 기존 글들과의 어투 정합까지 확인해 머지한다.

## 배경

- `/start` 인자 "ADR 확인하고 새롭게 블로그에 쓸 내용 있는지 말해줘"로 시작.
- 블로그는 `blog/content/posts/`(KR) + `posts-en/`(EN) 쌍으로 11편 존재, 최신글 `markdown-for-agents-html-for-humans`(2026-05-22, Sprint 198 작성)까지 커버. 그 이후 Sprint 199~236 약 38스프린트가 미작성 구간.
- 블로그 정합은 CI hard gate(`check-blog-crosscheck.mjs --strict`)로 강제: KR↔EN slug 짝 + 구조 필드(date/category/order/tags/series) 완전 일치 + category enum 7종(ai-agent/cicd/architecture/backend/platform/frontend/retrospective) + 내부 링크 무결성.

## 소재 발굴 (ADR 174 ↔ 블로그 11편 대조)

미작성 소재를 서사 강도순으로 제시:

1. **모니터링 대드리프트 사건 (S231~236)** — 정적 분석 오판 → ERRATA → 라이브 진단·해결의 완결된 아크. [[feedback-source-vs-live-drift]]가 척추. **최우선 추천**.
2. **CS 퀴즈 미니게임 (S215~229)** — 신규 기능을 0부터(코어→문항은행→기록연동→a11y→번들 최적화).
3. **만들었다가 지운 것들 (S185~189·S193·S201)** — 블로그 그래프/검색을 만들었다 삭제, 과잉설계 회고.
4. (후순위) zstd 압축 실험 롤백(S165~171) · GitOps SSOT 일원화(ADR-029) · GA4/SEO(S210~213) · 하네스 다형성(S202·S214).

→ 사용자 선택: **1번**.

## 작업 요약 (start `73b4a11`, 4 commit → squash `95c9f92`, PR #424)

- `48ba138` `docs(blog)`: `outage-that-never-happened.mdx` KR+EN 신규. category `platform`, relatedAdrs sprint-231~236+ADR-029. 서사: 정적 매니페스트 오판(S231) → ERRATA·미러 격하·Loki OOM(S232) → 라이브 선진단(cAdvisor/promtail/S234) → 알림 갭 보강(CB 통합·DLQ placeholder 교체/S235) → 채널 분리 라이브(S236). 성찰 4원칙.
- `7a315ee` `style(blog)`: KR 어투를 회고 여정 레지스터로 조율(습니다 97/어요 11 → 47/61), 블록인용 1→2. sliding-window(45/64)와 정합.
- `fix(blog)`: 원칙 (iii) 논리 모순 정정(Critic R1 P2) — null receiver를 "그래서 속았다(비배포 미러)" 개념으로, 실제 배포 사례는 DLQ(미발행 메트릭)로 재구성. KR+EN 동시.

## 핵심 결정

1. **소재 우선순위 = 서사 완결성**: 가장 최신이고 실패→정정→해결 아크가 완결된 모니터링 드리프트를 1순위로 추천. 회고 톤(문제→실험→성과→성찰)에 최적합.
2. **어투를 정량으로 검증**: "기존 글과 비슷한 어투인지 점검" 요청에 종결어미 분포를 측정. 블로그가 격식(ci-refactoring 147/0·markdown-for-agents 64/2)과 따뜻한 구어(sliding-window 45/64·toward-model-agnostic 27/34) 두 레지스터로 갈림을 확인 → 1인칭 고백·여정 장르인 본 글은 후자가 정합 → KR을 47/61로 조율.
3. **Critic을 머지 게이트로**: blog 콘텐츠도 Codex 교차 리뷰. Critic이 원칙 섹션의 논리 모순(글의 핵심 정정과 배치되는 단정)을 적발 → 정정 후 R2 CLEAN.
4. **EN은 영어 보이스 유지**: 종결어미 이슈가 없는 영어판은 조율 대상이 아니며, 기존 EN 글의 1인칭 회고 톤을 따름.

## 검증

- **cross-check `check-blog-crosscheck.mjs --strict`**: KR 12 / EN 12, 위반 0 (parity·schema·link 3축 전부).
- **blog SSG 빌드 `npm run build`**: EXIT=0, `/posts/outage-that-never-happened` + `/en/posts/...` 정적 프리렌더.
- **어투 정량(조율 후)**: 습니다 47 / 어요계열 61 / 블록인용 2 — sliding-window(45/64/2)와 정합.
- **Critic**(Codex gpt-5.5, `codex review --base 73b4a11`): **R1 [P2]** 원칙 (iii)가 "null receiver가 알림을 삼켰다(첫 사건)"고 단정해 글의 핵심 정정(비배포 미러·라이브 정상)과 모순, 원칙만 훑는 독자에게 폐기된 오판 재유입 → 정정 → **R2 CLEAN**("no actionable correctness issues were found in the diff"). (기본 모델 gpt-5.3/5.5-codex는 ChatGPT 계정 미지원 → `-c model=gpt-5.5`로 실행.)
- **CI PR #424**: `Quality — docs`(blog cross-check)·`Secret & Env Scan` 등 전 체크 green, auto-merge SQUASH.

## 교훈

1. **소재 발굴은 커버리지 대조부터** — 블로그(11편)와 ADR(174스프린트)을 날짜·주제로 대조하면 미작성 구간(S199~236)과 서사 군집이 드러난다. "쓸 게 있나?"는 인덱스 대조로 답할 수 있는 질문.
2. **어투 정합은 감이 아니라 측정** — "비슷한 어투인지"는 종결어미 분포(습니다 vs 어요계열)로 정량화된다. 블로그에 격식/구어 두 레지스터가 공존하므로, **글의 장르에 맞는 레지스터**를 고르는 게 정답(고백·여정 → 구어체).
3. **blog 콘텐츠도 Critic이 가치 있다** — 코드가 아니어도 Codex가 글의 내적 논리 모순(원칙 섹션이 본문 정정과 배치)을 적발. 회고 글에서 "교훈/원칙"이 본문 사실과 어긋나면 신뢰를 깬다.
4. **메타-교훈의 재귀** — 모니터링 글이 다루는 핵심("정적 ≠ 런타임", "source repo는 live에서 드리프트")을 글로 쓰는 행위 자체가 [[feedback-source-vs-live-drift]]의 확산. ADR(에이전트 기억) → 블로그(사람 검토 표면) 변환의 한 사례.

신규패턴: **커버리지 대조 기반 소재 발굴 + 어투 정량 정합 패턴**(블로그↔ADR 인덱스 대조로 미작성 군집 발굴, 종결어미 분포로 레지스터 정합 검증).

## 이월

- (사용자 콘솔) GA4 잔여 3건(Enhanced Measurement page_view 중복 OFF · 프로덕션 UAT · 스트림 URL `algo-su.com` 정합).
- (사용자/운영) 라이브 SEO 검증(재배포 후 sitemap/robots `algo-su.com` 도메인 정합).
- 하네스 체크업 `--full` CI 정기 cron(월 1회) 자동화 검토.
- (선택) webhook regenerate · 누적 UAT(프로그래머스 재제출 채점 / 영문 Grafana CB dashboard).
- (블로그 후속 소재) CS 퀴즈 미니게임(S215~229) · 만들었다가 지운 것들(S185~189·193·201) · zstd 실험 롤백(S165~171).
