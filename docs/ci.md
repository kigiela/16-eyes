# Running `/16-eyes audit-diff` in CI

The recommended, most common pattern for wiring an AI-based PR review into GitHub is:
run it on `pull_request` events, using the official
[`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action),
comment the results on the PR, and treat merge-blocking as an **opt-in** on top of
that — not the default. This mirrors how Anthropic's own Code Review / `/security-review`
integrations behave: the check completes, it just doesn't block anything unless you
explicitly wire that up yourself.

## Quick start — the GitHub Action

The simplest way to wire this in is the published Action — one step, no copy-pasted
YAML to keep in sync:

```yaml
name: 16 Eyes — audit diff
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  pull-requests: write
jobs:
  audit-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: kigiela/16-eyes@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

It checks out the repo, installs the `16-eyes` skill fresh into that checkout (no need
to have committed `.claude/skills/16-eyes/` yourself), writes a CI-safe
`.claude/settings.json` **only if you don't already have one**, runs `/16-eyes
audit-diff`, posts the report as a PR comment, and applies your `ci.failOn` gate (see
below) — all of it. Only real prerequisite: the `ANTHROPIC_API_KEY` secret (see
Prerequisites below).

## Alternative — copy the raw workflow yourself

If you'd rather see every step explicitly (or need to customize beyond what the
Action's inputs expose), `/16-eyes init`'s interview has a "scaffold a CI template?"
question that writes the files below for you. This section is for doing it by hand, or
understanding what got written.

## What gets installed

- **`.github/workflows/16-eyes-audit-diff.yml`** — runs on every `pull_request`
  (opened/synchronize/reopened), checks out the repo, runs `/16-eyes audit-diff` via
  `claude-code-action`, then posts the report as a PR comment and optionally fails the
  job based on your `ci.failOn` setting.
- **`.claude/settings.json`** — a `dontAsk`-mode permission allowlist scoped to exactly
  what `audit-diff` needs (`git diff`, `git merge-base`, `gh pr diff`, reading the repo,
  writing `.16-eyes/**` and the report files). This is the safer alternative to
  `--dangerously-skip-permissions`: CI never gets asked for approval it can't answer,
  but it also can't do anything outside this allowlist.
- **`.github/workflows/16-eyes-full-audit.yml`** (optional) — a scheduled (weekly by
  default) full-repo `/16-eyes audit`, decoupled from per-PR cost, uploaded as a
  workflow artifact. The deep sweep this whole tool is built around, on its own cadence.

Both workflow templates live in this package at `skills/16-eyes/assets/ci/` if you want
to copy them by hand instead of going through `/16-eyes init`.

## Prerequisites

1. **Commit `.claude/skills/16-eyes/` to the repo.**
   ```bash
   npx 16-eyes install --project
   git add .claude/skills/16-eyes && git commit -m "Add 16-eyes skill for CI"
   ```
   This matters specifically for CI: a headless job shouldn't depend on `npx` reaching
   the npm registry, and pinning the committed version avoids drift between what a
   contributor's local session runs and what CI runs.

2. **Add `ANTHROPIC_API_KEY` as a repository (or organization) secret** — GitHub →
   Settings → Secrets and variables → Actions. `claude-code-action` bills against this
   key directly (subscription-based Claude Code auth isn't used in CI).

## The `ci` config block

Set in `.16-eyes/config.json` (written by `/16-eyes init`, or edit by hand):

```json
{
  "ci": {
    "enabled": true,
    "failOn": "none",
    "commentOnPr": true
  }
}
```

- **`failOn: "none"`** (default) — the workflow always comments, never fails the job.
  Safe to turn on without surprising anyone with a newly-blocked merge.
- **`failOn: "risky"`** — fails the job if any `risky` finding survived adversarial
  review (a finding needing a human product/security decision before it's safe to fix).
- **`failOn: "any"`** — fails on any confirmed finding, `safe` or `risky`.
- **`commentOnPr`** — whether the job posts the markdown report as a PR comment
  (updates the same comment on subsequent pushes rather than piling up new ones).

## Making it a required check (block merge until it passes)

Setting `failOn` alone doesn't stop anyone from merging past a failed check — GitHub
only blocks merges for checks you've explicitly marked required. To actually gate
merges:

1. Set `ci.failOn` to `"risky"` or `"any"`.
2. In the repo's branch protection rules (Settings → Branches → your protected
   branch), add **"16 Eyes — audit diff / audit-diff"** as a required status check.

Without step 2, a red check is visible but not enforced — which is a perfectly
reasonable choice too, especially while you're first rolling this out and want to see
what it flags before anyone's merge gets blocked by it.

## Why not `--dangerously-skip-permissions`?

It works, but it's an all-or-nothing bypass — anything the model decides to run,
runs, no allowlist. The `dontAsk` permission mode plus a checked-in
`.claude/settings.json` gets the same "never hangs waiting for approval" property
CI needs, scoped to exactly the handful of commands `audit-diff` actually uses.
