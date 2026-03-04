# AlgoSu 어노테이션 작성 도우미

## 역할
AlgoSu 어노테이션 사전 규칙에 따라 코드에 주석을 작성하거나 검증합니다.

## 필수 참조
- 어노테이션 사전: `/root/AlgoSu/docs/annotation-dictionary.md`

## 파일 헤더 (모든 .ts/.tsx/.py 필수)
```ts
/**
 * @file {파일 역할 한 줄}
 * @domain {도메인}
 * @layer {계층}
 * @related {연관 코드}
 */
```

## @domain 허용값
submission, problem, review, study, identity, github, ai, dashboard, notification, common

## @layer 허용값
page, component, hook, context, api, controller, service, repository, entity, dto, guard, middleware, migration, config, util, test

## @event 허용값
SUBMISSION_CREATED, SUBMISSION_STATUS_CHANGED, AI_ANALYSIS_COMPLETED, AI_ANALYSIS_FAILED, GITHUB_SYNC_COMPLETED, GITHUB_SYNC_FAILED, PROBLEM_CREATED, ROLE_CHANGED, STUDY_MEMBER_JOINED, STUDY_MEMBER_LEFT, DEADLINE_REMINDER, STUDY_CLOSED
표기: (publish) / (subscribe) / (emit) / (listen)

## @guard 허용값
C1-github-check, jwt-auth, study-member, study-admin, submission-owner, problem-deadline, cookie-auth, ai-quota, invite-code-lock, closed-study, review-deadline, system-admin

## 섹션 구분자 (50줄 이상 파일)
`// ─── {NAME} ────────────────────────────` (총 50자)
TYPES, CONSTANTS, HOOKS, STATE, HANDLERS, HELPERS, API, EFFECTS, RENDER, EXPORTS

## 사용법
파일 경로를 인자로 전달하면 해당 파일에 어노테이션을 추가/검증합니다.

$ARGUMENTS
