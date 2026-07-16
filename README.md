# 16 Eyes

Full-repository security audits for [Claude Code](https://claude.com/claude-code).
Sixteen independent eyes look at every finding before it reaches your report: the lens
that found it, a skeptical verifier that re-reads the real code, and — for high-impact
findings — several adversarial reviewers actively trying to disprove it. Nothing reaches
the report on one agent's word alone.

*[Leia em português](./README.pt-BR.md) · [Lee en español](./README.es.md)*

## Why this exists

Diff-scoped tools (Claude Code's built-in `/security-review`, most CI-wired scanners)
only see what changed in the current PR/branch. A vulnerability that's been sitting
untouched in the codebase for months is invisible to them. **16 Eyes scans the whole
repository**, regardless of recent changes — a deliberate, occasional deep sweep, not
something you run on every commit.

Unlike a fixed checklist, 16 Eyes **profiles your repo first** (stack, domains,
architecture) and then **designs its own investigation plan** — a small service gets a
handful of tailored lenses, a large multi-domain backend gets many more, and either way
the lenses are about what's actually *in your codebase*, not a generic list.

## Install

```bash
npx 16-eyes install
```

Installs globally to `~/.claude/skills/user/16-eyes`. Use `--project` to install into the
current repository's `.claude/skills/16-eyes` instead. A brand-new Claude Code session is
needed afterward — skills are discovered at session start, not picked up mid-session.

```bash
npx 16-eyes update       # re-copy the latest version
npx 16-eyes uninstall    # remove the skill (never touches a repo's own .16-eyes/ data)
npx 16-eyes status       # show what's installed, and where
```

## Use

Inside Claude Code, in any repository:

```
/16-eyes init     configure — detects quality gates, exclude patterns, output location
/16-eyes audit    profile the repo, design custom lenses, run the audit
/16-eyes fix      apply the findings — safe ones directly, risky ones with your OK
```

`init` is optional — `audit` and `fix` work with sane defaults if you skip it. `audit` is
read-only and can take a few minutes (dozens of subagent calls) — that's expected for a
full-repo sweep. `fix` never commits or pushes; it always leaves changes in your working
tree for you to review.

## How it works

1. **Profile** — one agent explores the repo's structure and identifies its stack,
   domain, and the specific subsystems that matter for security (payments, webhooks,
   auth, file uploads, LLM usage, whatever actually applies).
2. **Lens design** — a second agent, given that profile, designs a tailored list of
   investigation lenses — skipping categories that don't apply, adding repo-specific
   ones that do.
3. **Lenses → verification** — each lens investigates independently; every finding it
   raises gets an independent skeptical re-check against the real code (not just the
   finding's own description).
4. **Adversarial review** — findings classified as high-impact get a second,
   independent pass: several reviewers each try hard to *disprove* the finding. It only
   survives if a majority fail to refute it.
5. **Report** — the surviving findings are classified `safe` (mechanical fix, no
   behavior change) or `risky` (needs a human decision), written as both a markdown
   report (`SECURITY_AUDIT_<date>.md`) and a machine-readable companion
   (`SECURITY_AUDIT_<date>.json`, consumed by `/16-eyes fix`).

## License

MIT — see [LICENSE](./LICENSE).
