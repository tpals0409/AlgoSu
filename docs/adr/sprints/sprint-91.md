---
sprint: 91
title: "이월항목 수행"
date: "2026-04-16"
status: completed
---

# Sprint 91 — 이월항목 수행

## 목표
Sprint 90 코드리뷰에서 발견된 이월 기술 부채(Backend @file 헤더 누락, Frontend 인라인 style)를 해소한다.

## 작업 요약

### Wave 1: Backend @file 헤더 일괄 추가 (69파일)
| 커밋 | 서비스 | 파일 수 |
|------|--------|--------|
| `596de4c` | identity | 17 |
| `2f6c279` | gateway | 9 |
| `1f74c8b` | github-worker | 1 |
| `4f0266e` | problem | 21 |
| `443e8ba` | submission | 21 |

### Wave 2: Frontend 인라인 style → Tailwind 전환
| 커밋 | 대상 파일 | 전환 건수 | 유지 건수 |
|------|----------|----------|----------|
| `0f4c770` | analysis, settings, profile | 51건 | 21건 (동적 값) |
| `5baaf23` | shared/[token], admin/feedbacks | ~105건 | 12건 (동적 값) |

## 결정
- 동적 값(`fade()`, `barColor()`, 런타임 계산 색상 등)은 인라인 style 유지 — Tailwind로 전환 불가
- Frontend @file 헤더 133건은 다음 스프린트로 이월 — boilerplate 파일 多, 우선순위 낮음
- Backend 거대 함수 분리(getStudyStats 197줄 등)는 구조적 리팩토링으로 별도 스프린트 필요

## 교훈
- @file 헤더 일괄 추가는 기계적이지만 파일별 역할 파악이 필요 — 완전 자동화는 어려움
- CSS 변수 참조(`var(--xxx)`)를 Tailwind arbitrary value(`[var(--xxx)]`)로 전환하면 인라인 style을 대폭 줄일 수 있음
- 동적 애니메이션/런타임 계산 값은 인라인 style이 불가피 — 주석으로 사유 명시
