# AlgoSu 어노테이션 규칙 요약

> 원본: `/root/AlgoSu/docs/annotation-dictionary.md`

## 파일 헤더 (필수)
모든 `.ts`, `.tsx`, `.py` 파일 최상단:
```ts
/**
 * @file 설명
 * @domain submission
 * @layer page
 * @related SubmissionService, AIResultView
 */
```

## 태그 사전

### @domain (10종)
submission, problem, review, study, identity, github, ai, dashboard, notification, common

### @layer (16종)
page, component, hook, context, api, controller, service, repository, entity, dto, guard, middleware, migration, config, util, test

### @event (12종)
SUBMISSION_CREATED, SUBMISSION_STATUS_CHANGED, AI_ANALYSIS_COMPLETED, AI_ANALYSIS_FAILED, GITHUB_SYNC_COMPLETED, GITHUB_SYNC_FAILED, PROBLEM_CREATED, ROLE_CHANGED, STUDY_MEMBER_JOINED, STUDY_MEMBER_LEFT, DEADLINE_REMINDER, STUDY_CLOSED

### @guard (12종)
C1-github-check, jwt-auth, study-member, study-admin, submission-owner, problem-deadline, cookie-auth, ai-quota, invite-code-lock, closed-study, review-deadline, system-admin

### @api
`{METHOD} {path}` — Controller + API Client 양쪽 동일 표기

### @todo
`// @todo(Agent명) 설명` — Sprint 종료 시 전수 점검, 완료 시 삭제

## 섹션 구분자 (50줄 이상 파일)
`// ─── {NAME} ────────────────────────────` (총 50자)
사용 가능: TYPES, CONSTANTS, HOOKS, STATE, HANDLERS, HELPERS, API, EFFECTS, RENDER, EXPORTS

## 주석 원칙
1. 모든 export 대상 JSDoc 필수
2. "왜"를 쓴다 (무엇은 코드 자체로)
3. 한국어 허용 (태그 값은 영문)
4. 코드 변경 시 주석 함께 갱신
5. 인라인 주석 최소화
