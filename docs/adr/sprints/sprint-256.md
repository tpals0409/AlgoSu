---
sprint: 256
title: "문제 추천 난이도 선택 기능 + Trivy HIGH CVE 해소"
date: "2026-07-22"
status: completed
agents: [Oracle]
related_adrs: ["sprint-255", "sprint-254"]
related_memory: ["sprint-window"]
topics: ["frontend", "problem", "recommendation", "security", "ci"]
tldr: "Sprint 255의 플랫폼 토글 종속 추천에 이어, 사용자가 난이도를 직접 선택해 추천받는 기능을 신설. 기존에는 스터디 자체 문제에서 난이도를 추론만 했으나 이제 명시 선택 가능 — BE `RecommendQueryDto.difficulty`(@IsIn Difficulty 6티어) 파라미터 + `recommendForStudy`가 선택 시 추론을 무시하고 해당 난이도로 cross-study 후보 + Tier3 seed 필터, 미지정 시 기존 추론 계약 유지(하위 호환). FE는 추천 섹션에 난이도 선택 칩(자동 + Bronze/Silver/Gold)을 추가하되 seed 커버 3티어만 노출해 빈 추천을 방지하고 같은 칩 재클릭 시 자동 토글, `platform+difficulty` 조합을 훅 리셋 키로 사용. 이어 전이 CVE 드리프트로 실패하던 `Trivy Scan — frontend`를 sharp `^0.35.3`/fast-uri `^3.1.4` overrides로 해소해 배포 게이트를 언블록(기능 코드 무관). PR #484 `3f6212c2`(BE 266 pass cov 99.2%/97.3%) + PR #485 `bf006748`(tsc clean·jest 1812·next build exit 0)."
---
# Sprint 256 — 문제 추천 난이도 선택 기능 + Trivy HIGH CVE 해소

_날짜: 2026-07-22_

## 목표

Sprint 255에서 추천을 문제 추가 모달의 플랫폼 토글에 종속시킨 데 이어, 사용자가 **추천 난이도를 직접 선택**할 수 있게 한다. 기존 추천은 스터디의 자체 문제에서 난이도를 추론만 했으므로, 원하는 난이도를 명시 선택하는 경로를 신설한다. 아울러 전이 의존성 CVE 드리프트로 실패한 프론트엔드 Trivy 게이트를 해소해 배포 갭(Sprint 255 D1 동형)을 예방한다.

**대상**
- PR #484 `3f6212c2` — `services/problem` BE + `frontend` 난이도 선택 기능
- PR #485 `bf006748` — `frontend/package.json` overrides로 Trivy HIGH CVE 해소

**제약**: 난이도 미지정 시 기존 추론 계약을 깨지 않아야 한다(하위 호환). 노출 칩은 실제 서빙 가능한(seed 커버) 티어만 보여 빈 추천을 만들지 않아야 한다.

## 결정 사항

### D1. 난이도 명시 선택을 추론과 병존시킨다 (하위 호환) (#484)

`RecommendQueryDto`에 `difficulty?` 파라미터를 추가(@IsIn으로 Difficulty enum 6티어 검증)하고, 컨트롤러가 이를 `recommendForStudy`로 위임한다. `recommendForStudy`는 `difficulty` 인자를 받아 **선택 시 스터디 추론을 무시하고** 해당 난이도로 cross-study 후보 조회 + Tier3 시드 폴백을 필터한다. **미지정 시에는 기존 추론 계약을 그대로 유지**해 하위 호환을 보장한다. 즉 새 파라미터는 순수 확장이며 기존 호출부에 영향이 없다.

### D2. 노출 칩은 seed 커버 3티어로 제한, 재클릭 자동 토글 (#484)

FE 추천 섹션에 난이도 선택 칩(자동 + Bronze/Silver/Gold)을 추가한다. 이 시점의 정적 seed가 커버하는 티어가 3티어뿐이므로, **커버되는 3티어만 노출해 빈 추천을 방지**한다(상위 티어 확장은 Sprint 258로 이월). 같은 칩을 재클릭하면 자동(추론) 모드로 토글되어 선택을 해제할 수 있다. 훅은 `platform+difficulty` 조합을 리셋 키로 사용해 조합 변경 시 노출 이력을 리셋·재조회한다.

