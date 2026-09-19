# `/16-eyes init` — configure

Two ways this runs: **standard** (the user typed `/16-eyes init` directly —
detect → inventory → interview → confirm → write) and **auto-bootstrap**
(invoked internally by `/16-eyes audit` or `/16-eyes audit-diff` because
`.16-eyes/lenses.json` doesn't exist yet — no interview, sane defaults, safe
to run with no human present, e.g. inside a headless CI job). Both end the
same way: `.16-eyes/lenses.json` gets written — the persisted, repo-tailored
investigation-lens set that `audit` and `audit-diff` both load from, instead
of profiling the repo and designing lenses fresh on every single run.

## Standard mode (user-invoked)

Five phases, strictly in order. Do **not** write `.16-eyes/config.json` or
`.16-eyes/lenses.json` before Phase 5 — everything before that is detection
and a short interview.

### Phase 1 — Detect existing config

Check whether `.16-eyes/config.json` already exists in the repo root.

- **Exists:** read it, tell the user what it currently has, and ask whether they want to
  update it (re-run the interview, keeping current values as defaults) or leave it as is.
  If leaving it as is, ask separately whether they'd also like the investigation lenses
  regenerated (useful after the repo has changed shape significantly) — if not, stop here.
- **Doesn't exist:** continue to Phase 2 as a fresh setup.

### Phase 2 — Inventory

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

### Phase 3 — Interview

