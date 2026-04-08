---
sprint: 62
title: "관리자 페이지 & 피드백 로직 점검"
date: "2026-04-08"
status: completed
agents: [Gatekeeper, Librarian]
related_adrs: []
---

# Sprint 62: 관리자 페이지 & 피드백 로직 점검

## Decisions
### D1: 피드백 status 필터를 서버 사이드로 전환
- **Context**: 기존 Admin 피드백 페이지는 status 필터를 클라이언트에서 처리했으나, 서버 페이지네이션(20건/페이지)과 충돌하여 다른 페이지의 해당 상태 피드백이 누락되는 버그 존재
- **Choice**: Identity `findAll`에 `status` 쿼리 파라미터 추가, 전체 파이프라인(Identity→Gateway→Frontend) 관통 전달
- **Alternatives**: 클라이언트에서 전체 데이터를 한번에 로드 — 데이터 증가 시 비효율
- **Code Paths**: `services/identity/src/feedback/feedback.service.ts`, `services/gateway/src/feedback/feedback.controller.ts`, `frontend/src/app/admin/feedbacks/page.tsx`

### D2: 서버 응답에 전체 기준 counts 통계 포함
- **Context**: Admin 대시보드의 통계(전체/미해결/버그)가 현재 페이지 20건 기준으로 집계되어 부정확
- **Choice**: `findAll` 응답에 `counts` 필드 추가 — 상태별(`OPEN`, `IN_PROGRESS`, ...) + 카테고리별(`cat:BUG`, `cat:GENERAL`, ...) 전체 통계를 항상 반환
- **Alternatives**: 별도 통계 API — 추가 호출 비용 대비 현 규모에서 불필요
- **Code Paths**: `services/identity/src/feedback/feedback.service.ts`, `frontend/src/app/admin/feedbacks/page.tsx`

### D3: 버그 리포트 스크린샷 JPEG→WebP 전환
- **Context**: 스크린샷을 Base64 Data URL로 DB TEXT 컬럼에 저장하므로 용량 최소화 필요
- **Choice**: `canvas.toDataURL('image/webp', 0.65)` — JPEG 대비 25-35% 용량 절감, 동등 이상 화질
- **Alternatives**: JPEG 유지하고 품질만 낮춤 — WebP가 같은 품질에서 항상 더 작음
- **Code Paths**: `frontend/src/components/feedback/BugReportForm.tsx`

## Patterns
### P1: 서버 사이드 필터 + counts 통합 응답
- **Where**: `services/identity/src/feedback/feedback.service.ts` `findAll()`
- **When to Reuse**: 페이지네이션 API에서 필터링 통계를 대시보드에 표시해야 할 때. 별도 통계 API를 만들기보다 목록 API 응답에 counts를 포함하면 추가 호출 없이 처리 가능

## Gotchas
### G1: 클라이언트 필터 + 서버 페이지네이션 조합은 항상 불완전
- **Symptom**: Status 필터 적용 시 현재 페이지의 20건 내에서만 필터링되어 다른 페이지의 해당 상태 피드백 누락
- **Root Cause**: 서버가 status 무관하게 20건을 반환하고, 클라이언트가 그 중에서 필터링
- **Fix**: 필터는 반드시 서버 쿼리 레벨에서 적용 (WHERE 절)

## Metrics
- Commits: 8건, Files changed: 17개
