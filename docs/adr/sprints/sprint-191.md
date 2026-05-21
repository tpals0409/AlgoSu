---
sprint: 191
title: "이월 시드 일괄 해결 — filterAdjacency P2 · .claude-tools Phase 2 · prom-client Case C/D"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-190", "sprint-189", "sprint-135", "sprint-156"]
related_memory: ["sprint-window"]
topics: ["operations", "cicd"]
tldr: "Sprint 190까지 누적된 이월 시드 8건을 실효·위험 측정 후 3티어로 처리한다. 구현 3건(filterAdjacency P2+죽은 unresolved UI 제거 · .claude-tools Phase 2 삭제 · prom-client Case C/D 회귀 spec), 검증 후 종결 2건(이미 구현됨), 결정-기반 종결 3건(실효 0·역효과). Critic 2R 후 이슈 0건, CI green."
---
# Sprint 191 — 이월 시드 일괄 해결 (filterAdjacency P2 · .claude-tools Phase 2 · prom-client Case C/D)

## 목표

- Sprint 190까지 누적된 이월 시드 8건을 사용자 지시("이월된 시드 모두 해결")에 따라 일괄 처리한다.
- "해결"을 구현으로 한정하지 않고, 착수 조사로 각 시드의 **실효·위험을 측정**해 3티어로 분류: 구현(실효·안전) / 검증 후 종결(이미 구현됨) / 결정-기반 종결(실효 0 또는 역효과).

## 배경

- Sprint 185~190 동안 "선택 후속"·"H3 PR표"·"filterAdjacency P2" 등이 매 스프린트 이월 리스트에 누적 계승되어 왔다(sprint-181~190 §이월). 일부는 이미 구현되었거나(post-merge gate, doc-refs bare-path), 정의가 모호하거나, 대상이 0건이라 dead code가 되는 항목이었다.
- 누적 시드를 한꺼번에 구현하기보다, 각 항목의 실제 가치를 측정해 선별 처리하는 Sprint 190 교훈을 계승했다.

## 결정

### D1. 8개 시드 3티어 분류 (착수 조사 후 사용자 확정)

조사로 각 시드 상태를 측정해 사용자에게 제시, "#6~8은 결정-기반 해결"로 범위 확정:

| # | 시드 | 티어 | 근거 |
|---|------|------|------|
| 1 | filterAdjacency P2 | 구현 | unresolved `to`는 전체 문서 집합에 없어 phantom 노드/카운트 불일치 유발 |
| 2 | .claude-tools Phase 2 | 구현 | deprecated 2파일, live caller 0건 |
| 3 | prom-client Case B~D | 구현 | Case A·B는 기존 커버, C·D만 갭 |
| 4 | post-merge deploy gate | 검증 후 종결 | `compute-deploy-gate.sh`(Sprint 160) 이미 구현 |
| 5 | doc-refs bare-path | 검증 후 종결 | 8 prefix 전수(Sprint 182) 이미 구현 |
| 6 | coverage-gate skipped 제거 | 결정-기반 | 제거 시 gate 자체가 silently skip → 검사 누락 |
| 7 | H3 PR 표 추출 | 결정-기반 | Phase 컬럼 보유 H3 표 0편 → dead code |
| 8 | (adr) layout 분할 | 결정-기반 | usePathname()(Sprint 188) 정상 동작, 관측 변화 0 |

### D2. filterAdjacency P2 — 카운트 안전 + 죽은 UI 제거 (Critic P2)

- 엣지 유지 조건을 from·to **양쪽 모두 잔존 노드**로 통일(`nodeIds.has(e.from) && nodeIds.has(e.to)`). unresolved 엣지는 `to`가 비존재 참조라 자연 제외 → mermaid 암묵 노드/카운트 불일치 구조적 차단.
- Critic(Codex) R1 P2 적발: 위 수정이 `showUnresolved` 토글/점선 범례/캡션을 동작 불가(죽은 UI)로 만든다. unresolved 0건·낮은 우선순위라 placeholder 노드(기능 보존) 대신 **UI 제거**를 사용자 확정.
- `showResolved`→단일 `showEdges` 토글, buildChart는 선언 노드 사이 엣지만 렌더(getSubgraph 경로 phantom 차단 포함), i18n(ko+en) 정리.

### D3. prom-client Case B~D — 갭만 보강 + §9-3 정정

- 조사 결과 Case A(중복 등록)·B(label cardinality `normalizePath`)는 이미 전 NestJS 서비스 + ai-analysis spec 보유. 미검증 갭만 보강:
  - **Case C** (worker registry 격리): github-worker 격리 registry 출력에 prefix된 `nodejs_`/`process_` default metric 포함 검증.
  - **Case D** (Python explicit metric): ai-analysis 명시 `algosu_ai_analysis_*` 메트릭 노출 검증.
