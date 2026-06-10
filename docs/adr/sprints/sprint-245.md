---
sprint: 245
title: "블로그 글 \"삭제의 기술\" 작성 (KR+EN) — 만들었다가 지운 것들 회고"
date: "2026-06-10"
status: completed
agents: [Oracle, Scribe, Critic]
related_adrs: ["sprint-157", "sprint-189", "sprint-193", "sprint-201", "sprint-244"]
related_memory: ["sprint-window", "feedback-blog-workflow"]
topics: ["blog", "retrospective", "refactoring"]
tldr: "Sprint 244에서 이월된 블로그 소재를 집필 — 「삭제의 기술」(deleting-with-discipline.mdx) KR+EN, category retrospective, order 12, relatedAdrs sprint-157/189/193/201. 사용자 확정 방향은 '무엇을 지웠나'가 아니라 '어떻게 안전하게 지우는가'를 방법론으로 정리하는 것. ADR 그래프(S189 구축→S193 삭제)와 검색(S157 구축→S201 삭제)을 예시로 삭제의 3원칙 도출: ①착수 전 grep으로 전용 자산(minisearch·search* i18n·SearchDoc / 그래프 컴포넌트 5개·buildGraph·i18n 44키) vs 공유 자산(buildUrl·groupByKind·kind* i18n / 관련 ADR 텍스트 링크·본문 mermaid) 분리 ②죽은 필드는 기능과 함께 제거(searchDocs·outgoingLinks) ③삭제는 대상 밖에서 깨진다(S201 인시던트: grep 범위 blog/ 한정→루트 check-adr-links.mjs의 search-index.json 검증(exit 2) 누락→required check 아니라 main 깨진 채 머지→/stop 게이트 포착). Scribe 집필(9c50de1)→Critic(Codex gpt-5.5, session 019eb181) ✅ 머지 가능(Critical/High/Medium 0, 사실 정합 12항목 전수 ADR 대조 일치·KR↔EN 1:1·에이전트 귀속 정확)→Low 1건(sprint-157 relatedAdrs 비대칭 누락) Scribe 수정(2a903b1). 검증 crosscheck --strict 0(KR/EN 14)·SSG EXIT=0(신규 라우트 KR+EN)·doc-refs 465 clean·CI green·post-merge main green. PR #438 squash c8e4ee4."
---
# Sprint 245 — 블로그 글 "삭제의 기술" 작성 (KR+EN)

## 목표

- Sprint 244에서 이월된 블로그 소재("만들었다가 지운 것들")를 집필한다.
- 사용자 확정 방향: **"삭제의 기술" 중심** — "무엇을 지웠나"가 아니라 **"어떻게 안전하게 지우는가"**를 방법론으로 정리하고, 두 사례(ADR 그래프 S189 구축→S193 삭제, ADR 검색 S157 구축→S201 삭제)는 그 방법론의 예시로 배치.
- Sprint 237/244 확립 블로그 패턴(어투 레지스터 정합 + crosscheck --strict + blog Critic) 적용.

## 배경

- AlgoSu는 정교하게 구축한 두 기능을 나중에 전부 삭제했다: ADR 관계 그래프(S189 mermaid 기반 `/adr/graph` 페이지+미니 그래프+범례/필터 → S193 전체 삭제), ADR 전문 검색(S157 MiniSearch+빌드 시 `search-index.json` → S201 삭제).
- /start 단계에서 사용자에게 서사 무게중심을 질문 → "삭제의 기술 중심"(어떻게 안전하게 지우는가) + category `retrospective` 확정.

## 결정

### D1. 서사 프레임 — "삭제의 기술" 방법론 (사용자)
- "무엇을 지웠나"의 회고가 아니라 "어떻게 안전하게 지우는가"의 방법론. 두 사례는 예시로만 배치. 단독 개발자가 기능을 제거할 때 따르는 규율을 독자에게 전달하는 것이 목표.

### D2. category·메타 — retrospective / order 12 / relatedAdrs 4건
- category `retrospective` (baekjoon-gone과 동일 분류, 회고 주제). order 12 (직전 최대 11=model-selection-strategy).
- relatedAdrs ["sprint-157","sprint-189","sprint-193","sprint-201"] — 검색 구축·그래프 구축·그래프 삭제·검색 삭제. **초안은 sprint-157 누락**(그래프 구축 189는 포함하면서 검색 구축 157만 제외=비대칭)이었으나 Critic Low 적발로 추가(D4).

### D3. 글의 3원칙 (뼈대)
1. **지우기 전에 grep으로 나눈다** — 전용 자산 vs 공유 자산 분리. 근거: S201(전용=minisearch 의존성·search* i18n 키·SearchDoc 타입·toSearchDoc/toPlainText / 공유 보존=kind*/metaSprint i18n·buildUrl/groupByKind/mapBySprint/filterAdrsByTopic), S193(그래프 전용=컴포넌트 5개·buildGraph/getSubgraph/filterAdjacency·i18n 44키·fixtures / 보존=관련 ADR 텍스트 링크·본문 mermaid·--diagram-bg/grid 토큰).
2. **죽은 필드는 기능과 함께 죽인다** — AdrIndex.searchDocs(S201), AdrDoc.outgoingLinks(S193) 둘 다 죽은 필드로 명시 제거.
3. **(클라이맥스) 삭제는 대상 밖에서 깨진다** — S201 인시던트: 1차 PR이 grep 범위를 `blog/`로 한정 → 루트 `scripts/check-adr-links.mjs`가 삭제된 `search-index.json` 존재를 검증(exit 2)하는 것을 놓침 → CI `Build Blog (SSG)` 잡이 fail이었으나 required check가 아니라 squash merge 진행 → main이 깨진 채 머지 → `/stop` 게이트의 로컬 check-adr-links 실행이 포착 → 후속 PR 봉합. 교훈: 지운 파일을 참조하는 코드는 그 파일 디렉토리 밖에 있을 수 있다, grep 범위를 저장소 전체로 열어라.

