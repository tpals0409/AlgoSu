---
sprint: 93
title: "주차별 제출현황·통계 기능 수정"
date: "2026-04-16"
status: completed
---

# Sprint 93 — 주차별 제출현황·통계 기능 수정

## 목표
사용자 보고된 버그 2건 수정:
1. 주차별 제출현황에서 이전 주차 데이터가 안 보임
2. 통계 페이지에 데이터가 전혀 표시되지 않음

## 버그 분석

### 근본 원인 (공통)
Gateway의 `fetchActiveProblemIds()`가 Problem Service의 `/internal/active-ids/:studyId`를 호출하며, 이 엔드포인트는 **ACTIVE 상태 문제만** 반환했다. Submission Service는 이 ID 목록을 받아 제출 통계를 집계하므로, **마감된 CLOSED 문제의 제출은 통계·주차별 현황에서 완전히 누락**되었다.

### 극단적 케이스
스터디의 모든 문제가 CLOSED 상태(마감 완료)인 경우:
- `activeProblemIds.length === 0`
- Submission Service는 모든 통계 필드를 빈 배열로 반환 (submission.service.ts:292-305)
- 결과: 통계 페이지가 완전히 빈 상태

## 작업 요약
| 커밋 | 내용 |
|------|------|
| `1179baf` | `fix(problem)`: 통계 집계 시 CLOSED 문제 누락 — findAllByStudy로 전환 |

## 수정 내용
- `services/problem/src/problem/internal-problem.controller.ts` — `/internal/active-ids/:studyId` 핸들러가 `findAllByStudy()` 호출로 변경 (ACTIVE + CLOSED 반환, DELETED만 제외)
- `services/gateway/src/study/study.service.ts` — 주석 및 변수명 의미 갱신 ("통계 대상 문제 ID")
- 테스트: 기대값을 "ACTIVE + CLOSED" 반환으로 갱신

## 결정
- **기존 엔드포인트 재사용**: 새 엔드포인트(`/visible-ids`)를 추가하지 않고 기존 `/active-ids`의 의미를 확장 (ACTIVE + CLOSED). 엔드포인트를 사용하는 유일한 클라이언트가 Gateway stats뿐이므로 간단한 변경이 안전하다.
- **DELETED만 제외**: DELETED 상태 문제는 soft delete 처리되므로 통계 집계에서 제외해야 한다. ACTIVE/CLOSED는 실제 풀었던 문제이므로 포함.

## 교훈
- 상태 필터는 **의도를 명시**해야 함 — "ACTIVE만"과 "유효한 문제(ACTIVE+CLOSED)"는 전혀 다른 의미이며, 엔드포인트 이름이 이를 반영해야 한다
- 시간이 지나면서 마감된 문제(CLOSED)가 누적되는 시스템에서는, ACTIVE 필터가 기본값인 것이 심각한 데이터 누락으로 이어질 수 있음
- 이전 스프린트의 상태 필터 로직 검토 시 "왜 ACTIVE만?"을 반드시 질문해야 함
