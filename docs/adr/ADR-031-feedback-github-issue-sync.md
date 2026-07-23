---
topics:
  - security
---
# ADR-031: 사용자 피드백 → GitHub 이슈 자동 동기화 (DB 경계 외부 반출 결정)

- **상태**: 채택됨 (Accepted)
- **날짜**: 2026-07-23
- **스프린트**: Sprint 261
- **의사결정자**: Oracle (심판관)
- **사용자 요청**: 2026-07-23 "사용자 피드백이 개발 환경에서 바로 확인 불가 — 디스코드는 단순 알림으로 바꾸고 깃허브 이슈로 넘어가게"
- **관련**: ADR-029 (인프라 SSOT 일원화), ADR-030 (보안 백로그), CLAUDE.md 보안 규칙(민감정보/PII)

---

## 맥락 (Context)

피드백은 identity `feedbacks` 테이블에 저장되고 Discord webhook으로 **일부 필드만** 알림된다(카테고리·pageUrl·작성자·본문 200자). 개발자가 dev 환경에서 재현하려면 본문·pageUrl·browserInfo를 손으로 **다시 입력**해야 했다 — 재입력 병목.

착수 전 코드 조사로 아래를 확정했다:

- **github-worker 재활용 불가**: 코드푸시 전용(단일 큐 `submission.github_push`, 유저 개인 토큰 → 개인 레포). 중앙 레포에 이슈 쓸 App 크레덴셜 경로가 워커에 없음.
- **identity는 RabbitMQ 발행자가 아님**: amqp 의존성·발행 코드 0건. MQ 이벤트 신설은 이동부 과다.
- **스크린샷 인라인 불가**: GitHub 이슈 본문은 `data:` URI를 포맷 불문 미렌더. 인라인은 오브젝트 스토리지 필요(범위 초과).

## 결정 (Decision)

1. 피드백 저장 시 identity `FeedbackService`가 **직접** GitHub REST(`POST /repos/{owner}/{repo}/issues`)로 중앙 레포에 이슈를 생성한다. Octokit 없이 기존 Discord fire-and-forget `fetch` 패턴을 복제한다.
2. **인증**: fine-grained PAT(`issues:write`, 단일 레포 스코프) — `GITHUB_FEEDBACK_ISSUE_TOKEN`. 대상 레포는 `GITHUB_FEEDBACK_REPO`(owner/repo). SealedSecret(`identity-service-secrets`)로 봉인한다.
3. Discord는 **도착 알림 + 이슈 링크**만 싣는 단순 알림으로 강등한다 — 본문·재현 맥락의 SSOT는 이슈로 이관.
4. **스크린샷**은 이슈에 대시보드 링크(`/admin/feedbacks/{publicId}`)만 남긴다 — 인라인 렌더 불가.
5. **중복 방지**: `feedbacks.github_issue_number` / `github_issue_url` 컬럼(nullable) 추가.
6. **실패 격리**: 이슈/Discord 실패는 피드백 저장에 영향을 주지 않는다(fire-and-forget, 예외 미전파).

## 근거 (Rationale)

- **이동부 최소**: 새 라이브러리·MQ 인프라 0건. 기존 Discord 패턴과 동형이라 리스크가 낮다.
- **폭발반경 축소**: `issues:write` + 단일 레포 스코프 PAT라 유출 시 피해가 국한된다. GitHub App(JWT 서명 → Octokit 필요)은 무거워 기각.

## 보안 고려 (Security)

피드백 본문·browserInfo가 처음으로 **identity DB 경계 밖(GitHub)으로 반출**된다. 완화책:

- 대상은 **비공개 레포** 전제.
- **PII 최소화**: 이슈에는 `userId`(내부 UUID)만 기입하고 이메일·실명은 미기입한다.
- ADR-029(3-DB 분리) 철학과 **충돌하지 않음** — DB가 여전히 권위 SSOT이고 GitHub 이슈는 운영 편의용 파생 사본(비권위)이다.

## 대안 (Alternatives)

- **B안 (MQ 이벤트 → worker 생성)**: 관심사 분리는 우수하나 identity amqp 발행자 신설 + 워커 2차 소비자 + 중앙레포 App 인증 경로 신설 → 이동부 최다. 기각.
- **C안 (dev가 prod read-replica 조회)**: 복사 단계 0이나 dev에 PII 상시 노출·prod 상시 의존. 기각.

## 결과 (Consequences)

- (+) 재입력 제거 — 개발자가 이미 쓰는 도구(GitHub 이슈)에서 전체 맥락을 바로 확인.
- (−) GitHub API 의존 추가(단, fire-and-forget으로 격리) + PAT 수명 관리 필요.
- **후속 과제**: 스크린샷 오브젝트 스토리지(S3/R2) 업로드 + WebP 최적화 인라인 렌더는 별도 범위로 분리.

## 관련 코드

- `services/identity/src/github/github-issue.service.ts` (신규)
- `services/identity/src/feedback/feedback.service.ts` (`syncFeedbackToExternal`)
- `services/identity/src/discord/discord-webhook.service.ts` (`sendFeedbackNotification` 강등)
- `services/identity/src/database/migrations/20260723000000-AddFeedbackGithubIssueColumns.ts`
- `infra/sealed-secrets/sealed-secrets-template.yaml` (`GITHUB_FEEDBACK_ISSUE_TOKEN`, `GITHUB_FEEDBACK_REPO`)
