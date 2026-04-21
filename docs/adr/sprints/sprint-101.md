---
sprint: 101
title: "잔여 항목 처리 — Register 3종 생성 + 문서 정리"
date: "2026-04-21"
status: completed
---

# Sprint 101 — 잔여 항목 처리: Register 3종 생성 + 문서 정리

## 배경
Sprint 99 완료 후 이월된 항목과 MEMORY.md "후속 처리 필요" 목록이 실제 코드 상태와 어긋나 있었다. 코드 탐색 결과 NotFound UI 이식, H5 검색 UX, SolvedProblem→Submission 리네이밍은 이미 완료 상태였으며, Register 3종(`/register`, `/register/profile`, `/register/github`)은 "이식"이 아니라 라우트 자체가 부재한 "신규 생성" 상태였다.

## 목표
1. Register 온보딩 3종 페이지 신규 생성 (Login UI 패턴 답습)
2. MEMORY.md/sprint-window.md 잔여 목록을 실상에 맞게 정리
3. 이미 완료된 이월 항목을 문서에서 공식 제거

## 작업 요약
| 커밋 | 담당 | 내용 |
|---|---|---|
| `a12b4f1` (PR #100) | Oracle + scribe | Register 3종 페이지 신규 생성 (+853 lines) |
| `ac5668a` (PR #101) | Oracle + librarian | Sprint 99~101 ADR 정비 및 잔여 목록 정리 |

## 수정 내용

### 신규 생성 파일
- `frontend/src/app/(auth)/register/page.tsx` — 온보딩 1단계: OAuth 가입 (Google/Naver/Kakao + 데모)
- `frontend/src/app/(auth)/register/profile/page.tsx` — 온보딩 2단계: 아바타 프리셋 선택 (AVATAR_PRESETS 15종)
- `frontend/src/app/(auth)/register/github/page.tsx` — 온보딩 3단계: GitHub 연동 선택

### 공통 설계
- Login 페이지 UI 패턴 완전 답습: glass-nav, hero-glow, fade 애니메이션, footer
- OnboardingStepper (인라인): 3단계 진행도 표시 (가입 · 프로필 · GitHub)
- 인증 가드: 미인증 시 /login replace, 인증 완료 시 /studies replace
- 기존 callback 흐름 수정 없음 (독립 경로로 존재)
- 재사용: Logo, Alert, Button, InlineSpinner, AVATAR_PRESETS

### 문서 정리
- MEMORY.md: NotFound/Register 항목 제거 → SWR/Redis/tags 실제 미처리분으로 교체
- sprint-window.md: Sprint 100 이월 항목 현실 반영 (4건 완료 처리, 3건 유지)

## 검증 결과
| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `next lint` | ✅ 0 errors (6 warnings — fade/hero-glow 인라인, Login 동일 패턴) |
| `next build` | ✅ /register, /register/profile, /register/github 정적 생성 확인 |

## 결정
- **Register는 "신규 생성" 처리**: 기존에 "UI 이식"으로 분류되어 있었으나 라우트 자체 부재 확인 → 신규 생성으로 전환
- **callback 수정 범위 제외**: 기존 OAuth 콜백 흐름(`/callback#github_connected=false`)은 정상 동작 중이므로 스코프 밖 유지
- **OnboardingStepper 인라인**: 공통 컴포넌트 추출은 향후 스프린트로 보류 (components/ui/ Palette 가이드 없이 생성 금지 규칙)
- **이월 항목 코드 검증 의무화**: Sprint 99 사례처럼 "문서에 미처리로 남아있지만 코드에는 이미 반영" 상황 방지를 위해 /start 시 이월 항목 코드 존재 확인 프로세스 권장

## 주요 교훈
- 이월 항목은 문서만 믿지 말고 코드로 실상 재검증 필요. NotFound/H5 검색/SolvedProblem이 실제로는 이미 완료 상태였음
- "UI 이식"으로 분류된 항목도 라우트 자체 부재 가능성 검증 필요 (Register 3종 사례)
- OAuth 전용 구조에서도 Register 경로는 가입 CTA + 온보딩 단계 분리로 가치 있음 (callback 수정 없이 독립 경로 유지)

## 이월 (Sprint 102+)
- SWR/React Query 도입 (프론트 데이터 페칭 표준화)
- Redis 통계 캐시 (대시보드 통계)
- problem.tags JSON 컬럼 전환 + seed 데이터 확충
