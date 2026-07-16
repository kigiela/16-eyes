---
name: 16-eyes-init
description: Configure 16 Eyes — detect quality gates/excludes/output, then profile the repo and design its persisted security investigation lenses. Use when setting up 16-eyes for the first time, or to regenerate its lenses after the repo's shape changed materially.
tools: ["code_search", "readfile", "editfiles", "runcommandinterminal"]
---

Follow this procedure exactly. Do not skip the confirmation step.

## 1. Detect existing config

Check whether `.16-eyes/config.json` exists in the repo root. If it does, read it,
summarize what it currently has, and ask whether to update it (re-run steps 2-3 below,
keeping current values as defaults) or leave it as-is. If leaving it as-is, ask
separately whether the investigation lenses should still be regenerated, then stop if
not.

## 2. Inventory (don't ask yet — look first)

Look for test/lint/typecheck/build commands: package.json scripts, a Makefile,
pytest/tox/pyproject test config, cargo test, go test, or whatever the repo's own
README/CI documents — don't assume Node. If it's a monorepo/workspace, detect gate
commands per workspace. Note whether a `docs/` directory exists (the default report
location; otherwise the repo root). Note `.gitignore` contents for context.

## 3. Interview (brief, grouped questions)

Ask about: exclude patterns (propose `node_modules/**`, `dist/**`, `build/**`,
`vendor/**`, `**/*.min.js`, `**/fixtures/**`, `**/__snapshots__/**`, adjusted for
`.gitignore`); output location (the `docs/`-or-root default, or a different directory);
depth (`quick` = fewer lenses/lighter adversarial review, vs `thorough`, the default);
whether to gitignore the generated reports (matters most for public repos — a report
describes real vulnerabilities with exploit scenarios); and report language (default
`en`, or `pt`/`es`).

## 4. Confirm

Show the exact `.16-eyes/config.json` you're about to write, and say you're about to
profile the repo and design its investigation lenses (a handful of delegations to
`@16-eyes-worker`, well under a minute) — get a single go-ahead before doing either.

## 5. Profile the repo

Delegate to `@16-eyes-worker`: "Profile this repository for a security-audit planning
step. Explore its structure (package manifests, lockfiles, top-level directories,
README, CI config, entry points, notable frameworks/ORMs/HTTP frameworks). Return a JSON
object with: languages (array of strings), frameworks (array of strings), domain_summary
(a short string — what this application/service actually does, for whom),
architecture_summary (a short string — monolith vs services, frontend/backend split,
datastores, deploy target), and risk_relevant_subsystems (an array of specific, concrete
things THIS repo has that matter for security — e.g. handles payment/money movement, has
public webhooks, calls an LLM with user-controlled input, parses uploaded files, has its
own auth/session system, runs SQL built from user input, has an admin/internal-only
surface, is a monorepo with N packages — be concrete to what you actually find, not a
generic list)."

## 6. Design the investigation lenses

Delegate to `@16-eyes-worker` with that profile: "Given this repo profile: <paste it>.
Design a list of investigation LENSES — each a specific, non-overlapping area an
independent worker will investigate in depth, either across the whole repo or scoped to
a diff. Consider (include what applies, skip what doesn't, add repo-specific ones not
listed): authentication & session management; authorization/access control (roles,
tenant isolation, IDOR); injection surfaces per data sink (one lens per distinct sink
technology); money movement / other irreversible actions; third-party webhook handlers;
file upload/import/parsing; LLM/AI usage (prompt injection, untrusted data reaching the
model); frontend security (XSS, CSRF, exposed secrets); CI/CD supply chain; secrets &
credentials management; infra-as-config; dependency vulnerabilities (only with a clear
signal); business-logic-specific risks unique to this repo's domain. Aim for as many
lenses as the repo's actual surface area warrants (6-8 for a small service, 18-20 for a
large multi-domain backend) — don't pad, don't skip a real distinct area. For each lens
return: name (short, slug-like), focus (one line), and prompt (the COMPLETE standalone
instructions for a worker with no other context — what to explore, what to return: a
list of findings each with title/file/line/description/initial_impact/
initial_probability, anchored to real file:line the worker actually read). Phrase each
lens's prompt so it still makes sense when told 'investigate only within these changed
files/hunks' later, since the same lens may run scoped to a diff instead of the whole
repo. Return a JSON object: `{ lenses: [ { name, focus, prompt }, ... ] }`."

## 7. Write

Write `.16-eyes/config.json` with the confirmed settings (version 1, depth,
excludePatterns, output.dir/gitignoreReports, language, lastRunPointer
`.16-eyes/last-run.json`, lastDiffRunPointer `.16-eyes/last-diff-run.json`,
lensesPointer `.16-eyes/lenses.json`, gates detected in step 2, adversarial.
votesPerFinding — 1 if depth is quick, else 3). If gitignore was requested, append the
report filename pattern to `.gitignore` (never overwrite an existing `.gitignore` —
append, or create if missing; keep `.16-eyes/config.json` and `.16-eyes/lenses.json`
themselves tracked, they're config, not vulnerability write-ups).

Write `.16-eyes/lenses.json`: `{ version: 1, generatedAt: <ISO now>, profile: <the
profile from step 5>, lenses: <the lenses from step 6> }`.

Tell the user how many lenses were designed, a one-line sense of what they cover (from
the domain summary), and that `@16-eyes-audit`, `@16-eyes-audit-diff`, and
`@16-eyes-fix` will use this automatically from here on.

## Auto-bootstrap note

If you were invoked internally by `@16-eyes-audit` or `@16-eyes-audit-diff` because
`.16-eyes/lenses.json` was missing (rather than typed directly by a human), skip steps
3-4 entirely (no interview, no confirmation — this must complete unattended) and use
every default listed above verbatim. Say so plainly when you hand control back to
whichever agent triggered this.
