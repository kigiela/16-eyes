# `/16-eyes init` — configure

Five phases, strictly in order. Do **not** write `.16-eyes/config.json` before Phase 5 —
everything before that is detection and a short interview.

## Phase 1 — Detect existing config

Check whether `.16-eyes/config.json` already exists in the repo root.

- **Exists:** read it, tell the user what it currently has, and ask whether they want to
  update it (re-run the interview, keeping current values as defaults) or leave it as is.
  If leaving it as is, stop here.
- **Doesn't exist:** continue to Phase 2 as a fresh setup.

## Phase 2 — Inventory

Explore the repo (don't ask the user yet — figure out what you can from the code):

- **Quality gates.** Look for test/lint/typecheck/build commands. Don't assume Node/npm —
  check, in order of what's actually present: `package.json` `scripts` (test/lint/
  typecheck/build/tsc), a `Makefile` (targets named test/lint/build or similar), Python
  (`pytest`, `tox.ini`, `pyproject.toml` test config), Rust (`cargo test`), Go (`go test
  ./...`), or any other convention the repo's own README/CI config documents. If the repo
  is a monorepo/workspace (npm/yarn/pnpm workspaces, a `packages/`/`apps/` layout with
  their own manifests), detect gate commands **per workspace**, not just at the root.
- **Output location.** Does a `docs/` directory exist? That's the default report
  location; otherwise the repo root.
- **`.gitignore` contents** — useful context for the exclude-patterns question next.

## Phase 3 — Interview

Ask briefly (don't turn this into a long form — a few grouped questions is fine):

1. **Exclude patterns** — propose this default set, adjusted for anything you saw in
   `.gitignore`: `node_modules/**`, `dist/**`, `build/**`, `vendor/**`, `**/*.min.js`,
   `**/fixtures/**`, `**/__snapshots__/**`. Confirm or let the user adjust.
2. **Output location** — confirm the `docs/`-or-root default, or let them pick a
   different directory.
3. **Default depth** — "quick" (fewer lenses, lighter adversarial review — for a fast
   check) vs "thorough" (the default; more lenses, full adversarial review on every
   high-impact finding).
4. **Gitignore the reports?** — ask explicitly, don't decide silently. This matters
   most for a **public** repository: a generated report describes real vulnerabilities
   with exploit scenarios, and committing that by accident is a real, non-hypothetical
   risk. Present it as a real choice (some teams want a committed audit trail; others
   don't want vulnerability write-ups in git history at all).
5. **Report language** — default `en`; ask if they'd prefer `pt` or `es` as the default
   for this repo (either way, `/16-eyes audit` can always be asked for a different
   language on a one-off basis regardless of this default).

## Phase 4 — Confirm

Show the user the exact `.16-eyes/config.json` you're about to write and get a go-ahead
before writing anything.

## Phase 5 — Write

Write `.16-eyes/config.json`, matching this shape (documented formally in
`../assets/config.schema.json`):

```json
{
  "$schema": "../../.claude/skills/16-eyes/assets/config.schema.json",
  "version": 1,
  "depth": "thorough",
  "language": "en",
  "excludePatterns": [
    "node_modules/**",
    "dist/**",
    "build/**",
    "vendor/**",
    "**/*.min.js",
    "**/fixtures/**",
    "**/__snapshots__/**"
  ],
  "output": {
    "dir": "docs",
    "markdownPattern": "SECURITY_AUDIT_{date}.md",
    "jsonPattern": "SECURITY_AUDIT_{date}.json",
    "gitignoreReports": true
  },
  "lastRunPointer": ".16-eyes/last-run.json",
  "gates": {
    "workspaces": [
      {
        "path": ".",
        "test": "npm test",
        "lint": "npm run lint",
        "typecheck": "npm run typecheck",
        "build": "npm run build"
      }
    ]
  },
  "adversarial": { "votesPerFinding": 3 }
}
```

Omit any gate command you couldn't detect (don't guess a placeholder). If the user
chose `depth: "quick"`, set `adversarial.votesPerFinding` to `1` instead of `3`. If they
opted to gitignore reports, also add `.16-eyes/` and the configured report filename
pattern to the repo's `.gitignore` (create it if it doesn't exist, append if it does —
never overwrite an existing `.gitignore`).

Tell the user it's done, and that `/16-eyes audit` and `/16-eyes fix` will pick this up
automatically from here on — no need to reference the config file manually.
