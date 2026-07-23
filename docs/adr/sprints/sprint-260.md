---
sprint: 260
title: "프로그래머스 추천 시드 12→34선 보강 — Lv.1~5 전 구간 커버"
date: "2026-07-23"
status: completed
agents: [Oracle]
related_adrs: ["sprint-254", "sprint-255"]
related_memory: ["sprint-window"]
topics: ["problem", "recommendation", "seed", "cold-start"]
tldr: "추천 콜드스타트(등록 문제 0개 또는 cross-study 부족 시 Tier3 폴백)용 정적 시드 `recommendation-seeds.ts`의 프로그래머스 항목을 12선→34선으로 보강. 1차로 Lv.1/2/3 각 8선(24선)으로 균형 증량, 이어 비어 있던 상위 난이도를 Lv.4(PLATINUM)×6 / Lv.5(DIAMOND)×4로 신설해 Lv.1~5 전 구간을 커버. 레벨은 SPA HTML에 미노출이라 추측 대신 gateway `data/programmers-problems.json`(크롤러 689문제 데이터셋)의 `level` 필드를 SSOT로 확정. `difficulty` 필드는 gateway `levelToDifficulty`(Lv.1~5→BRONZE~DIAMOND) 정본 매핑의 내부 정규화값(추천 필터 키·뱃지 색상용)일 뿐 화면 라벨은 FE `DifficultyBadge`가 `Lv.N`으로 표기. 소비부·테스트 무변경(limit 슬라이스), 외부 API 0. jest 77/77·ESLint clean·Critic(Codex gpt-5.5) CLEAN. PR #495 `960db90`."
---
# Sprint 260 — 프로그래머스 추천 시드 12→34선 보강

_날짜: 2026-07-23_

## 목표

추천 콜드스타트 폴백(신규 스터디 등록 문제 0개 또는 cross-study 풀이 부족 시 Tier3에서 사용하는 정적 시드)의 **프로그래머스 문제 수를 보강**한다. 기존 12선은 Lv.1/2/3만 얕게 커버해 상위 난이도(Lv.4·Lv.5)가 전무했으므로, 전 난이도 구간을 대표 문제로 채운다.

**대상**: `services/problem/src/problem/recommendation-seeds.ts` (Tier3 콜드스타트 정적 시드, constant 레이어)
**제약**: 시드는 실제 프로그래머스 lesson이어야 하며(허위 링크 금지), 레벨 표기는 검증 가능한 정본에 근거해야 한다.

## 결정 사항

### D1. 시드 풀만 확장, 소비부 무변경 (증설 안전)

소비부(`problem.service.ts`)는 플랫폼·난이도 필터 후 셔플→`limit` 슬라이스 방식으로 개수 하드코딩이 없다. 테스트도 요청 `limit`(8/5/3) 슬라이스 기반 카운트만 검증한다. 따라서 시드 배열 증설은 소비 로직·테스트를 건드리지 않고 안전하게 반영된다. 실제로 12→24→34선 두 차례 증설 모두 `problem.service.spec` 77/77을 무변경으로 통과했다.

### D2. 레벨 정확도 = 크롤러 데이터셋 SSOT로 확정 (추측 금지)

프로그래머스는 SPA라 lesson HTML에서 난이도 레벨이 렌더되지 않는다. HTTP 200 + `<title>` 정합은 lesson 실재·제목만 증명할 뿐 레벨은 증명하지 못한다. 상위 난이도(Lv.4/5) 시드를 임의 매핑으로 박으면 허위 레벨이 되므로, gateway `services/gateway/data/programmers-problems.json`(크롤러가 생성한 689문제 데이터셋)의 `level` 필드를 레벨 SSOT로 사용해 Lv.4/Lv.5 후보를 확정했다(데이터셋 내 Lv.4=45개·Lv.5=21개 중 대표 문제 선정).

### D3. `difficulty`는 내부 정규화값 — 화면 라벨과 구분

시드의 `difficulty`(BRONZE~DIAMOND)는 gateway `levelToDifficulty`(`programmers.service.ts`, Lv.1→BRONZE·Lv.2→SILVER·Lv.3→GOLD·Lv.4→PLATINUM·Lv.5→DIAMOND) 정본 매핑과 **정확히 일치**하는 내부 정규화값이다. 용도는 (1) 추천 난이도 필터 키, (2) 뱃지 색상 결정뿐이며, 화면 라벨은 FE `DifficultyBadge`가 플랫폼 인지형으로 프로그래머스는 `PROGRAMMERS_LEVEL_LABELS[level]` → `Lv.N`으로 표기한다. 즉 BRONZE/SILVER/GOLD 텍스트는 사용자에게 노출되지 않는다.

