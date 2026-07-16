<!-- 16-eyes:start -->
## Security audits (16 Eyes)

This repo uses **16 Eyes** for AI-driven security audits — see whichever of these is
present for the full methodology: `.claude/skills/16-eyes/` (Claude Code),
`.gemini/commands/16-eyes/` (Gemini CLI), `.cursor/skills/16-eyes-*/` (Cursor), or
`.github/agents/16-eyes-*.agent.md` (GitHub Copilot). Four operations, same underlying
engine regardless of which tool runs them:

- **Configure** — profile this repo and design (once) a tailored set of security
  investigation lenses, persisted to `.16-eyes/lenses.json`. Re-run after the repo's
  shape changes materially. Auto-runs non-interactively with defaults if skipped.
- **Full audit** — run every persisted lens across the WHOLE repository: each lens
  investigates independently, every finding gets an independent skeptical re-verification
  against the real code, high-impact findings get an adversarial pass (several
  independent reviewers actively trying to disprove it — it only survives if a majority
  fail to refute it), and the result is classified `safe` (mechanical fix, no behavior
  change) vs `risky` (needs a human decision), written to `SECURITY_AUDIT_<date>.md` /
  `.json`. Read-only, expensive (many sub-investigations), a deliberate occasional deep
  sweep — not a per-commit check.
- **Diff audit** — the identical engine, scoped to a diff/PR's changed hunks instead of
  the whole repo. Read-only, much cheaper, meant to run on every PR (see
  `docs/ci.md` for the recommended GitHub Actions setup). Written to
  `SECURITY_AUDIT_DIFF_<date>.md` / `.json`.
- **Fix** — apply the most recent audit's findings: `safe` ones directly, `risky` ones
  one at a time with an explicit human confirmation before writing anything. **Never
  commits or pushes** — changes are always left in the working tree for a human to
  review and commit themselves.

If you are an AI agent working in this repository and asked to do a security review,
check first whether one of the above already fits (rather than inventing an ad hoc
scan) — they carry a specific, adversarially-verified methodology worth reusing.
<!-- 16-eyes:end -->
