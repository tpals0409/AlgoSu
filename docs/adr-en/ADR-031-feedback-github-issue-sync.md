---
topics:
  - security
---
# ADR-031: User Feedback -> GitHub Issue Auto-Sync (Data Egress Across the DB Boundary)

- **Status**: Accepted
- **Date**: 2026-07-23
- **Sprint**: Sprint 261
- **Decision maker**: Oracle
- **User request**: 2026-07-23 "Feedback cannot be reviewed directly in the dev environment - turn Discord into a plain notification and route feedback to GitHub issues"
- **Related**: ADR-029 (Infra SSOT consolidation), ADR-030 (Security backlog), CLAUDE.md security rules (sensitive data / PII)

---

## Context

Feedback is stored in the identity `feedbacks` table and only **a subset of fields** is pushed to a Discord webhook (category, pageUrl, author, first 200 chars of content). To reproduce an issue in the dev environment a developer had to **re-enter** the content, pageUrl, and browserInfo by hand - the re-entry bottleneck.

Code investigation before starting established:

- **github-worker cannot be reused**: it is code-push only (single queue `submission.github_push`, per-user personal token -> personal repo). The worker has no App credential path to write issues to a central repo.
- **identity is not a RabbitMQ publisher**: zero amqp dependency or publish code. Adding an MQ event introduces too many moving parts.
- **Screenshots cannot be inlined**: GitHub issue bodies do not render `data:` URIs in any format. Inlining requires object storage (out of scope).

## Decision

1. On feedback creation the identity `FeedbackService` creates an issue in the central repo **directly** via the GitHub REST endpoint (`POST /repos/{owner}/{repo}/issues`). It replicates the existing Discord fire-and-forget `fetch` pattern - no Octokit.
2. **Authentication**: a fine-grained PAT (`issues:write`, single-repo scope) - `GITHUB_FEEDBACK_ISSUE_TOKEN`. The target repo is `GITHUB_FEEDBACK_REPO` (owner/repo). Sealed via SealedSecret (`identity-service-secrets`).
3. Discord is **demoted** to a plain notification carrying only an arrival ping plus the issue link - the SSOT for content and reproduction context moves to the issue.
4. **Screenshots** stay as a dashboard link (`/admin/feedbacks/{publicId}`) in the issue - inline render is not possible.
5. **Duplicate prevention**: add nullable columns `feedbacks.github_issue_number` / `github_issue_url`.
6. **Failure isolation**: issue/Discord failures never affect the feedback save (fire-and-forget, no exception propagation).

## Rationale

- **Minimal moving parts**: zero new libraries or MQ infrastructure. Isomorphic to the existing Discord pattern, so risk is low.
- **Smaller blast radius**: an `issues:write` single-repo-scoped PAT limits damage on leakage. A GitHub App (JWT signing -> Octokit) is heavier and was rejected.

## Security

Feedback content and browserInfo leave the **identity DB boundary (to GitHub)** for the first time. Mitigations:

- The target is assumed to be a **private repo**.
- **PII minimization**: the issue records only `userId` (an internal UUID); email and real name are never written.
- **No conflict with ADR-029** (3-DB separation): the DB remains the authoritative SSOT and the GitHub issue is a non-authoritative derived copy for operational convenience.

## Alternatives

- **Option B (MQ event -> worker creates the issue)**: better separation of concerns, but requires a new identity amqp publisher plus a second worker consumer plus a central-repo App auth path - the most moving parts. Rejected.
- **Option C (dev queries a prod read-replica)**: zero copy step but exposes PII to dev permanently and creates a standing prod dependency. Rejected.

## Consequences

- (+) Re-entry eliminated - the developer sees the full context directly in a tool they already use (GitHub issues).
- (-) An added GitHub API dependency (isolated via fire-and-forget) plus PAT lifetime management.
- **Follow-up**: object-storage (S3/R2) upload plus WebP-optimized inline rendering of screenshots is split out as separate scope.

## Related code

- `services/identity/src/github/github-issue.service.ts` (new)
- `services/identity/src/feedback/feedback.service.ts` (`syncFeedbackToExternal`)
- `services/identity/src/discord/discord-webhook.service.ts` (`sendFeedbackNotification` demotion)
- `services/identity/src/database/migrations/20260723000000-AddFeedbackGithubIssueColumns.ts`
- `infra/sealed-secrets/sealed-secrets-template.yaml` (`GITHUB_FEEDBACK_ISSUE_TOKEN`, `GITHUB_FEEDBACK_REPO`)
