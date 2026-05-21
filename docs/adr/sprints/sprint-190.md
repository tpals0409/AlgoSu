---
sprint: 190
title: "이월 시드 정리 — sprint-87-plan.md를 docs/planning/으로 relocate"
date: "2026-05-21"
status: completed
agents: [Oracle, Scribe, Critic]
related_adrs: ["sprint-189", "sprint-184", "sprint-183"]
related_memory: ["sprint-window"]
topics: ["operations"]
tldr: "5 Phase 블로그 개편 완료 후 누적 이월 시드를 정리한다. 사용자 범위 확정으로 비-ADR plan 문서 sprint-87-plan.md(KR+EN)를 docs/planning/으로 relocate하고, ADR 카운트 게이트(128→127)와 범위 표기를 동기화했다. 동작 변경 0."
---
# Sprint 190 — 이월 시드 정리 (sprint-87-plan.md를 docs/planning/으로 relocate)

## 목표

- 5 Phase 블로그 포트폴리오화 개편(Sprint 185~189) 완료 후, Sprint 189까지 누적된 이월 시드를 정리한다.
- 6개 이월 시드 후보 중 사용자가 **`sprint-87-plan.md` relocate 단독**으로 범위를 확정했다. 비-ADR plan 문서가 ADR 디렉토리에 잔존하던 데이터 정리로, **동작 변경 0**의 순수 파일 이동 + 카운트 게이트 동기화.

## 배경

- Sprint 183에서 `deriveSlug`(loader.ts)가 `sprint-87.md`와 `sprint-87-plan.md`를 **둘 다 슬러그 `'87'`로 충돌**시켜 `/adr/sprints/87/` 라우트가 plan 본문으로 오염된 사례가 있었다. 당시 loader 스캔을 `sprint-NNN.md`만 인정하도록 좁혀 차단했으나, plan 파일 자체는 `docs/adr/sprints/`(+ EN 카운터파트)에 잔존했다.
- 이 파일은 ADR(결정 기록)이 아닌 **계획 문서**로, ADR 스펙을 따르지 않으면서 ADR 디렉토리 정합성을 해쳤다(Sprint 183/184 이월 시드).

## 결정

### D1. relocate 단독 수행 + 위치 (사용자 확정)

착수 전 조사로 이월 시드의 실효 가치를 측정하여 사용자에게 제시했다:

- **blog ADR 파서 H3 PR표(sprint-135/143/146)**: 3편 모두 "구현/Implementation" 섹션이 없고, PhaseStrip 렌더에 필요한 Phase/Wave 컬럼은 sprint-135(`PR | Wave | ...`)만 보유. sprint-143(`PR | 브랜치 | 파일 수 | Critic`)·146(`PR | 시드 | 위치 | 결과`)은 미해당 → **실효 sprint-135 1편**. 파서/section-aliases 확장은 전체 ADR 회귀 위험 → 제외.
- **`filterAdjacency` unresolved 엣지 P2**: 현재 unresolved 엣지 0건이라 실제 영향 없음 → 우선순위 낮음, 제외.
- **`sprint-87-plan.md` relocate**: 명확하고 잘 정의된 데이터 정리, 회귀 위험 낮음 → **단독 채택**.

relocate 위치는 `docs/planning/`. KR(`sprint-87-plan.md`) + EN(`sprint-87-plan.en.md`) 양쪽 plan 파일을 함께 이동해 `check-adr-en-coverage`의 KR/EN 균형을 유지한다.

### D2. 카운트 게이트 동기화 + 범위 표기 reconcile (Critic P3)

- `check-adr-index-count`가 `sprints/*.md` 전체(README 제외)를 세므로 relocate 시 sprint 카운트 **128→127**. `docs/adr/README.md` KR 2곳(ASCII 트리 line 18 + 섹션 헤더 line 54) 갱신. EN README는 카운트 선언이 없어 변경 불필요.
- Critic(Codex) P3 적발: "127개, Sprint 62~189"는 62~189가 128개 번호라 카운트와 내부 불일치. 실제 구성 — 62~189 중 **88·89·90·172 결번** + **통합 단발노트 40·48·51** = 127. 범위 표기를 `Sprint 62~189 일부 결번 + 통합 40·48·51`로 reconcile.

