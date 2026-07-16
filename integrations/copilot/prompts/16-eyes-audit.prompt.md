---
description: Run 16 Eyes across the whole repository — verify every finding, adversarially review high-impact ones, write a classified report.
mode: agent
---

Use the `@16-eyes-audit` custom agent to run a full-repo security audit (loads this
repo's persisted investigation lenses, bootstrapping them via `@16-eyes-init` first if
none exist, verifies every finding, adversarially reviews high-impact ones, writes a
classified markdown + JSON report). Read-only — never edits code. If `@16-eyes-audit`
isn't available as a custom agent in this Copilot surface, follow
`.github/agents/16-eyes-audit.agent.md`'s instructions directly instead.
