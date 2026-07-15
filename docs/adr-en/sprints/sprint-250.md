# Sprint 250 — Oracle Protocol Communication Stabilization

_Date: 2026-07-16_

## Goals

Fix Oracle protocol communication issues discovered after Hermes migration (Sprint 246):
1. Work state lost on session disconnect → no recovery pattern
2. No automatic Telegram report after Wave completion → PM manually requests status
3. Insufficient awareness of delegate_task non-durability → risk of losing long-task results

## Decisions

### D1. Wave Completion Immediate Reporting Rule
- On every Wave/delegate_task completion, immediately send Telegram: `[Wave X done] summary. Starting Wave Y.`
- Questions forbidden — declarative format mandatory
- Added "Wave completed" and "Session re-entry" events to SOUL.md notification table

### D2. Session Disconnect Recovery Pattern
- Initialize `~/.hermes/profiles/algosu-oracle/sprint-progress/sprint-{N}-progress.json` at sprint start
- Update state file on each Wave completion (Wave number, SHA, timestamp)
- On re-entry, recover from state file → auto-resume from last checkpoint
- Added "Session Disconnect Recovery Pattern" section to SOUL.md
- **Path decision**: `/tmp/` lost on reboot → permanent path under `~/.hermes/` confirmed

### D3. Formalizing delegate_task Durability Constraints
- delegate_task results are lost on session disconnect (per tool spec)
- Long-running tasks (>10 min) must use `terminal(background=True, notify_on_complete=True)` or `cronjob`
- Added durability warning to "Wave Completion Immediate Reporting" section in SOUL.md

### D4. Subagent Persona Reporting Standardization
- Architect, Curator, Herald, Postman: missing [3.5 reasoning verification] before implementation → added to all
- 9 code-changing agents: commit SHA + exit code (tsc/eslint/jest) reporting made mandatory
- Start/complete state file recording standardized across all agents
- Palette excluded: WCAG AA verification more appropriate than code reasoning checks for design role

## Completed

- `~/.hermes/profiles/algosu-oracle/SOUL.md` — Added Wave completed/Session re-entry to notification table; new sections: Wave Completion Immediate Reporting rule + Session Disconnect Recovery Pattern
- `algosu-lifecycle-start/SKILL.md` — Step 4: state file initialization; Step 7: Wave completion report format + session re-entry procedure
- `algosu-lifecycle-stop/SKILL.md` — Step 5: progress.json cleanup on sprint close
- 12 subagent persona skills — D4 reporting standard applied (3.5 reasoning verification added to 5, SHA+exit added to 8, progress.json start/done recording to all)
- `sprint-window.md` — Sprint 250 goal and task plan recorded
- progress.json path migrated from `/tmp/` → `~/.hermes/profiles/algosu-oracle/sprint-progress/` across all files (SOUL.md + 12 skills)

## Carried Over

- [ ] SSOT drift (B) doc revision: Update CLAUDE.md Q-5 to `<SERVICE>_SERVICE_KEY` pattern (delegate to Scribe)
- [ ] 🔴 Security: ANTHROPIC_API_KEY rotation recommended (user on hold)
- [ ] GA4 admin Enhanced Measurement OFF (user direct)
- [ ] GA4 production UAT (user direct)
- [ ] Server redeploy + live SEO verification (ops)
- [ ] GA4 data stream URL `algo-su.com` alignment (user direct)

## Lessons Learned

- Hermes session non-durability: delegate_task loses results on disconnect → long tasks must use background terminal or cronjob
- Without auto-reporting, PM is flying blind → Wave completion declarations are the foundation of collaborative trust
- No recovery pattern = rework risk → design for idempotent resumption via state files
