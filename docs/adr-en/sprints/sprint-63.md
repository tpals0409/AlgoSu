---
sprint: 63
title: "Discord Feedback Notifications (One-Way Webhook)"
date: "2026-04-09"
status: completed
agents: [Architect, Postman]
related_adrs: []
---

# Sprint 63: Discord Feedback Notifications (One-Way Webhook)

## Decisions
### D1: Place Discord notifications in Identity service
- **Context**: Need to send Discord notifications to admins when feedback is created. Choice needed between Gateway (proxy) vs Identity (storage owner).
- **Choice**: Place DiscordWebhookService in the Identity service. Since Identity is the feedback storage owner, webhooks should also be sent from the same service.
- **Alternatives**: Gateway sends webhook after Identity response — rejected as it adds business logic to the proxy layer.
- **Code Paths**: `services/identity/src/discord/discord-webhook.service.ts`

### D2: Separate independent module (in anticipation of future bot expansion)
- **Context**: Currently only one-way webhook is needed, but Discord bot interaction features are planned for future expansion.
- **Choice**: Separate as `discord/` independent module. DiscordModule exports DiscordWebhookService.
- **Alternatives**: Implement directly inside feedback module — rejected as refactoring would be needed on expansion.
- **Code Paths**: `services/identity/src/discord/discord.module.ts`

### D3: Embed format — code block body + single-line compressed metadata
- **Context**: Discord Embed fields format has poor readability. Table format is not supported by Discord.
- **Choice**: Code block (message body) + bold/inline code (metadata) combination in description. No emojis.
- **Alternatives**: (A) fields list — poor visibility, (B) code block table — no link/color support, (C) image trick — external dependency
- **Code Paths**: `services/identity/src/discord/discord-webhook.service.ts`

### D4: Clean up remaining Discord stubs
- **Context**: Incomplete Discord webhook stubs existed in ci.yml notify job and alertmanager.yaml.
- **Choice**: Remove CI Discord step (keep Grafana annotation), convert alertmanager receiver to null.
- **Alternatives**: Use existing stubs — rejected as structure differs and they are incomplete.
- **Code Paths**: `.github/workflows/ci.yml`, `infra/k3s/monitoring/alertmanager.yaml`

## Patterns
### P1: Fire-and-forget external service calls
- **Where**: `services/identity/src/discord/discord-webhook.service.ts`, `services/identity/src/feedback/feedback.service.ts`
- **When to Reuse**: When calling external services (webhooks, notifications, etc.) that should not affect the main business logic on failure. Log errors only with `.catch()` without propagating exceptions.

### P2: Silent skip + single warning when env var is not set
- **Where**: `services/identity/src/discord/discord-webhook.service.ts`
- **When to Reuse**: When an optional external integration service should not block service startup if env var is missing. Use `warnedMissingUrl` flag to prevent log spam.

## Gotchas
### G1: CI branches coverage 98% threshold not met
- **Symptom**: Identity test branches at 97.91% after first push, causing CI failure.
- **Root Cause**: Non-Error throw case in `err instanceof Error ? ... : String(err)` branch not covered.
- **Fix**: Added string throw test case to bring coverage to 98.43% (`e29832e`).

## Metrics
- Commits: 2, Files changed: 10
