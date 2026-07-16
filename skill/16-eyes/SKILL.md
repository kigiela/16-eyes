---
name: 16-eyes
description: >-
  Full-repository security audits with three subcommands — `/16-eyes init`
  (configure: detect quality gates, exclude patterns, output location),
  `/16-eyes audit` (profile the repo, design custom investigation lenses
  tailored to its actual stack/domains, run them, verify every finding
  skeptically, adversarially re-check high-impact ones, produce a classified
  safe/risky report), `/16-eyes fix` (apply the audit's findings — safe ones
  directly, risky ones with your confirmation, never commits or pushes).
  Unlike diff-scoped tools (Claude Code's built-in `/security-review`, most
  CI-wired scanners), this audits the ENTIRE codebase regardless of what
  changed recently — a deliberate, occasional deep sweep, not a per-PR check.
  Trigger on: full security audit, complete security review of a repo, scan
  the whole codebase for vulnerabilities, "16-eyes init/audit/fix";
  "auditoria de segurança completa do repositório", "varredura de segurança
  full-repo", "audita esse repo inteiro por vulnerabilidades"; "auditoría de
  seguridad completa del repositorio", "escanea todo el código en busca de
  vulnerabilidades".
---

# 16 Eyes — full-repo security audit

Sixteen independent eyes look at every finding before it reaches you: the
lens that found it, a skeptical verifier that re-reads the real code, and —
for high-impact findings — several adversarial reviewers actively trying to
disprove it. Nothing reaches the report on one agent's word alone.

## Why this is different from `/security-review` and CI scanners

Diff-scoped tools (Claude Code's built-in `/security-review`, most CI-wired
scanners) only see what changed in the current PR/branch. A vulnerability
that's been sitting untouched in the codebase for months is invisible to
them. **16 Eyes scans the whole repository**, regardless of recent changes —
use `/security-review` for "does this PR introduce a problem?"; use `/16-eyes
audit` for "does this codebase, as a whole, have problems?". `/16-eyes audit`
is expensive (dozens of subagent calls, several minutes) — a deliberate,
occasional deep sweep, not a per-commit check.

## When the user runs `/16-eyes init`

Read `references/init-flow.md` and follow it end to end. Detects the repo's
quality-gate commands (test/lint/typecheck/build, across ecosystems, not just
Node), interviews briefly about exclude patterns / output location / audit
depth / whether to gitignore reports, then writes `.16-eyes/config.json`.
Never a hard requirement for `audit`/`fix` — just makes them sharper.

## When the user runs `/16-eyes audit`

Read-only — never edits code. Read `references/audit-flow.md` and follow it
end to end: profile the repo, design custom investigation lenses, run them
via the `Workflow` tool, verify every finding, adversarially re-check
high-impact ones, and write a classified markdown + JSON report.

## When the user runs `/16-eyes fix`

Read `references/fix-flow.md` and follow it end to end. Applies the most
recent `/16-eyes audit` findings (from this conversation if fresh, otherwise
the last saved report) — `safe` findings directly, `risky` ones with your
explicit confirmation one at a time. **Never runs any git write command**
(no commit, no push) — changes are always left in the working tree for you
to review.