### D3. Trivy 전이 CVE는 overrides로 실보안 해소, 게이트 언블록 (#485)

프론트엔드 `Trivy Scan — frontend` 잡이 **기능 무관 전이 CVE 드리프트**로 실패했다:
- next 중첩 `sharp@0.34.5` → GHSA-f88m-g3jw-g9cj (libvips, 0.35.0 수정)
- ajv 전이 `fast-uri@3.1.2` → CVE-2026-13676/16221 (3.1.4 수정)

`.trivyignore` 임시 억제 대신 `frontend/package.json` overrides로 `sharp ^0.35.3` / `fast-uri ^3.1.4`를 강제(실보안 해소 + 언블록 동시)한다. Sprint 255 D1의 배포 갭 교훈(서비스별 fail-closed 게이트가 전이 CVE 드리프트에도 배포를 막는다)을 선제 적용한 것으로, 난이도 기능 코드와는 무관한 정지(orthogonal) 변경이다.

## 구현

- **#484**:
  - BE(`services/problem`): `recommend-query.dto.ts` `difficulty?`(@IsIn 6티어) + `problem.controller.ts` 위임 1줄 + `problem.service.ts` `recommendForStudy` difficulty 필터(cross-study + Tier3 seed)
  - FE: `problem.ts` `getRecommendations`/`buildRecommendationQuery` difficulty 직렬화, `use-problem-recommendation.ts` difficulty 옵션 + `platform+difficulty` 리셋 키, `SearchStep.tsx` 난이도 선택 칩(자동+3티어, 재클릭 토글), `messages/{ko,en}/problems.json` `difficultyAria`/`difficultyAuto` 키
- **#485**: `frontend/package.json` overrides `sharp ^0.35.3` / `fast-uri ^3.1.4` (+ `package-lock.json` 재생성)

**검증(Oracle 직접 재검 — 자기보고 불신)**: #484 BE 266 통과(커버리지 99.2%/97.3%), FE 관련 스위트(DTO 6티어+무효, service 선택/신규스터디/seed필터/하위호환, controller passthrough, hook 전달/리셋, SearchStep 칩렌더/재조회/토글, api 쿼리직렬화) green. #485 tsc clean·jest 1812 pass·next build exit 0. 두 PR 모두 origin/main 머지(squash).

## 인시던트

1. **전이 CVE 드리프트로 인한 게이트 실패**: 난이도 기능과 무관한 sharp/fast-uri 전이 CVE가 신규 공표되며 frontend Trivy 게이트를 막았다. Sprint 255에서 problem-service가 겪은 배포 갭과 동형 — overrides 실보안 해소로 즉시 언블록해 갭을 예방했다.
2. **빈 추천 위험**: 6티어 전체를 칩으로 노출하면 seed 미커버 상위 티어에서 빈 추천이 뜰 수 있어, 이 시점엔 커버 3티어만 노출하는 보수적 결정을 내렸다(전체 티어 확장은 Sprint 258로 분리).

## 이월

- [ ] 추천 난이도 칩을 플랫폼별 네이티브 라벨(BOJ 티어 / 프로그래머스 Lv)로 분기 — Sprint 257
- [ ] 난이도 칩을 seed 3티어에서 플랫폼 네이티브 전체 티어로 확장 — Sprint 258
- [ ] BOJ 추천 seed 목록 실제 대표성 재검토 (Sprint 255 이월 지속)

## 교훈

- **신규 파라미터는 미지정 시 기존 계약을 보존하는 순수 확장으로 설계**한다. `difficulty` 미지정 = 기존 추론이라는 하위 호환 규약이 기존 호출부를 무손상으로 지킨다.
- **UI 선택지는 실제 서빙 가능한 범위로 제한**해 빈 결과를 원천 차단한다. seed 커버가 3티어면 3티어만 노출하고, 확장은 데이터가 준비될 때(Sprint 258) 분리한다.
- **전이 CVE 드리프트는 기능 PR과 무관하게 배포 게이트를 막는다**: Sprint 255의 배포 갭 교훈대로 `.trivyignore` 억제가 아닌 overrides 실보안 해소로 즉시 언블록해 갭을 예방한다.
