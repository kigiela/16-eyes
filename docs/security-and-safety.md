# Security & safety disclosures — 16 Eyes

_Written for the GitHub Marketplace listing's "Transparency disclosures" field._ This
page describes what 16 Eyes actually does, the safeguards built into it, and an honest
statement of its compliance posture — no certification is claimed that doesn't exist.

## What this tool is (and isn't)

16 Eyes is a **developer-assistance tool**: it reads a repository (or a diff),
generates a security-findings report, and — only on a separate, explicit invocation —
proposes code edits that always require human confirmation before anything risky is
applied. Concretely:

- **It never automatically merges, commits, or pushes code.** `/16-eyes fix` applies
  `safe` findings directly (mechanical, no behavior change) but presents every `risky`
  finding one at a time and requires an explicit yes before writing anything.
- **It never takes autonomous action on a live system.** It doesn't deploy, doesn't
  call external APIs on your behalf beyond the AI model itself, and doesn't make
  decisions about people — no biometric identification, no scoring or ranking of
  individuals, no employment/credit/access decisions.
- Its output is a report a human reads and acts on — the same shape as a human
  contractor's audit findings, not an autonomous agent making consequential decisions
  unsupervised.

## Built-in verification safeguards

The core design principle ("16 eyes") is that no finding reaches the report on a
single model call's word alone:

1. **Lens investigation** — an independent pass identifies a candidate finding.
2. **Skeptical verification** — a second, independent pass re-reads the actual code
   (not just the first pass's description) before accepting it.
3. **Adversarial review** (high-impact findings only) — several further independent
   passes each try to actively *disprove* the finding; it's discarded unless a
   majority fail to refute it.
4. Specific failure modes are explicitly guarded against in the implementation — a
   corrupted/placeholder model response is never silently trusted, and an
   all-refuters-failed adversarial round is never treated as "survived".

The exact logic is plain-text and auditable — see
[`skills/16-eyes/references/audit-flow.md`](../skills/16-eyes/references/audit-flow.md)
in this repository. There's no hidden model, no compiled binary, no obfuscation.

## Data handling

See the [Privacy Policy](./privacy-policy.md) for the full data-flow breakdown.
Summary: no telemetry, no backend, no data collected by the maintainer. Code/diff
content is sent only to the AI provider you've configured, using your own credentials.

## Compliance posture (honest statement)

**No third-party compliance certification (SOC 2, ISO 27001, or similar) is claimed,
because none has been obtained.** This is a small open-source project maintained
without a formal compliance program.

Regarding the **EU AI Act**: 16 Eyes is a developer tool that produces a report for
human review and never acts autonomously on production systems or on decisions about
individuals — on that basis, it does not appear to fall under the Annex III high-risk
use cases (biometric identification, critical infrastructure, employment, credit
scoring, law enforcement, etc.). This is the maintainer's own good-faith reading of the
Act's scope, **not a formal legal conformity assessment**. Organizations with their own
EU AI Act obligations should have their own counsel confirm classification before
relying on this tool in a context where that matters.

## Third-party services required

This tool calls the Anthropic API to perform the security analysis, using an API key
you provide — Anthropic never receives it from us. In CI, it also calls the GitHub API
to read the pull request's changes and post the results as a comment, using GitHub's
own token for the workflow (or one you supply). No other third-party service is used,
and the maintainer's infrastructure receives no data — there is no backend.

## Reporting a security issue in 16 Eyes itself

See [SECURITY.md](../SECURITY.md). (A vulnerability found *by* an audit belongs in that
audit's own report, not here — this is only for issues in 16 Eyes' own code/logic.)
