---
sprint: 161
title: "ADR 상세 페이지 사람 친화적 UX 개선 — Hero + 결정 카드 + Phase strip 시각화"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-160", "sprint-158"]
related_memory: ["sprint-window"]
---
# Sprint 161 — ADR 상세 페이지 사람 친화적 UX 개선 — Hero + 결정 카드 + Phase strip 시각화

## 목표

- ADR 상세 페이지의 텍스트 과밀 문제 해소 — above-fold 정보 0 / 결정 사항 scan-friendly 아님 / Phase 흐름 시각화 0 / 지표 부재
- parser.ts가 이미 만드는 풍부한 메타(canonical 섹션/PR 표/Impact)를 detail 뷰에서 시각 요소로 활용
- 3 sprint 분할(161~163) 중 P0 핵심만 본 sprint 진행: Hero 요약 + 결정 카드 + Phase strip

## 결정

- **parser 메타 활용 패턴 채택**: 이미 분류된 canonical 섹션 + prTable을 detail 뷰에서 분기 렌더 — 새 데이터 소스 불필요
- **TL;DR 자동 추출**: frontmatter `tldr` 우선 / 없으면 "목표" 섹션 첫 번째 list item 자동 추출 (stripMarkdown 적용)
- **결정 카드 파싱**: `- **bold**: text` 패턴 정규식으로 decisions 섹션에서 자동 추출 → 2열 카드 그리드
- **Phase strip PR 표 기반**: implementation 섹션 prTable 행 → Phase 라벨/PR 링크/한 줄 설명/Lines 가로 스크롤 카드
- **PR 표 열 동적 탐색**: sprint마다 열 구조 다름 → `findColIndex` 후보 키워드 매칭으로 Phase/Owner/변경/Lines 위치 동적 결정
- **Palette 선행 불필요 판정 (Oracle)**: `components/adr/` 도메인 컴포넌트는 기존 토큰(`surface-muted`, `surface-elevated`, `border`, `brand`) 재사용 → `components/ui/` 공통 아님
- **3 sprint 분할**: 161(P0 Hero/카드), 162(P1 Mermaid 활성화), 163(P2 PR 표 분리+callout 박스)

## 구현 (1 PR squash merge 예정, 3 commit, origin/main `78e17c4` → `f79841e`)

| PR | Phase | 담당 | 변경 | 라인 |
|----|-------|------|------|------|
| (PR 미생성 — squash merge 예정) | B | architect + critic | Hero + 결정 카드 + Phase strip + parser 확장 + i18n | +432 −3 |

### 세부 변경

1. **parser.ts** (+142): `extractTldr()` / `extractDecisionItems()` / `extractPhaseEntries()` 3개 추출 함수 + 헬퍼(stripMarkdown/findColIndex/safeCell/extractPrUrl). Critic R1 P2 해소: Phase 열 guard(bogus 카드 차단) + 한국어 헤더(`변경`/`라인`/`담당`) 지원
2. **types.ts** (+20): `AdrDecision` / `AdrPhaseEntry` 인터페이스 + `AdrMeta.tldr` / `AdrDoc.decisions` / `AdrDoc.phases`
3. **adr-hero.tsx** (+114): Hero 영역 — TL;DR 텍스트 + 지표 4개(Date/Impact/PR 수/Lines). Critic R2 P2 해소: comma-separated Lines 정규화
4. **adr-decisions-grid.tsx** (+50): 결정 사항 2열 카드 그리드
5. **adr-phase-strip.tsx** (+85): Phase 가로 스크롤 strip + PrLink 컴포넌트
6. **adr-detail-view.tsx** (+6): Hero → PhaseStrip → DecisionsGrid → prose 순서 통합
7. **i18n.ts** (+18): 7키 KR+EN (`heroTldr`/`heroPrCount`/`heroLines`/`heroDate`/`heroImpact`/`decisionsTitle`/`phaseStripTitle`)

## 검증