- `monitoring-logging.md §9-3` Case A~D별 회귀 spec 매핑 추가 + **Case D 정정**: `prometheus_client`는 GC/platform collector를 기본 REGISTRY에 자동 등록(`python_gc_*`/`python_info` 노출, `process_*`는 Linux)하므로 "gc_*/process_* 부재"는 부정확 → "Node-style `collectDefaultMetrics` 미호출"이 본질.

## 구현

### 구현 커밋 (5커밋, PR #335 squash → `2db66dd`)

- `02cb0d2` fix(blog) — filterAdjacency P2: from·to 양쪽 잔존 노드 엣지만 유지
- `64f568b` chore(docs) — .claude-tools Phase 2: deprecated 2파일 삭제 + runbook 반영
- `e59fa3c` test(github-worker) — prom-client Case C 격리 registry default metric 회귀 spec
- `ba6d816` test(ai-analysis) — prom-client Case D explicit metric 회귀 spec + §9-3 매핑/정정
- `0addc4b` fix(blog) — unresolved 엣지 UI 제거 (Critic P2)

### .claude-tools Phase 2 특기 사항

- `.claude-tools/`는 `.gitignore`(untracked) → 파일 삭제 자체는 로컬 작업, tracked 변경은 runbook 갱신만. trigger path 검증: `~/.claude/oracle/bin/`·내부 live caller 0건. `.claude-team.json`(critic dispatch config)은 별도 파일이라 보존.

## 검증

- **blog**: tsc 0 · build 전 라우트 정적(graph 포함) · 산출물 신규 라벨(`연결 표시`/`Show edges`) 존재, 구 unresolved UI 부재(EN "Unresolved"는 ADR 노드 라벨 false positive).
- **서비스 테스트**: github-worker 179 tests pass(Case C 포함) · ai-analysis Case D pass(metrics.py 100%).
- **게이트 6종 green**: doc-refs 343 0broken · i18n-residue 2.19%<8% · blog-crosscheck KR10/EN10 0 · adr-links 1921 0broken · adr-conversion 12/12 · adr-en 137/137 · adr-index sprint 128.
- **Critic**: `codex review --base main` 2라운드 — R1 P2 1건(unresolved 토글 무력화) → UI 제거 반영, **R2 이슈 0건**.
- **CI #335**: SUCCESS 40 / SKIPPED 9 / NEUTRAL 1 / **FAILURE 0** (Build Blog · Test AI Analysis · github-worker · E2E · Coverage Gate · Trivy 포함).

## 교훈 / 패턴

- ① **누적 시드는 일괄 구현보다 실효·위험 측정 선별이 효율적(Sprint 190 계승·재입증)** — 8건 중 2건은 이미 구현됨(검증만), 3건은 실효 0/역효과(결정-기반 종결)로 드러나, 실제 구현은 3건에 집중. 착수 조사가 헛수고를 차단.
- ② **최소 수정이 인접 UI를 죽이면 Critic이 포착 → 정직한 완결 필요** — filterAdjacency 1줄 수정이 카운트는 고쳤으나 `showUnresolved` 토글/범례를 죽은 UI로 남겼고, Critic(Codex)이 이를 P2로 적발. 기능 보존(placeholder) vs 제거의 product 결정을 사용자에게 위임해 죽은 UI 없이 완결.
- ③ **"이미 구현됨" 시드는 검증 후 종결이 곧 해결** — post-merge gate·doc-refs bare-path는 코드 근거(`compute-deploy-gate.sh`·`REPO_ROOT_PREFIXES` 8 prefix)로 구현 확인 후 백로그에서 제거. "해결"은 구현만이 아니라 검증·종결·결정 명문화를 포함.
- ④ **회귀 spec 추가 전 기존 커버리지 조사 필수** — prom-client "Case B~D"는 Case A·B가 이미 전 서비스 spec 보유라 실제 갭은 C·D뿐. 조사 없이 B를 다시 짰다면 중복. 부수적으로 §9-3의 부정확한 Case D 서술(prometheus_client 자동 collector 무시)을 실측으로 정정.

## 이월 항목

- 누적 UAT (사용자 직접): 시드 #5 프로그래머스 재제출 채점 / 시드 #9 영문 production Grafana CB dashboard ai-analysis 시각 정합 / Sprint 160~191 누적 UAT
- 신규 시드: **Python 3.14 호환성** — `test_main.py` 4건이 로컬 Python 3.14의 `asyncio.get_event_loop()` 자동 루프 생성 제거로 실패(CI는 Python 3.12라 통과, 본 스프린트 무관). → Sprint 192 처리.
