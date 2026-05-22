---
sprint: 198
title: "블로그 글 작성 — Markdown for Agents, HTML for Humans (KR+EN)"
date: "2026-05-22"
status: completed
agents: [Oracle, Scribe, Critic]
related_adrs: []
related_memory: ["sprint-window", "feedback-blog-workflow", "blog-reframing-decisions"]
topics: ["blog", "documentation", "adr"]
tldr: "안드레이 카파시의 'LLM 출력은 Markdown보다 HTML이 사람에게 더 좋을 수 있다' 발언을 계기로, AlgoSu의 ADR 이중 표면 구조(Markdown ADR=agent memory / blog의 HTML ADR 뷰=사람용 review surface)를 회고 에세이로 정리한 기술 블로그 글 1편(KR+EN)을 작성. 핵심 주장이 코드로 실재함을 사전 검증(blog/src/lib/adr/loader.ts가 docs/adr/sprints/*.md를 파싱하고 adr-detail-view.tsx가 HTML 뷰로 렌더링). 사용자 제공 완성형 초안을 blog 스키마(excerpt/category/tags/tldr)·경어체로 정착하고 EN 번역 동반. 확정 결정(사용자 AskUserQuestion 4건): 본문 경어체 통일 / category=retrospective / 핵심 1~2곳만 Callout / slug=markdown-for-agents-html-for-humans. 검수에서 인명 오기(안드레아→안드레이 카파시)·Callout title 중복 2건 정정. blog-crosscheck --strict 0위반(KR 11/EN 11), EN 한글 잔류 0, blog SSG 빌드 양 라우트 생성, Critic(codex review --base main) Critical/High 0건, CI SUCCESS 38/FAIL 0(CLEAN). PR #349 squash → e5a8dac."
---
# Sprint 198 — 블로그 글 작성: Markdown for Agents, HTML for Humans (KR+EN)

## 목표

- 사용자가 제공한 완성형 블로그 초안을 `blog/` 스키마·톤에 맞춰 정착시키고 EN 번역을 동반 작성한다.
- 주제: 안드레이 카파시(Andrej Karpathy)의 "LLM 출력은 Markdown보다 HTML이 사람에게 더 좋을 수 있다" 발언을 계기로, AlgoSu의 **ADR 이중 표면 구조**(Markdown ADR = agent memory / blog의 HTML ADR 뷰 = 사람용 review surface)를 회고 에세이로 정리한다.

## 배경

- 글의 핵심 주장이 코드로 실재함을 착수 전 검증: `blog/src/lib/adr/loader.ts`가 `docs/adr/sprints/*.md`(Markdown, agent용)를 파싱하고 `blog/src/components/adr/adr-detail-view.tsx`가 3-column 레이아웃 + Callout 격리로 HTML 뷰(`/adr/sprints/<num>` 등, 사람용 review surface)를 렌더링한다. 즉 "Markdown은 agent에게, HTML은 사람에게"는 사후 프레이밍이 아니라 실제 구현된 구조다.
- blog 포스트 구조: KR `blog/content/posts/`, EN `blog/content/posts-en/` 디렉토리 분리(.mdx, slug 공통). frontmatter 필수 필드 = title/date/excerpt/tags/category. `check-blog-crosscheck.mjs --strict`가 KR↔EN slug 짝 + 공통 구조 필드(date/category/order/tags/series/seriesOrder) 일치 + category enum + 링크 무결성을 강제(CI hard gate).
- 워크플로우 규칙: 본문 내러티브가 바뀌는 작성은 글 단위로 사용자 검토([[feedback-blog-workflow]]).

## 결정

### D1. 본문 톤 — 경어체 통일 (사용자, AskUserQuestion)

- 초안은 평어체("~했다")이나 기존 블로그 10편이 모두 경어체 경험담 톤("~했습니다"). 일관성을 위해 어미만 경어체로 변환하고 내용·문단 구조·논지는 초안 그대로 보존. 1인칭은 "저".

### D2. 카테고리 — `retrospective` (사용자, AskUserQuestion)

- blog category enum 7종(ai-agent/cicd/architecture/backend/platform/frontend/retrospective) 중 의사결정 성찰 에세이 성격에 맞는 `retrospective` 선택.

### D3. MDX 컴포넌트 — 핵심 1~2곳만 Callout (사용자, AskUserQuestion)

- 에세이 흐름을 보존하기 위해 Callout 2곳만: ① "토큰의 두 얼굴"(`type="warn"`, "어떤 토큰은 낭비, 어떤 토큰은 운영 리스크를 줄이는 비용"), ② 결론 마무리("문서의 목적이 다르면, 문서의 표면도 달라져야 합니다", `type="success"`). 초안의 blockquote는 그대로 유지.