Ask briefly (don't turn this into a long form — a few grouped questions is fine):

1. **Exclude patterns** — propose this default set, adjusted for anything you saw in
   `.gitignore`: `node_modules/**`, `dist/**`, `build/**`, `vendor/**`, `**/*.min.js`,
   `**/fixtures/**`, `**/__snapshots__/**`. Confirm or let the user adjust.
2. **Output location** — confirm the `docs/`-or-root default, or let them pick a
   different directory.
3. **Default depth** — "quick" (fewer lenses, lighter adversarial review — for a fast
   check) vs "thorough" (the default; more lenses, full adversarial review on every
   high-impact finding). This also governs how many investigation lenses get designed in
   Phase 5 below.
4. **Gitignore the reports?** — ask explicitly, don't decide silently. This matters
   most for a **public** repository: a generated report describes real vulnerabilities
   with exploit scenarios, and committing that by accident is a real, non-hypothetical
   risk. Present it as a real choice (some teams want a committed audit trail; others
   don't want vulnerability write-ups in git history at all).
5. **Report language** — default `en`; ask if they'd prefer `pt` or `es` as the default
   for this repo (either way, `/16-eyes audit`/`audit-diff` can always be asked for a
   different language on a one-off basis regardless of this default).
6. **CI template** — ask if they want a GitHub Actions workflow scaffolded that runs
   `/16-eyes audit-diff` automatically on every PR (see `references/ci-flow.md` for what
   this writes and where). Default to **no** if unsure — this touches
   `.github/workflows/`, which shouldn't happen as a side effect of an unrelated yes.
7. **Model for the audit pipeline** — ask which model every subagent call (lens
   investigation, verification, adversarial review, synthesis) should use:
   - **Sonnet** (recommended, the default) — pinned regardless of the invoking session's
     own model, so a full audit's dozens of subagent calls stay cost-predictable.
   - **Claude Code's own default** — inherit whatever model the invoking session itself
     is on for every subagent call. **Cost warning:** if the invoking session is on
     Opus, this pins EVERY subagent call — potentially dozens per run — to Opus
     pricing, not just this one conversation. Only pick this if you understand and want
     that cost trade-off; when unsure, pick Sonnet instead.
   - **A specific model** other than Sonnet — Opus (highest quality, most expensive) or
     Haiku (cheapest and fastest, lower quality). Ask which if they pick this option.

### Phase 4 — Confirm

Show the user the exact `.16-eyes/config.json` you're about to write, **and** tell them
you're about to profile the repo and design its investigation lenses — a handful of
agent calls, but this can take several minutes for a large or complex repo (lens design
alone commonly takes 5-10+ minutes; it is not stuck, it is genuinely doing a lot of
reasoning) — get a single go-ahead before doing either.

### Phase 5 — Design lenses & write

1. **Call the `Workflow` tool** with `script` set to the exact contents of the code block
   in "The lens-design workflow script" below, and `args: { excludePatterns, depth, model }`
   from the Phase 3 answers. This is the user's explicit opt-in to multi-agent
   orchestration (the user invoking `/16-eyes init` is the consent) — do not ask again.
   **If the return value has an `error` field** (e.g. `model-preflight-failed`), stop
   here — do not write `config.json`/`lenses.json`. Tell the user the configured model
   failed a preflight check and point them at re-answering question 7 above.
2. **Write `.16-eyes/config.json`**, matching this shape (documented formally in
   `../assets/config.schema.json`):

   ```json
   {
     "$schema": "../../.claude/skills/16-eyes/assets/config.schema.json",
     "version": 1,
     "depth": "thorough",
     "language": "en",
     "model": "sonnet",
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
     "lastDiffRunPointer": ".16-eyes/last-diff-run.json",
     "lensesPointer": ".16-eyes/lenses.json",
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
     "adversarial": { "votesPerFinding": 3 },
     "ci": { "enabled": false, "failOn": "none", "commentOnPr": true }
   }
   ```

   Omit any gate command you couldn't detect (don't guess a placeholder). If the user
   chose `depth: "quick"`, set `adversarial.votesPerFinding` to `1` instead of `3`. If they
   opted to gitignore reports, also add `.16-eyes/lenses.json`'s sibling report files (not
   `.16-eyes/` itself — `lenses.json`/`config.json`/the run pointers should stay tracked,
   they're config, not vulnerability write-ups) and the configured report filename
   pattern to the repo's `.gitignore` (create it if it doesn't exist, append if it does —
   never overwrite an existing `.gitignore`). If they said yes to the CI template
   question, set `ci.enabled: true` and follow `references/ci-flow.md` now to scaffold it.
   Set `model` to whatever they picked in question 7: `"sonnet"` (the recommended
   default), `"default"` (Claude Code's own session model), `"opus"`, or `"haiku"`.
3. **Write `.16-eyes/lenses.json`**:
   ```json
   {
     "version": 1,
     "generatedAt": "<ISO timestamp from your own context>",
     "profile": "<the workflow's `profile` return value, verbatim>",
     "lenses": "<the workflow's `lenses` return value, verbatim>"
   }
   ```
4. Tell the user it's done: how many lenses were designed and a one-line sense of what
   they cover (drawn from `profile.domain_summary`), and that `/16-eyes audit`,
   `audit-diff`, and `fix` will pick all of this up automatically from here on — no need
   to reference the config or lenses files manually. Mention that re-running `/16-eyes
   init` regenerates the lenses (useful after the repo's shape changes materially).

## Auto-bootstrap mode (invoked internally by `audit` / `audit-diff`)

Triggered the moment `/16-eyes audit` or `/16-eyes audit-diff` looks for
`.16-eyes/lenses.json` (per `config.lensesPointer`) and doesn't find it. **Never
interview, never wait for confirmation** — this must complete unattended, including
inside a headless CI run with no human in the loop. (The one place a human interactive
session now gets asked anything before this triggers is one level up, in `audit`'s or
`audit-diff`'s own "When invoked" step 4 — a one-time "ok to auto-bootstrap and run?"
gate before this function is even called. This function's own behavior is unchanged:
once triggered, it still never interviews.)

1. **If `.16-eyes/config.json` already exists**, read it and reuse its `excludePatterns`/
   `depth`/`model` as-is for lens design below — don't touch anything else in it, don't
   ask about it. If `lensesPointer` is missing from it, add the default
   (`.16-eyes/lenses.json`) when you write config back out at the end of this step. If
   `model` is missing from it (a config written before this field existed), add the
   default (`"sonnet"`) when you write config back out too.
2. **If `.16-eyes/config.json` doesn't exist**, run Phase 2's inventory automatically
   (gate detection, output-location detection) and write `.16-eyes/config.json` with the
   Phase 5 shape above, using every documented default verbatim (`excludePatterns`
   default set, `output.dir` = `docs/`-or-root per Phase 2, `depth: "thorough"`,
   `language: "en"`, `model: "sonnet"`, `output.gitignoreReports: false`, `ci: { enabled:
   false, failOn: "none", commentOnPr: true }`, `adversarial.votesPerFinding: 3`) — no
   interview, no confirmation step.
3. **Call the same `Workflow` script** as Standard mode Phase 5 step 1, with whatever
   `excludePatterns`/`depth`/`model` resulted from step 1 or 2 above. **If the return
   value has an `error` field**, stop — do not write `lenses.json`. Return that error up
   to whichever command triggered this (`audit`/`audit-diff`), which must abort with it
   (its own model-preflight-failed handling) rather than proceeding as if lenses exist.
4. **Write `.16-eyes/lenses.json`** exactly as in Standard mode Phase 5 step 3.
5. **Return control** to whichever command triggered this (`audit`/`audit-diff`) and
   continue its own flow immediately — don't stop here. That command's own final summary
   to the user must mention that config/lenses were bootstrapped just now with defaults,
   and that `/16-eyes init` can be run anytime afterward to customize exclude patterns,
   output location, depth, language, or gates interactively (it will detect the
   bootstrapped config and offer to update it, per Phase 1 above).

## The lens-design workflow script

```js
export const meta = {
  name: '16-eyes-lens-design',
  description: 'Profile a repo and design a tailored set of security investigation lenses, persisted for /16-eyes audit and /16-eyes audit-diff to reuse.',
  phases: [{ title: 'Preflight' }, { title: 'Profile' }, { title: 'Lens design' }],
}

const PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    languages: { type: 'array', items: { type: 'string' } },
    frameworks: { type: 'array', items: { type: 'string' } },
    domain_summary: { type: 'string' },
    architecture_summary: { type: 'string' },
    risk_relevant_subsystems: { type: 'array', items: { type: 'string' } },
  },
  required: ['languages', 'domain_summary', 'architecture_summary', 'risk_relevant_subsystems'],
}

const LENSES_SCHEMA = {
  type: 'object',
  properties: {
    lenses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          focus: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['name', 'focus', 'prompt'],
      },
    },
  },
  required: ['lenses'],
}

// Planning only — name + focus, no prompt text. Kept deliberately tiny so
// this call is fast and never risks the output-token limit on its own; full
// prompt text is written separately, in small batches (see "Lens design").
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    lenses: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, focus: { type: 'string' } },
        required: ['name', 'focus'],
      },
    },
  },
  required: ['lenses'],
}

const excludePatterns = (args && Array.isArray(args.excludePatterns) && args.excludePatterns) || []
const depth = args && args.depth === 'quick' ? 'quick' : 'thorough'
const modelPolicy = args && typeof args.model === 'string' ? args.model : 'sonnet'
const modelOpt = modelPolicy !== 'default' ? { model: modelPolicy } : {}

// ── Model preflight — fail fast rather than silently persisting an empty/garbage
// lenses.json that every future audit/audit-diff run would then hit blind.
phase('Preflight')
const PREFLIGHT_SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }
const preflight = await agent('Reply with exactly {"ok": true}.', {
  schema: PREFLIGHT_SCHEMA,
  phase: 'Preflight',
  label: 'model-preflight',
  ...modelOpt,
})
if (!preflight || preflight.ok !== true) {
  return { profile: null, lenses: [], error: 'model-preflight-failed', model: modelPolicy }
}
log(`Model preflight ok (${modelPolicy}).`)

const excludeNote = excludePatterns.length
  ? `\n\nDo not investigate or report findings under these excluded paths (vendored/generated/fixtures, already reviewed as out of scope): ${excludePatterns.join(', ')}.`
  : ''
const depthNote =
  depth === 'quick'
    ? '\n\nDepth requested: QUICK — prioritize only the 4-8 highest-value lenses (the areas most likely to matter for this repo); skip lower-priority ones entirely rather than covering everything shallowly.'
    : ''

log('Profiling the repository (stack, domains, architecture)...')
phase('Profile')
const profile = await agent(
  `Profile this repository for a security-audit planning step. Explore its structure (package manifests, lockfiles, top-level directories, README, CI config, entry points, notable frameworks/ORMs/HTTP frameworks). Identify:
- languages and frameworks in use
- a short domain summary (what this application/service actually does, for whom)
- a short architecture summary (monolith vs services, frontend/backend split, datastores, deploy target)
- risk_relevant_subsystems: a list of specific things THIS repo has that matter for security (e.g. "handles payment/money movement", "has public webhooks", "calls an LLM with user-controlled input", "parses uploaded files", "has its own auth/session system", "runs SQL built from user input somewhere", "has an admin/internal-only surface", "is a monorepo with N packages") — be concrete and specific to what you actually find, not a generic list.${excludeNote}`,
  { schema: PROFILE_SCHEMA, phase: 'Profile', label: 'profile', ...modelOpt },
)
log(
  `Profile: ${(profile?.languages || []).join(', ')} · ${(profile?.risk_relevant_subsystems || []).length} risk-relevant subsystem(s) identified`,
)

phase('Lens design')
log(
  'Planning which investigation lenses this repo needs (names + focus only — full prompts are written next, in small batches, to avoid one huge non-interruptible call)...',
)
const plan = await agent(
  `You are planning the standing investigation coverage for a repository's security audits (both full-repo and diff-scoped reviews will reuse this same plan), given this repo profile:

Languages: ${(profile?.languages || []).join(', ')}
Frameworks: ${(profile?.frameworks || []).join(', ')}
Domain: ${profile?.domain_summary}
Architecture: ${profile?.architecture_summary}
Risk-relevant subsystems found: ${(profile?.risk_relevant_subsystems || []).join('; ')}

Decide which investigation LENSES this repo needs — each one a specific, non-overlapping area an independent subagent will later investigate in depth, either across the whole repo or scoped to a diff. Consider (include what applies, SKIP what doesn't, and ADD repo-specific ones not listed here):
- authentication & session management
- authorization / access control (roles, tenant isolation, IDOR)
- injection surfaces per data sink (SQL/NoSQL/command/template) — one lens per DISTINCT sink technology if there's more than one
- money movement / other irreversible actions (payments, deletions, sends) — validation, idempotency, confirmation
- third-party webhook handlers (auth, replay, fail-open vs fail-closed)
- file upload / import / parsing (arbitrary file types, size limits, formula/injection in generated files, zip bombs)
- LLM/AI usage if any (prompt injection, untrusted data reaching the model, output trusted without validation)
- frontend security (XSS, CSRF, exposed secrets in client bundle, client-only validation)
- CI/CD supply chain (unpinned actions/deps, secret handling, install script risk, permission scope of CI tokens)
- secrets & credentials management (hardcoded values, logging of sensitive data, rotation story)
- infra-as-config (deploy config, exposed admin surfaces, missing rate limits)
- dependency vulnerabilities (only if there's a clear signal worth a dedicated lens, not a generic "run npm audit")
- business-logic-specific risks unique to this repo's actual domain (from the profile above)

Aim for as many lenses as the repo's actual distinct surface area warrants — a small single-purpose service might need 6-8, a large multi-domain backend might need 18-20. Do NOT pad with redundant/near-duplicate lenses just to hit a round number, and do NOT skip a real distinct area to save calls.

For each lens, return only a short "name" (slug-like) and a one-line "focus" description — do NOT write the full investigation prompt here, that is a separate step.${excludeNote}${depthNote}`,
  { schema: PLAN_SCHEMA, phase: 'Lens design', label: 'lens-plan', ...modelOpt },
)
const planned = (plan?.lenses || []).filter((l) => l && l.name && l.focus)
log(`${planned.length} lens(es) planned: ${planned.map((l) => l.name).join(', ')}`)

// ── Write each lens's full prompt in small batches, not one giant call. A
// real run hit the platform's output-token limit mid-generation asking for
// ~19 lenses' full prompts (72K+ chars) in one non-interruptible turn, and a
// retry of that exact single-call shape stalled a second, different way
// (silent stream stop, no limit message). Batching bounds each call's
// output regardless of total lens count — see design notes below.
const BATCH_SIZE = 5
const batches = []
for (let i = 0; i < planned.length; i += BATCH_SIZE) batches.push(planned.slice(i, i + BATCH_SIZE))

function writeBatchPrompt(batch) {
  return `You are writing the full investigation prompt for ${batch.length} security-audit lens(es) already planned for this repo, given its profile:

Languages: ${(profile?.languages || []).join(', ')} · Domain: ${profile?.domain_summary} · Architecture: ${profile?.architecture_summary}

Lenses to write full prompts for (write ALL ${batch.length}, matching these names/focus verbatim):
${batch.map((l) => `- "${l.name}" — ${l.focus}`).join('\n')}

For each one, write a full "prompt" — the COMPLETE instructions you'd hand to an independent subagent with no other context, telling it exactly what to explore (which kind of files/patterns to grep for, what to read) and what to return: a list of findings, each with title, file, line (best-effort), description of the concrete issue, and an initial impact/probability guess. Tell each lens agent to anchor every finding to a real file:line it actually read — no speculation about code it didn't look at. Each prompt MUST also tell that lens agent not to investigate the excluded paths below, if any. Since this same lens may later run scoped to just a diff instead of the whole repo, phrase the prompt so it still makes sense when told "investigate only within these changed files/hunks" — i.e., don't hard-code "explore the whole repo" as the only mode of operation. You do not need to explore the repository yourself for THIS step — everything you need is already in this prompt.${excludeNote}`
}

async function writeBatch(batch) {
  return agent(writeBatchPrompt(batch), {
    schema: LENSES_SCHEMA,
    phase: 'Lens design',
    label: `lens-write:${batch.map((l) => l.name).join(',')}`,
    ...modelOpt,
  })
}

let batchResults = await parallel(batches.map((batch) => () => writeBatch(batch)))
const failedIdx = batchResults.map((r, i) => (!r ? i : -1)).filter((i) => i >= 0)
if (failedIdx.length > 0) {
  log(`${failedIdx.length}/${batches.length} lens-writing batch(es) failed — retrying once...`)
  const retried = await parallel(failedIdx.map((i) => () => writeBatch(batches[i])))
  retried.forEach((r, k) => {
    batchResults[failedIdx[k]] = r
  })
}
const stillFailed = batchResults.filter((r) => !r).length
if (stillFailed > 0) {
  log(
    `WARNING: ${stillFailed}/${batches.length} lens-writing batch(es) failed twice and were dropped — fewer lenses than planned will be persisted.`,
  )
}
const lenses = batchResults.filter(Boolean).flatMap((r) => (r?.lenses || []).filter((l) => l && l.prompt && l.name))
log(`${lenses.length}/${planned.length} lens(es) got a written prompt across ${batches.length} batch(es).`)

return { profile, lenses }
```

## Design notes (for maintainers)

- **Why lens design moved here from `audit-flow.md`:** profiling a repo and designing its
  investigation lenses is repo-shape work, not per-run work — redoing it on every
  `/16-eyes audit` call (and, worse, on every PR's `/16-eyes audit-diff`) burned two extra
  agent calls per run for a result that rarely changes between runs, and gave
  diff-scoped reviews no stable, comparable lens set to check PRs against over time.
- **Why lenses are phrased to work both full-repo and diff-scoped:** the exact same
  `lenses.json` is loaded by both `audit` (runs each lens across the whole repo) and
  `audit-diff` (runs each lens scoped to a diff's changed hunks) — see `audit-flow.md`
  and `audit-diff-flow.md`.
- **Auto-bootstrap exists specifically for CI.** A headless `claude -p "/16-eyes
  audit-diff"` run in a GitHub Action has no human to interview — if it hit Standard
  mode's Phase 3/4, it would hang waiting for input that will never come. Auto-bootstrap
  is what makes `audit-diff` safe to wire into CI on a repo that never ran `/16-eyes
  init` first.
- **Model preflight** (`{ error: 'model-preflight-failed' }` return) mirrors the same
  guard in `audit-flow.md`/`audit-diff-flow.md` — same real incident: a misconfigured
  `model` failed every subagent call. Here the stakes are worse if unguarded: a failed
  lens-design call would otherwise persist an empty or garbage `lenses.json` that every
  future `audit`/`audit-diff` run silently inherits. Never regress this.
- **Plan-then-batch-write, instead of one call for every lens's full prompt.** A real
  run asked a single `agent()` call for ~19 lenses' full prompts (72K+ chars) in one
  non-interruptible structured-output turn: it hit the platform's output-token limit
  mid-generation and produced no further output for 2+ minutes; a retry of that exact
  shape got further, then stalled a second, different way (a silent dead stream, no
  limit message). Splitting into a small planning call (name/focus only — tiny output,
  can't itself run long) followed by fixed-size batches of `BATCH_SIZE = 5` lenses each,
  written in `parallel()`, bounds every individual call's output regardless of how many
  lenses the repo needs, and a batch that fails outright is retried once on its own
  rather than losing the whole lens set. This trades a few extra agent calls (one plan +
  ⌈lenses/5⌉ batches, typically 4-5 total) for not depending on one giant call surviving
  in one piece — deliberately not one call per lens, which would remove the stall risk
  entirely but multiply agent count far more than the fix warrants.
- **Tool use during lens-writing is discouraged by instruction, not enforced.** The
  `agent()` call has no option to restrict tool access (checked against the Workflow
  tool's actual API) — a real run's lens-design agent made its own unprompted `ls`/grep
  calls despite already having everything it needed, adding latency. The batch-write
  prompt explicitly says exploration isn't needed; if that proves insufficient in
  practice, revisit once/if a tool-restriction option exists.
