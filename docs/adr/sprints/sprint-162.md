---
sprint: 162
title: "ADR 관련 문서 링크 정상화 + Mermaid 활성화"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-161", "sprint-160"]
related_memory: ["sprint-window"]
---
# Sprint 162 — ADR 관련 문서 링크 정상화 + Mermaid 활성화

## 목표

- Sprint 161 사용자 시각 검증에서 발견된 결함 2건 해소: (1) 메타사이드바 RelatedLinks `<span>` 렌더 → 클릭 불가 (2) ADR 본문 `.md` 마크다운 링크가 정적 export 시 404
- Sprint 161 Critic R2 P3 이월 해소: `splitTableRow` escaped pipe 처리
- Mermaid 코드펜스 ADR 렌더 활성화 — 기존 Mermaid 컴포넌트 재사용

## 결정

- **ID → URL 변환 + span fallback 패턴 채택**: `resolveAdrUrl(id, locale)` 헬퍼가 패턴 매칭 실패 시 null 반환 → 기존 span 유지. 404 anchor 생성 방지
- **rehype 플러그인 기반 링크 정규화**: parser.ts 메타 추출(`extractOutgoingLinks`)과 분리된 렌더 전용 변환. 책임 분리
- **null byte placeholder 패턴**: escaped pipe(`\|`) 처리에 `\x00PIPE\x00` 치환 → split → 복원. 일반 텍스트 충돌 불가
- **CodeBlock → Mermaid early return 분기**: `extractLanguage` 결과 `'mermaid'` 시 기존 `<Mermaid>` 컴포넌트(dynamic import, SSG 안전) 재사용. 신규 구현 0
- **Critic P2 데이터 정합성 해소**: sprint-67 `related_adrs: [ADR-004, ADR-005]` 미존재 ADR broken link → frontmatter 제거

## 구현 (단일 PR, 브랜치 `feat/sprint-162-adr-links-mermaid`, 5 commits)

| Phase | 담당 | 변경 | 라인 |
|-------|------|------|------|
| A — RelatedLinks anchor 변환 | architect | `adr-meta-sidebar.tsx` | +46 −6 |
| B — rehype 링크 정규화 | architect | `rehype-adr-link-rewrite.ts` 신규 + `markdown.ts` + `adr-detail-view.tsx` | +90 −2 |
| C — escaped pipe 처리 | architect | `parser.ts` | +5 −1 |
| D — Mermaid 활성화 | architect | `code-block.tsx` + `sprint-160.md` Mermaid 다이어그램 | +19 |
| Critic R1 P2 | architect | `sprint-67.md` KR+EN frontmatter | −2 |

### 세부 변경

1. **adr-meta-sidebar.tsx** (+46 −6): `resolveAdrUrl(id, locale)` 헬퍼 — sprint-NNN → `/adr/sprints/NNN/`, ADR-NNN → `/adr/permanent/NNN/`, 미지원 패턴 → null. `RelatedLinks`의 `<span>` → `<a>` anchor 변환 + 미지원 ID span fallback(graceful degradation). locale prop 추가
2. **rehype-adr-link-rewrite.ts** (+75, 신규): `unist-util-visit` 기반 rehype 플러그인. ADR 본문 `./sprint-NNN.md` / `./topics/SLUG.md` / `../adr-en/sprints/sprint-NNN.md` 상대 경로 → 정적 export URL 변환
3. **markdown.ts** (+13 −1): `renderAdrMdx(source, locale)` 시그니처 확장 + rehypePlugins 체인에 `[rehypeAdrLinkRewrite, { locale }]` 삽입(rehypeSlug 다음, rehypeHighlight 이전)
4. **adr-detail-view.tsx** (+2 −1): locale prop을 `renderAdrMdx`에 전달
5. **parser.ts** (+5 −1): `splitTableRow` — `\|` escaped pipe를 null byte placeholder(`\x00PIPE\x00`)로 치환 → split → 복원
6. **code-block.tsx** (+8): `extractLanguage` 결과 `'mermaid'` 시 `<Mermaid chart={chartSource} />` early return 분기
7. **docs/adr/sprints/sprint-160.md** (+11): Phase A→F 6단계 워크플로우 Mermaid 흐름도 추가
8. **docs/adr/sprints/sprint-67.md** (−1): 미존재 `ADR-004`, `ADR-005` 참조 제거 (Critic R1 P2)
9. **docs/adr-en/sprints/sprint-67.md** (−1): 동일 변경

## 검증

| 항목 | 결과 |
|------|------|
| tsc --noEmit | clean (0 errors) |
| npm run build | 247 페이지 정적 export 성공 |
| check-adr-en-coverage --strict | 110/110 (100.0%) PASS |
| check-doc-refs | 287 files 0 broken refs |
| Critic R1 (Codex, 세션 `019e3ec2-5445-70d0-96e3-9d71fa8d8640`) | P0/P1 0건, P2 1건(sprint-67 미존재 ADR) → 해소 (commit `23002cd`), P3 2건 → Sprint 163 이월 |
| Critic R2 (Codex, R2-sprint162-20260519) | PASS. R1 P2 해소 확인, 신규 P0/P1/P2 0건, P3 2건(기존) |

## 브랜치 규율 ✅ 30 스프린트 연속 준수

- 신규 브랜치 `feat/sprint-162-adr-links-mermaid` + Squash merge 예정
- main 직접 commit 0건, `--no-verify` 0건

## 신규 패턴

1. **ID → URL 변환 + span fallback 패턴** — `resolveAdrUrl`이 패턴 매칭 실패 시 null 반환 → 기존 span 유지. 404 anchor 생성 방지
2. **rehype 플러그인 기반 링크 정규화** — parser.ts 메타 추출(`extractOutgoingLinks`)과 분리된 렌더 전용 변환. 책임 분리
3. **null byte placeholder 패턴** — escaped pipe 처리에 `\x00` 사용으로 일반 텍스트 충돌 불가
4. **CodeBlock → Mermaid early return 분기** — 기존 Mermaid 컴포넌트(dynamic import, SSG 안전) 재사용. 신규 구현 0
5. **Critic P2 → 데이터 정합성 해소** — 코드 결함이 아닌 frontmatter 데이터 문제를 Critic이 검출. 코드 수정 아닌 데이터 수정으로 해소

## 교훈

1. **사용자 시각 검증이 최후 안전망** — Sprint 161 패턴 3 스프린트 연속 재확인 (159/160/161 모두 사용자 직접 검증에서 결함 추가 발견)
2. **rehype 플러그인은 마크다운 → HTML AST 단계에서 자연스러운 링크 정규화 도구** — parser.ts 전처리보다 렌더 체인 내 변환이 책임 분리에 적합
3. **존재하지 않는 리소스 참조는 anchor 변환 시 broken link 화** — fallback(span 유지) 또는 데이터 정합성(frontmatter 정리) 필수
4. **Mermaid SSG 안전성은 기존 컴포넌트 재사용으로 검증 비용 0** — `<Mermaid>` dynamic import가 이미 SSG 안전 보장

## Sprint 163 이월

- Critic R1 P3 2건: (1) 테스트 커버리지 (2) 기존 ADR Mermaid 다이어그램 확대 적용
- Sprint 163 범위: Phase D PR 표 분리 + 교훈/이월 callout 박스
- 기존 이월 항목 유지 (시드 #신규1~#신규7, #30/#31, #24/#26~#28 등)

## 관련 문서

- [sprint-161.md](./sprint-161.md) — 이전 sprint, 사용자 시각 검증 결함 발견 패턴 계승
- [sprint-160.md](./sprint-160.md) — Mermaid 흐름도 추가 대상
