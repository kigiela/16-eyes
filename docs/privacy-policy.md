# Privacy Policy — 16 Eyes

_Last updated: 2026-07-16_

16 Eyes (the `16-eyes` npm package, its Claude Code/Gemini CLI/Cursor/GitHub Copilot
skill files, and the `kigiela/16-eyes` GitHub Action) is maintained by
[kigiela](https://github.com/kigiela). This page describes what happens to your data
when you install or run it.

## Short version

**The maintainer collects nothing.** There is no telemetry, no analytics, no backend,
no account system, and no data sent to the maintainer in any form. Everything runs
inside your own machine, your own CI runner, or your own AI coding tool session, using
your own credentials.

## What data leaves your environment, and to whom

Running `/16-eyes audit`, `/16-eyes audit-diff`, or the `kigiela/16-eyes` GitHub Action
sends the following to **the AI provider you've configured** — Anthropic for Claude
Code, Google for Gemini CLI, or the relevant provider behind Cursor/GitHub Copilot —
using **your own API key, subscription, or login**, never the maintainer's:

- The source code / diff content being reviewed, so the model can analyze it.
- Repository metadata used to profile the repo and design investigation lenses (file
  names, directory structure, detected frameworks).

The maintainer never sees this data. It is the same data flow as using Claude Code (or
Gemini CLI/Cursor/Copilot) directly for anything else — 16 Eyes is a set of
instructions those tools follow, not a separate service sitting in the middle.

Reports an audit produces (`SECURITY_AUDIT*.md`/`.json`) are written to **your own
repository or filesystem**. The maintainer never receives a copy.

## Third-party services

| Service | What it receives | Under whose credentials |
|---|---|---|
| Anthropic API (Claude Code CLI, or `anthropics/claude-code-action` in CI) | Code/diff content, repo profile, prompts | Yours (`ANTHROPIC_API_KEY` or your Claude Code login) |
| GitHub API (reading diffs, posting the PR comment) | PR metadata, the generated report text | Yours (`GITHUB_TOKEN`/your `gh` auth) |
| npm registry | Package download requests only — no code content | N/A (public registry) |
| Google (Gemini CLI adapter), Cursor, GitHub Copilot | Same code/diff/profile data, via that tool's own mechanism | Yours |

No other third party is involved. The tool includes no analytics SDK, crash reporter,
or tracking pixel/beacon of any kind.

## Data retention

The maintainer retains nothing, having never received anything. Retention of data sent
to the AI provider you've chosen is governed by *their* policy, not this one:

- Anthropic: https://www.anthropic.com/legal/privacy
- Google (Gemini CLI): https://policies.google.com/privacy
- GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement

## Changes to this policy

Changes are made as ordinary commits to this file — the full history is visible at
https://github.com/kigiela/16-eyes/commits/main/docs/privacy-policy.md.

## Contact

Open an issue: https://github.com/kigiela/16-eyes/issues
