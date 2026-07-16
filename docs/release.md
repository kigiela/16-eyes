# Cutting a release (publishing to npm)

Publishing is **not** automatic on every push/merge — it's triggered by publishing a
GitHub Release, a deliberate action a maintainer takes. See
[`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml) for the
workflow itself.

## One-time setup

Add an npm **Automation** token as a repo secret named `NPM_TOKEN`:

1. npmjs.com → your account → Access Tokens → Generate New Token → **Automation**
   (this token type can publish from CI without an interactive 2FA prompt).
2. GitHub repo → Settings → Secrets and variables → Actions → New repository secret
   → name it `NPM_TOKEN`.

## Every release

1. Bump the version in [`package.json`](../package.json) (semver — patch for fixes,
   minor for new features like a new subcommand or tool integration, major for
   breaking changes to the config schema or CLI flags).
2. Commit and merge that bump to `main`.
3. Create a GitHub Release with a tag matching the new version, prefixed with `v`
   (e.g. version `0.2.0` → tag `v0.2.0`):
   ```bash
   gh release create v0.2.0 --title "v0.2.0" --generate-notes
   ```
   (`--generate-notes` drafts release notes from merged PRs since the last tag — edit
   before publishing if you want a hand-written summary instead.)
4. Publishing the release triggers the workflow, which:
   - Verifies the tag matches `package.json`'s version (fails loudly if they've drifted
     — never publishes a mismatched version).
   - Runs a quick sanity check (JS syntax, JSON validity, `npm pack --dry-run`).
   - Publishes to npm with `--provenance` (supply-chain attestation tying the published
     package back to this exact GitHub Actions run and commit).

## If it fails

The "tag matches package.json" check is the most common failure — it means someone
tagged/released without bumping `package.json` first (or bumped it but forgot to merge
before tagging). Fix `package.json`, merge, delete the mismatched tag/release, and
re-cut it.
