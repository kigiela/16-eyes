# Cutting a release (publishing to npm)

Publishing is **not** automatic on every push/merge — it's triggered by publishing a
GitHub Release, a deliberate action a maintainer takes. See
[`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml) for the
workflow itself.

## One-time setup

Auth is [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) — OIDC-based,
**no `NPM_TOKEN` secret at all**. Configure it on the package itself:

1. npmjs.com → the `16-eyes` package → **Settings** → **Trusted Publisher** → select
   **GitHub Actions**.
2. Fill in: organization/user `kigiela`, repository `16-eyes`, workflow filename
   `publish-npm.yml` (filename only, no path), allowed action **npm publish**.
   Leave "Environment name" blank (this workflow doesn't use a GitHub environment).
3. Save. That's it — no secret to create or rotate. The workflow's `id-token: write`
   permission is what lets GitHub mint the short-lived OIDC token npm trusts at publish
   time.

Requires npm CLI ≥ 11.5.1 and Node ≥ 22.14.0, which is why the workflow pins
`node-version: "22"` via `actions/setup-node`.

## Every release

1. Bump the version in [`package.json`](../package.json) (semver — patch for fixes,
   minor for new features like a new subcommand or tool integration, major for
   breaking changes to the config schema or CLI flags).
2. Commit and merge that bump to `main`.
3. Create a GitHub Release with a tag matching the new version, prefixed with `v`
   (e.g. version `1.0.0` → tag `v1.0.0`):
   ```bash
   gh release create v1.0.0 --title "v1.0.0" --generate-notes
   ```
   (`--generate-notes` drafts release notes from merged PRs since the last tag — edit
   before publishing if you want a hand-written summary instead.)
4. Publishing the release triggers the workflow, which:
   - Verifies the tag matches `package.json`'s version (fails loudly if they've drifted
     — never publishes a mismatched version).
   - Runs a quick sanity check (JS syntax, JSON validity, `npm pack --dry-run`).
   - Publishes to npm via Trusted Publishing — npm mints provenance automatically as
     part of that OIDC flow, tying the published package back to this exact GitHub
     Actions run and commit.

## If it fails

The "tag matches package.json" check is the most common failure — it means someone
tagged/released without bumping `package.json` first (or bumped it but forgot to merge
before tagging). Fix `package.json`, merge, delete the mismatched tag/release, and
re-cut it.
