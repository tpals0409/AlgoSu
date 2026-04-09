---
sprint: 66
title: "인앱 알림 로직 검증 & FEEDBACK_RESOLVED 전파 수정"
date: "2026-04-09"
status: completed
agents: [Oracle, Scout]
related_adrs: []
---

# Sprint 66: 인앱 알림 로직 검증 & FEEDBACK_RESOLVED 전파 수정

## Decisions
### D1: FEEDBACK_RESOLVED 타입 3-tier 동기화
- **Context**: Sprint 64에서 Identity 엔티티에 FEEDBACK_RESOLVED를 추가했으나 Gateway enum, Frontend type/아이콘에 전파되지 않아 피드백 해결 알림이 타입 불일치 + 기본 Bell 아이콘으로만 표시됨
- **Choice**: Gateway enum, Frontend Notification type union, NotificationBell TYPE_ICON/TYPE_ROUTE, NotificationToast TYPE_ICON에 일괄 반영
- **Alternatives**: 없음
- **Code Paths**: `services/gateway/src/common/types/identity.types.ts`, `frontend/src/lib/api.ts`, `frontend/src/components/layout/NotificationBell.tsx`, `frontend/src/components/ui/NotificationToast.tsx`

## Patterns
### P1: NotificationType enum 추가 시 전파 체크리스트
- **Where**: Identity entity → Gateway types → Frontend api.ts → NotificationBell (TYPE_ICON, TYPE_ROUTE) → NotificationToast (TYPE_ICON)
- **When to Reuse**: 새 알림 타입을 추가할 때마다 5개 파일을 모두 갱신해야 함

## Gotchas
### G1: enum 추가 시 다중 레이어 전파 누락
- **Symptom**: 피드백 해결 알림이 프론트엔드에서 기본 Bell 아이콘으로 표시되고 FEEDBACK_RESOLVED 라우트 미지정
- **Root Cause**: Identity 엔티티에만 enum을 추가하고 Gateway/Frontend 동기화를 빠뜨림
- **Fix**: P1 체크리스트를 따라 5개 파일 일괄 갱신. 향후 새 타입 추가 시 동일 패턴 적용 필수

### G2: NotificationToast TYPE_ICON 불완전
- **Symptom**: DEADLINE_REMINDER, MEMBER_JOINED, MEMBER_LEFT, STUDY_CLOSED 4종이 NotificationToast에서 Bell fallback 아이콘으로 표시
- **Root Cause**: NotificationBell에는 9종 아이콘을 등록했으나 NotificationToast에는 5종만 등록 (초기 구현 시 누락)
- **Fix**: NotificationToast TYPE_ICON에 누락 5종 + FEEDBACK_RESOLVED 추가 (총 10종 완전 대응)

## Metrics
- Commits: 1건, Files changed: 7개