## 구현

- `recommendation-seeds.ts` 프로그래머스 시드 **12 → 34선**:
  - Lv.1×8 / Lv.2×8 / Lv.3×8 (1차, 균형 증량)
  - **Lv.4(PLATINUM)×6 / Lv.5(DIAMOND)×4** (2차, 상위 난이도 신설) → Lv.1~5 전 구간 커버
- 각 항목 `level`=프로그래머스 Lv 숫자, `difficulty`=`levelToDifficulty(level)` 정본값, `sourceUrl`=실제 lesson URL
- 파일 헤더/섹션 주석을 Lv 우선으로 정정 — `difficulty`가 내부 매핑값임을 명시
- 소비부(`problem.service.ts`)·백준 시드·추천 응답 투영 로직 **무변경**, 외부 API 호출 0

**검증(Oracle 직접 재검 — 자기보고 불신)**: `problem.service.spec` 77/77 통과(ts-jest 컴파일 타입검사 겸함), ESLint exit 0(경고 0). 시드 실재·제목은 lesson HTTP 200 + title 정합, 레벨은 크롤러 데이터셋 `level` 필드 대조로 확정.

**Critic(Codex gpt-5.5, base `b6b6794`, 백그라운드 PTY 래퍼)**: Findings 0건 — "static recommendation seed list 확장과 테스트 주석 조정뿐, 이 diff가 유발한 correctness 이슈 없음" 판정. CLEAN → 자동머지(`--squash --auto`)로 CI 그린 시 머지(`960db90`, PR #495).

## 인시던트

1. **보고 문구 오도**: 1차 보강 보고에서 티어명(BRONZE/SILVER/GOLD)을 프로그래머스 난이도처럼 표현 → 사용자 지적. 프로그래머스는 Lv 체계이고 티어는 내부 매핑값. 코드·데이터는 무결(정본 매핑 일치), 정정 대상은 보고 문구와 파일 주석뿐이었다.
2. **1차 보강의 범위 누락**: "문제 수 보강"을 Lv.1~3 증량으로만 해석해 비어 있던 Lv.4/5를 방치 → 사용자 지적("4,5 문제가 전혀 없었어. 보강된거야?") 후 2차로 Lv.4/5 추가.
3. **Critic ACP `.done` 마커 미생성**: 백그라운드 PTY 래퍼가 CLEAN 판정을 로그에 남기고 정상 종료했으나 ACP 제약으로 `.done` 마커 미기록 → watchdog 크론 자동 알림 미발생 → Oracle이 로그 직접 판독으로 종결(Sprint 251·254 동형 제약).
4. **stale sprint-window + 병렬 세션**: 세션 진입 시 윈도우가 254에 5스프린트 stale, 실제 레포는 255~259 머지 완료. 본 작업은 sprint 번호 미부여 독립 feature로 진행 후 종료 시 260으로 마감. 256~259 회고 ADR 공백은 병렬 세션 소관으로 명시(본 세션 재구성 안 함 — 위조 방지).

## 이월

- [ ] BOJ 추천 seed 목록 실제 대표성 재검토 (Sprint 255 이월 지속 — Oracle 판단 초안, 교체 여지)
- [ ] 256~259 회고 ADR 공백 — 병렬 Oracle 세션 소관(본 세션 관할 아님)

## 교훈

- **프로그래머스는 Lv 체계(Lv.0~5), BRONZE/SILVER/GOLD는 백준/solved.ac 티어**다. 코드의 `difficulty` 필드는 gateway `levelToDifficulty`가 산출하는 내부 정규화값(필터 키·색상용)일 뿐이며 화면 라벨(`Lv.N`)과 혼동해 보고하지 말 것.
- **레벨처럼 검증 불가한 속성은 추측 금지 — 검증 가능한 SSOT로 확정**한다. SPA HTML에 없는 값은 크롤러 데이터셋(`programmers-problems.json`) 등 정본을 찾아 대조.
- **"문제 수 보강" 같은 모호 지시는 전 구간 커버 여부를 명시 확인**한다. 1차에서 기존 난이도만 증량하고 비어 있던 상위 구간을 방치하는 실수를 반복하지 말 것.