### D4. (Critic 후) sprint-157 relatedAdrs 추가
- Critic Low 적발: 본문이 "Sprint 157에서 만든 ADR 검색을 Sprint 201에서 지웠다"고 명시 언급하는데 relatedAdrs에 sprint-157 누락(graceful skip이라 런타임 영향은 없으나 비대칭). frontmatter 큐레이션은 Scribe 담당 → Scribe 1줄 추가 재위임(KR/EN 동시, `2a903b1`).

## 구현

### 집필 (Scribe, `9c50de1`)
- 신규: `blog/content/posts/deleting-with-discipline.mdx`(KR, SSOT) + `blog/content/posts-en/deleting-with-discipline.mdx`(EN, 1:1), 각 105줄.
- 제목 「삭제의 기술」. MDX 컴포넌트: Problem/Decision/Result/Callout(type="info"). 어투: model-selection-strategy.mdx 정합(단독 개발자 1인칭 회고).
- **Scribe 착수 전 자체 사실 정합 검증**: 소재 ADR 4종(157/189/193/201) 전수 Read 후 사용 수치 대조 — i18n 44키(KR/EN 각 22), 죽은 필드명, check-adr-links exit 2, required check 아님, /stop 포착, CI 37/0(S193) 전 항목 ✅.

### Low 수정 (Scribe, `2a903b1`)
- relatedAdrs 배열에 "sprint-157" 추가(KR/EN). crosscheck --strict EXIT=0 재확인 후 atomic commit.

## 검증

- crosscheck --strict 위반 0 (블로그 글 KR/EN 각 14개).
- blog SSG build EXIT=0 — 신규 라우트 `/posts/deleting-with-discipline` + `/en/posts/deleting-with-discipline` 생성 확인.
- doc-refs lint 465 files clean (regression fixtures 8/8).
- **Critic(Codex gpt-5.5 --base 95ae0b3, session `019eb181`) ✅ 머지 가능** — Critical/High/Medium 0건. 4축 전수: ①사실 정합 12항목 전수 ADR 대조 일치 ②KR↔EN 1:1(섹션·MDX·수치·심볼) ③모델/에이전트 귀속(Critic=Codex 정확, 오귀속 0) ④MDX 태그 밸런스 4:4·frontmatter 형식 유효. Low 1건(sprint-157 relatedAdrs)만 권고 → D4 수정.
- CI(PR #438) 전 체크 green(fail 0) → squash merge `c8e4ee4` → post-merge main run success.

## 교훈

1. **삭제 회고가 곧 삭제 방법론이다.** "무엇을 지웠나"는 단순 기록이지만, 두 삭제 사례에서 공통 규율(전용/공유 grep 분리·죽은 필드 동반 제거·삭제 결합 탐지)을 추출하니 재사용 가능한 방법론이 됐다. 사용자의 프레임 선택("어떻게"로의 전환)이 글의 가치를 결정.
2. **S244 모델 귀속 점검 교훈을 게이트로 실행했다.** Critic 지시에 "모델/에이전트 귀속 점검"을 명시 → Critic이 본문 "Critic 이슈 0건"(S193 인용)을 실제 ADR `agents:[..Critic]`과 대조해 정확 귀속 확인. 직전 스프린트 교훈이 다음 스프린트 검증 항목으로 정착.
3. **relatedAdrs 비대칭은 본문 언급과의 대조로 잡힌다.** 그래프는 구축(189)을 포함하면서 검색은 삭제(201)만 포함한 비대칭을, 본문이 "S157에서 만든 검색"을 명시한다는 사실로 Critic이 적발. 메타데이터 큐레이션도 본문 일관성 검증 대상.
4. **Scribe 착수 전 사실 정합 검증의 가치.** 소재 ADR 4종을 먼저 전수 대조하고 집필 → Codex Critic 도달 시 사실 오류 0건. 사실이 단단한 글은 후속 게이트가 빠르게 통과.

## 이월

- 블로그 소재: CS 퀴즈(S215~229) · zstd 압축 등 잔여 소재 → 다음 스프린트.
- 사실 정합 게이트에 모델/에이전트 귀속 점검 정식 추가 검토(S244·S245 2회 연속 적용 — 패턴 정착 단계).
- 기존 잔여: (하네스 슬롯) pane 가드 항구화+윈도우 장식 근본 해소(--full FAIL 1)+Codex 모델 핀+상태 오기록 3연속 · `Quality — docs` required 승격 · 동기 로그 싱글톤 context·i18n·ConfirmStep tErrors·인라인 style(S242 이월) · Q-4 libs/ 스파이크(백로그) · CI 헬퍼 단위 테스트 정책 · (사용자 콘솔) GA4 3건·라이브 SEO 재배포·하네스 cron·webhook regenerate·누적 UAT.
