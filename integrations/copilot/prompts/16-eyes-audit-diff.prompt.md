---
description: Run 16 Eyes scoped to a diff/PR — the same engine as the full audit, just faster and diff-scoped.
mode: agent
---

Use the `@16-eyes-audit-diff` custom agent to review a diff/PR (same persisted lenses
and verify/adversarial pipeline as `@16-eyes-audit`, scoped to changed hunks only).
Read-only — never edits code. If `@16-eyes-audit-diff` isn't available as a custom agent
in this Copilot surface, follow `.github/agents/16-eyes-audit-diff.agent.md`'s
instructions directly instead.
