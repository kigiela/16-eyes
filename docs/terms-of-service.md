# Terms of Service — 16 Eyes

_Last updated: 2026-07-16_

16 Eyes (the `16-eyes` npm package, its Claude Code/Gemini CLI/Cursor/GitHub Copilot
skill files, and the `kigiela/16-eyes` GitHub Action) is open-source software licensed
under the [MIT License](../LICENSE), maintained by [kigiela](https://github.com/kigiela).

## No warranty

Provided "AS IS", without warranty of any kind, per the MIT License. The maintainer is
not liable for any damages arising from its use — including incorrect, incomplete, or
missed security findings, or any action taken (or not taken) based on its reports.

**16 Eyes does not replace human judgment or a professional security review.**
`/16-eyes fix` never commits or pushes on its own, and always requires your explicit
confirmation before applying a "risky" finding — you are always the one responsible
for what actually gets merged or deployed.

## You bring your own accounts, and pay your own bills

16 Eyes orchestrates calls to the AI provider you configure (Anthropic's Claude API for
Claude Code; Google's Gemini CLI; the provider behind Cursor or GitHub Copilot for
those adapters), using credentials you supply. You are responsible for complying with
those services' own terms, and for any costs you incur running them:

- Anthropic's Consumer/Commercial Terms (whichever applies to your account): https://www.anthropic.com/legal
- GitHub Terms of Service: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- GitHub Marketplace Developer Agreement (governing the Action listing itself): https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement

## Open source

Source, issue tracker, and contributions: https://github.com/kigiela/16-eyes.
Licensed MIT — see [LICENSE](../LICENSE) for the full text.

## Changes to these terms

Changes are made as ordinary commits to this file — the full history is visible at
https://github.com/kigiela/16-eyes/commits/main/docs/terms-of-service.md.

## Contact

Open an issue: https://github.com/kigiela/16-eyes/issues