## 구현

### 구현 커밋 (2커밋, PR #333 squash → `9be2c29`)

- `697232e` chore(docs) — relocate `sprint-87-plan.md`(KR+EN) `docs/adr/sprints/`·`docs/adr-en/sprints/` → `docs/planning/` (git rename 100% 추적) + README 카운트 128→127 (2곳)
- `2978a35` docs(adr) — Critic P3 범위 텍스트 reconcile (결번·통합 명시)

### 영향 0 근거 (사전 조사로 전수 확인)

| 게이트/시스템 | 영향 | 근거 |
|---|---|---|
| `check-adr-index-count` | sprint 128→127 | README KR 2곳 동기화 |
| EN README | 없음 | 카운트 선언 부재 |
| `check-adr-en-coverage` | 137→136 (균형) | KR/EN plan 동시 이동 |
| `check-doc-refs` | 없음 | code-span 멘션은 `stripInlineCode`로 strip, bare-path는 repo-path 접두 요구 |
| `check-adr-links` | 없음 | plan 파일로 향하는 마크다운 링크 0건 |
| blog loader/build | 없음 | loader가 `sprint-NNN.md`만 인정 → 빌드 대상 외 (산출물 무변경) |

## 검증

- **게이트 6종 green**: index-count 127/127 · en-coverage 136/136 · doc-refs 341 files 0 broken · adr-links 1900 links 0 broken · adr-conversion 12/12 fixtures(sprint=127) · blog build 전 라우트 정적 prerender.
- **Critic**: `codex review --base main` → Critical/High/Medium **0건**, P3 1건(범위 텍스트) → 보정 커밋 `2978a35`로 해소.
- **CI #333**: 38 pass / 0 fail (Quality — docs 포함).
- **머지 후 main 확인**: `docs/planning/`에 KR+EN plan 안착, ADR 디렉토리 잔존 0, index-count 127/127 일치.

## 교훈 / 패턴

- ① **사전 영향 조사가 안전한 데이터 정리의 핵심** — relocate 전 6개 게이트/시스템의 영향점(카운트·en-coverage·doc-refs·adr-links·loader)을 **코드 근거로 전수 확인**해 무회귀를 사전 보장했다. 특히 doc-refs는 `stripInlineCode` + bare-path 접두 요구 두 메커니즘으로 code-span 멘션을 자연 배제함을 정규식 수준에서 확인했다.
- ② **숫자는 SSOT 게이트가 강제하되 서술 표기는 별도** — `check-adr-index-count`는 카운트 숫자만 검증하므로, "Sprint 62~189" 같은 사람이 읽는 서술 표기는 relocate로 드러난 불일치를 게이트가 잡지 못했다. Critic(Codex) 교차 리뷰가 이 숫자≠서술 동기화 누락(P3)을 포착 → 작은 데이터 정리에서도 Critic의 가치 입증.
- ③ **시드 정리는 실효 가치 선별이 우선** — 착수 조사로 H3 PR표(실효 1편)·filterAdjacency P2(0건)의 낮은 실효를 드러내, 사용자가 relocate 단독으로 범위를 축소했다. 누적 시드를 한꺼번에 처리하기보다 실효·위험을 측정해 선별하는 것이 효율적.

## 이월 항목

- blog ADR 파서 H3-only PR 표 추출 (실효 sprint-135 1편 — 파서/section-aliases 확장 회귀 위험)
- `filterAdjacency` unresolved 엣지 P2 (현재 0건 무영향, 원 buildChart 설계 계승)
- 누적 UAT (사용자 직접): 시드 #5 프로그래머스 재제출 채점 / 시드 #9 영문 production Grafana CB dashboard ai-analysis 시각 정합 / Sprint 160~190 누적 UAT
- 선택 후속: coverage-gate `skipped` 허용 제거 · post-merge pre-deploy gate · prom-client Case B~D 점검 자동화 · `.claude-tools/` Phase 2 실제 삭제 · `(adr)` layout 분할(KR+EN override) · doc-refs bare-path 확장
