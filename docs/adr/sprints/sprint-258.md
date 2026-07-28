---
sprint: 258
title: "추천 난이도 칩 전체 티어 확장 + 추천 카드 라벨 플랫폼 종속"
date: "2026-07-24"
status: completed
agents: [Oracle]
related_adrs: ["sprint-257", "sprint-256"]
related_memory: ["sprint-window"]
topics: ["frontend", "recommendation"]
tldr: "Sprint 256의 보수적 3티어(Bronze/Silver/Gold) 노출을 BOJ Bronze~Diamond / 프로그래머스 Lv.1~5 전체 티어(5티어)로 확장. RUBY는 프로그래머스 대응 레벨(Lv.6)이 없어 제외. `RECOMMENDABLE_DIFFICULTIES`에 PLATINUM/DIAMOND 추가 + `PROGRAMMERS_LEVEL_BY_DIFFICULTY`에 Lv.4→PLATINUM/Lv.5→DIAMOND 매핑 추가(Gateway levelToDifficulty와 1:1 정합). 상위 티어는 정적 seed 조작 없이 cross-study 실데이터로 서빙하고 없으면 우아한 빈상태를 안내해 데이터 정합성을 유지. 이어 추천 **카드**(결과 항목)의 난이도 라벨도 항목 자체 플랫폼 기준으로 분기(BOJ→티어, 프로그래머스→Lv.N). PR #488 `43d4307a`(칩 전체티어) + PR #489 `a16d3b27`(카드 라벨 종속)."
---
# Sprint 258 — 추천 난이도 칩 전체 티어 확장 + 추천 카드 라벨 플랫폼 종속

_날짜: 2026-07-24_

## 목표

Sprint 256은 seed 커버 범위(3티어)만 노출하는 보수적 결정으로 빈 추천을 막았다. 이제 추천 난이도 선택 범위를 **플랫폼 네이티브 전체 티어**로 확장한다. 아울러 Sprint 257이 선택 **칩** 라벨을 플랫폼별로 분기한 데 이어, 추천 **카드**(결과 항목)의 난이도 라벨도 항목 플랫폼에 종속시켜 표기 일관성을 완성한다.

**대상**
- PR #488 `43d4307a` — 추천 난이도 칩 전체 티어 확장 (Bronze~Diamond / Lv.1~5)
- PR #489 `a16d3b27` — 추천 카드 난이도 라벨을 항목 플랫폼에 종속

## 결정 사항

### D1. 선택 칩을 5티어로 확장, RUBY 제외 (#488)

`RECOMMENDABLE_DIFFICULTIES`에 PLATINUM/DIAMOND를 추가해 3티어 → **5티어**로 확장한다. `PROGRAMMERS_LEVEL_BY_DIFFICULTY`에 `Lv.4→PLATINUM`, `Lv.5→DIAMOND` 매핑을 추가하되, **Gateway의 `levelToDifficulty`와 1:1 정합**을 유지해 저장/검색/추천 필터가 동일 enum을 공유하게 한다. **RUBY는 프로그래머스에 대응 레벨(Lv.6)이 없어 제외** — 양 플랫폼에 모두 대응 가능한 티어까지만 노출한다.

### D2. 상위 티어는 실데이터 서빙 + 우아한 빈상태 (정적 seed 무조작) (#488)

확장한 상위 티어(PLATINUM/DIAMOND)는 **정적 seed를 억지로 채우지 않고** cross-study 실데이터로 서빙한다. 해당 티어 실데이터가 없으면 우아한 빈상태를 안내한다. Sprint 256이 "seed 미커버 티어는 감춘다"로 빈 추천을 막았다면, Sprint 258은 "노출하되 데이터가 없으면 정직하게 빈상태를 보인다"로 전환 — 근거 없는 seed 라벨링을 피하고 데이터 정합성을 우선한다.

### D3. 추천 카드 라벨도 항목 플랫폼에 종속 (#489)

Sprint 257이 선택 **칩** 라벨을 플랫폼별로 분기했으나, 추천 결과 **카드**의 난이도 라벨은 여전히 혼재돼 있었다. 카드 라벨 렌더링을 **항목 자체의 플랫폼 기준**으로 분기한다(BOJ 항목=solved.ac 티어, 프로그래머스 항목=Lv.N). 플랫폼 판별 헬퍼를 `problem-search.utils.ts`에서 export해 재사용한다.

## 구현

- **#488**: `SearchStep.tsx` `RECOMMENDABLE_DIFFICULTIES` PLATINUM/DIAMOND 추가 + `PROGRAMMERS_LEVEL_BY_DIFFICULTY` Lv.4/Lv.5 매핑 + `SearchStep.test.tsx` 전체티어 케이스
- **#489**: `SearchStep.tsx` 카드 라벨 항목 플랫폼별 분기 + `problem-search.utils.ts` 플랫폼 판별 헬퍼 export + `SearchStep.test.tsx` 플랫폼별 라벨 케이스 2건

**검증(Oracle 직접 재검 — 자기보고 불신)**: #488 tsc 신규에러 0·ESLint Error 0·jest 22+31 pass·next build exit 0. #489 플랫폼별 카드 라벨 스위트 green. 두 PR 모두 origin/main 머지(squash).

## 이월

- [ ] BOJ 추천 seed 목록 실제 대표성 재검토 (Sprint 255부터 이월 지속) — Sprint 264에서 처리

## 교훈

- **UI 노출 범위 확장은 데이터 정직성과 함께 간다**: 상위 티어를 노출하되 정적 seed를 조작하지 않고 실데이터/빈상태로 처리해, 근거 없는 라벨링 없이 정합성을 지킨다.
- **enum 정합은 서비스 경계를 가로질러 유지**한다: FE 매핑(Lv↔Difficulty)을 Gateway `levelToDifficulty`와 1:1로 맞춰 저장/검색/추천이 같은 값을 공유한다.
- **표기 일관성은 칩과 카드 양쪽에서 완성**된다: 선택 UI(칩)만 고치면 결과 UI(카드)에 부정합이 남는다 — 표시 계층 전반을 함께 정렬한다.