### D4. slug + frontmatter 정착 (사용자 AskUserQuestion + 기술 결정)

- slug = `markdown-for-agents-html-for-humans`(KR/EN 공통). 초안 frontmatter 변환: `description→excerpt`, `date`에 따옴표, `category` 추가, `tags` kebab-case 소문자. `relatedAdrs`는 직접 대응하는 영구/토픽 ADR이 없어 생략(crosscheck 미검증 선택 필드), `order`는 date(2026-05-22)가 최신이라 생략.

## 구현

### 구현 커밋 (1커밋, PR #349 squash → `e5a8dac`)

- `chore(blog)` — 신규 글 2파일(각 198줄):
  - KR `blog/content/posts/markdown-for-agents-html-for-humans.mdx`
  - EN `blog/content/posts-en/markdown-for-agents-html-for-humans.mdx`
  - 작성은 Scribe에 위임(초안 경어체 변환 + frontmatter 정착 + Callout 2곳 + EN 번역). Oracle 검수에서 2건 정정.

### 검수 정정 (Oracle)

- **인명 오기**: 초안의 "안드레아 카파시" → "안드레이 카파시"(Andrej Karpathy). EN은 "Andrej Karpathy"로 작성됨.
- **Callout title 중복**: #1 title이 섹션 제목·본문과 거의 동일 → 요약어("토큰의 두 얼굴")로, #2 title이 body와 완전 동일 → title 제거(한 줄 격언만 강조). 기존 글(sprint-journey) 패턴과 일치.

## 검증

- **blog-crosscheck `--strict`**: exit 0, KR 11 / EN 11, 위반 0(slug 짝·공통 구조 필드·category enum·링크 무결성).
- **EN 한글 잔류**: 0건(perl `\p{Hangul}`).
- **blog SSG 빌드**: `/posts/markdown-for-agents-html-for-humans`·`/en/posts/markdown-for-agents-html-for-humans` 양 라우트 정적 생성, MDX(Callout) 파싱 정상.
- **Critic**: `codex review --base main`(Codex) — Critical/High **0건**("valid frontmatter fields and existing MDX components. I did not identify any build-breaking syntax or functional regressions"). ✅ 머지 가능.
- **CI #349**: SUCCESS 38 / SKIPPED 11 / NEUTRAL 1 / Failed **0** / `MERGEABLE`·`CLEAN` → Squash merge.

## 교훈 / 패턴

- ① **에세이성 글의 서사 주장은 코드로 사실 검증 후 작성** — "ADR을 두 표면으로 나눴다"는 회고 프레임이 실제 구현(loader.ts + adr-detail-view.tsx)과 일치함을 착수 전 Explore로 확인. 블로그 글이라도 코드베이스 사실과 어긋나면 신뢰성을 잃으므로, 주장-구현 정합을 사전 검증한다.
- ② **사용자 초안의 사실 오류는 보존하지 않고 정정** — 인명 오기(안드레아→안드레이 카파시)는 "초안 그대로 보존" 원칙의 예외. 톤·구조는 보존하되 명백한 사실 오류는 바로잡는다.
- ③ **Callout title은 본문·섹션 제목 반복이 아니라 요약어** — title=body 중복이나 섹션 제목 반복은 시각적 노이즈. 기존 패턴(sprint-journey "해봐야만 생기는 것들")처럼 요약어를 쓰거나, 한 줄 격언은 title 없이 박스만으로 강조.

## 신규 패턴

- **신규 블로그 글 추가 체크리스트** — KR `posts/` + EN `posts-en/` 동일 slug `.mdx` 2파일, frontmatter 공통 구조 필드(date/category/tags) 일치, `check-blog-crosscheck.mjs --strict` 0위반 + EN 한글 0 + blog SSG 빌드 양 라우트 확인. 디렉토리 자동 스캔이라 manifest/index 갱신 불요.

## 이월 항목

- **Sprint 199 (확정)**: app.module 스모크 `.init()` 확장 — 라이프사이클 훅(onModuleInit) 검증 + amqplib mock으로 RabbitMQ 연결 단계까지 부트스트랩 동등 검증.
- **운영측 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영): problem_db에 `npm run migration:run`(jsonb 전환 + GIN, 런북 `SET statement_timeout=0`).
- (선택) **CI PYTHON_VERSION 3.12 → 3.13** 상향 (별도 스프린트).
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
