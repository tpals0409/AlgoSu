---
sprint: 257
title: "추천 난이도 칩 플랫폼별 네이티브 라벨 (BOJ 티어 / 프로그래머스 Lv)"
date: "2026-07-23"
status: completed
agents: [Oracle]
related_adrs: ["sprint-256", "sprint-255"]
related_memory: ["sprint-window"]
topics: ["frontend", "recommendation", "i18n"]
tldr: "Sprint 256의 추천 난이도 선택 칩이 플랫폼과 무관하게 Bronze/Silver/Gold(solved.ac 티어명)로 고정되어, 프로그래머스 탭에서도 백준 티어명이 노출되던 라벨 부정합을 수정. 백준(solved.ac 티어)과 프로그래머스(Lv.1~5)는 난이도 체계가 다르므로 `difficultyChipLabel(platform, difficulty)`로 라벨을 플랫폼별 분기(BOJ→Bronze/Silver/Gold, PROGRAMMERS→Lv.1/Lv.2/Lv.3)한다. 전송 enum 값(BRONZE/SILVER/GOLD)은 동일하게 유지해 seed 밴드 매핑(Lv.1→BRONZE 등)과 BE 계약을 그대로 보존 — 순수 표시(display) 계층 변경이다. PR #487 `1263c3a0` (FE만, SearchStep 라벨 분기 + platform prop 배선 + 플랫폼별 라벨/enum 전송 테스트)."
---
# Sprint 257 — 추천 난이도 칩 플랫폼별 네이티브 라벨

_날짜: 2026-07-23_

## 목표

Sprint 256에서 신설한 추천 난이도 선택 칩은 라벨이 플랫폼과 무관하게 `Bronze/Silver/Gold`(solved.ac 티어명)로 고정돼 있었다. 백준과 프로그래머스는 난이도 체계가 다름에도(백준=solved.ac 티어, 프로그래머스=Lv.1~5) **프로그래머스 탭에서도 백준 티어명이 노출**되는 라벨 부정합이 있었다. 칩 라벨을 선택된 플랫폼의 네이티브 표기로 분기해 사용자 혼란을 제거한다.

**대상**
- PR #487 `1263c3a0` — `frontend` 추천 칩 라벨 플랫폼별 분기 (FE 전용)

**제약**: 표시 라벨만 바꾸고, 서버로 전송하는 난이도 enum 계약(BRONZE/SILVER/GOLD)과 seed 밴드 매핑은 절대 깨지 않는다(BE·데이터 무변경).

## 결정 사항

### D1. 라벨은 플랫폼별로 분기, 전송 enum은 불변 (#487)

`difficultyChipLabel(platform, difficulty)` 헬퍼를 도입해 칩 라벨을 플랫폼별로 분기한다:
- **BOJ**: `Bronze / Silver / Gold` (solved.ac 티어 명칭)
- **PROGRAMMERS**: `Lv.1 / Lv.2 / Lv.3` (프로그래머스 네이티브 레벨)

핵심은 **전송 값과 표시 값의 분리**다. 사용자에게 보이는 라벨만 플랫폼에 맞춰 바꾸고, 클릭 시 서버로 보내는 enum(BRONZE/SILVER/GOLD)은 동일하게 유지한다. 이로써 seed 밴드 매핑(Lv.1↔BRONZE 등)과 BE의 난이도 필터 계약이 무손상으로 보존되며, 변경 범위가 순수 표시(display) 계층에 국한된다.

## 구현

- `SearchStep.tsx`: `difficultyChipLabel(platform, d)` 라벨 분기 + `RecommendationSection`에 `platform` prop 배선
- `SearchStep.test.tsx`: 플랫폼별 라벨 검증(PROGRAMMERS=Lv 표기 / BOJ=티어명) + 칩 클릭 시 enum 전송이 플랫폼 무관하게 동일함을 단정

**검증(Oracle 직접 재검 — 자기보고 불신)**: 프론트 스위트에서 플랫폼별 라벨 렌더링과 enum 전송 불변성이 모두 green. PR origin/main 머지(squash).

## 이월

- [ ] 난이도 칩을 seed 3티어에서 플랫폼 네이티브 전체 티어로 확장 — Sprint 258
- [ ] 추천 **카드**(칩이 아닌 결과 항목) 난이도 라벨도 항목 플랫폼에 종속 — Sprint 258 (#489)

## 교훈

- **표시 값과 전송 값을 분리**하면 UI 국제화/현지화(플랫폼별 네이티브 표기)를 서버 계약을 건드리지 않고 안전하게 수행할 수 있다. enum은 SSOT로 고정, 라벨은 표현 계층에서 매핑한다.
