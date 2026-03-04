# AlgoSu UI v2 실행 계획서 요약

> 원본: `/root/AlgoSu/docs/AlgoSu_UIv2_실행계획서.md`

## Overview
- 14개 토픽, 80+ 결정사항
- 백엔드 ~25개 작업 + 프론트엔드 9페이지 + 공통 컴포넌트 13종
- TF 11명 전원 투입, Sprint 6개 (UI-1 ~ UI-6)

## Sprint 순서
```
3-1 Contract → UI-1 Backend Foundation → UI-2 Backend Features → UI-3 Frontend Core → UI-4 Frontend Pages → UI-5 Code Review → UI-6 Integration
병렬: 3-2 Submission DB (UI-2) → 3-3 Identity DB (UI-3)
```

## Sprint 핵심 목표
- **UI-1**: UUID + httpOnly Cookie + CORS + MinIO + ExceptionFilter + 보안 (9개 작업)
- **UI-2**: 알림 9종 + AI 정책 + Monaco + 프로필 + 스터디 정책 (8개 작업)
- **UI-3**: 디자인 시스템 + 공통 컴포넌트 + Landing/Login/Dashboard (6개 작업)
- **UI-4**: Problems + Submissions + Study/Profile + Notifications (5개 작업)
- **UI-5**: Review API + 스터디룸 UI + 전환 페이지 (7개 작업)
- **UI-6**: 매칭 + 운영 강화 + 테스트 + 배포 + 레거시 25건 (5개 작업)

## 신규 마이그레이션 11개
1-5: UUID publicId (Users/Studies/Problems/Submissions/Notifications)
6-9: ENUM 확장, groundRules, isLate, nickname
10-11: ReviewTables, StudyNotes

## 신규 API 12개
- AI quota, ground-rules, avatar, reviews (CRUD 6개), replies (2개), notes (2개), read-all notifications
- 모든 기존 API: auto-increment ID → UUID publicId 전환

## 리스크 HIGH
- R1: UUID 전환 API 호환성 → 전환 기간 ID/UUID 양쪽 수용
- R2: httpOnly Cookie 인증 중단 → 동시 전환 + 롤백 계획
- R3: 디자인 시스템 회귀 → 순차 적용 + 스크린샷 검증

## 성공 기준
9페이지 v2, 47 컬러 토큰 듀얼 테마, 13 컴포넌트, httpOnly+UUID+CORS+CSP, 알림 9종, AI highlights 5카테고리, Review API 6개, 커버리지 70%, SLO 99.5%