| 항목 | 결과 |
|------|------|
| tsc --noEmit | clean (0 errors) |
| npm run build | 247 페이지 정적 export 성공 |
| frontmatter tldr 없는 기존 ADR | "목표" 섹션 첫 list item 자동 추출 fallback 동작 |
| decisions/implementation 섹션 없는 ADR | null 반환 → 컴포넌트 미렌더 (graceful) |
| Critic R1 (Codex gpt-5.5, 세션 `019e3e8f-cd3f-7443-a10c-af523eef6e6d`) | P2 2건 (bogus Phase strip guard + 한국어 헤더) → 해소 |
| Critic R2 (Codex gpt-5.5, 세션 `019e3e93-b9e2-7f40-b93e-58636638ddce`) | P2 1건 (comma Lines) → 해소, P3 1건 (escaped pipes) → Sprint 162 이월 |
| doc-ref-lint | 검증 필요 |

## 브랜치 규율 ✅ 29 스프린트 연속 준수

- 신규 브랜치 `feat/sprint-161-adr-ux-hero-cards` + Squash merge 예정
- main 직접 commit 0건, `--no-verify` 0건

## 신규 패턴

1. **parser 메타 → detail 뷰 시각화 패턴** — parser가 만든 canonical 섹션/prTable/impact를 detail 뷰에서 분기 렌더. 데이터는 이미 있고 시각화만 추가
2. **TL;DR 자동 추출 fallback 패턴** — frontmatter 우선 → 목표 섹션 첫 list item fallback. 기존 ADR 수정 불필요
3. **PR 표 열 동적 탐색 패턴** — 열 구조 ADR마다 다름. 후보 키워드 매칭으로 동적 위치 결정 (한국어/영어 혼용 대응)
4. **Phase 열 guard 패턴** (Critic R1 P1 정착) — Phase 열 미존재 시 early return. bogus 카드 차단
5. **Critic R1 → R2 → R3 점진 수렴** — R1 P2 2건 → R2 P2 1건 + P3 1건(이월). P0/P1 0건으로 점진 수렴

## 교훈

1. **데이터 풍부 + 시각화 빈약은 프론트 UX 부채** — parser가 canonical/prTable/impact 모두 만들지만 detail 뷰는 prose 단일 렌더. 데이터 layer vs UI layer 분리 인식 필요
2. **PR 표 열 구조 비표준화가 파서 복잡도 유발** — sprint-154/156/158/160 모두 열 구조 다름. findColIndex 동적 탐색은 현실적 해법이지만 표준 컨벤션 정착이 근본 해결
3. **comma-separated 숫자는 정규식 전 정규화 필수** — `+14,939` → `/\+(\d+)/` 가 `14`만 캡처. phase.lines.replace(/,/g, '') 전처리 필수 패턴
4. **Palette 선행 불필요 판정으로 리드타임 단축** — 도메인 컴포넌트는 기존 토큰 재사용. components/ui/ 공통 컴포넌트만 Palette 가이드 필수
5. **Codex gpt-5.5 교차 검증 3회전이 품질 수렴 도구** — R1에서 bogus 카드 + 한국어 헤더, R2에서 comma Lines, R3에서 escaped pipes(이월). 동일 모델 가족 맹점 3건 추가 검출

## Sprint 162 이월

- **Critic R3 P3 이월**: escaped pipes in GFM table cells — `splitTableRow` 기존 함수 변경 회귀 위험
- Sprint 162 범위: Phase C Mermaid 활성화 + 기존 ADR 다이어그램 추가
- Sprint 163 범위: Phase D PR 표 분리 + 교훈/이월 callout 박스
- 기존 이월 항목 유지 (시드 #신규1~#신규7, #30/#31, #24/#26~#28 등)

## 관련 문서

- [sprint-160.md](./sprint-160.md) — 이전 sprint, Critic R1/R2 패턴 계승
- [sprint-158.md](./sprint-158.md) — i18n 양면 의무 원칙
