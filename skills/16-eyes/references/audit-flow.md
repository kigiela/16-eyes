# `/16-eyes audit` — analyze

Read-only. Never edits code.

## When invoked

1. **Determine `today`** from your own session context (the current date is always
   available to you) as `YYYY-MM-DD`.
2. **Determine `focus`** (optional): if the user's invocation named a specific area to
   concentrate on, pass that as `focus`. Otherwise omit it — the audit runs every
   persisted lens.
3. **Read `.16-eyes/config.json`** if it exists (via the `Read` tool — the Workflow script
   itself has no filesystem access). Extract `depth`, `adversarial.votesPerFinding`,
   `language`, `model` (default `"sonnet"` if absent — an older config written before
   this field existed), and `lensesPointer` (default `.16-eyes/lenses.json`). If the file
   is absent, proceed with documented defaults.
4. **Read the lenses file** at `lensesPointer`. **If it doesn't exist:**
   - **Interactive session** (a human is present and can respond right now — not a
     headless `claude -p` run, not CI): stop and tell the user plainly that no
     investigation lenses exist yet for this repo, that this would be a first-time,
     un-reviewed default setup (thorough depth, sonnet model — see `init-flow.md`'s
     Auto-bootstrap mode), and that continuing means auto-bootstrapping those defaults
     and then immediately running a full-repo sweep (dozens of agent calls, several
     minutes). Ask for an explicit go-ahead before doing either; mention `/16-eyes
     init` as the alternative if they'd rather customize first. This is a one-time
     gate — once `.16-eyes/lenses.json` exists, later `audit`/`audit-diff` runs never
     ask this again.
   - **Headless/CI** (no human can respond): skip the question — run the
     Auto-bootstrap flow from `init-flow.md` immediately, exactly as today. This must
     complete unattended.
   - Either way, once bootstrapped, this creates `.16-eyes/config.json` (if that was
     also missing) and `.16-eyes/lenses.json` non-interactively, then re-read both.
     Never invent lenses yourself, and never skip this step: `audit` always runs
     against a persisted, previously-designed lens set, never a set it improvises on
     the spot.
5. **Call the `Workflow` tool** with `script` set to the *exact* contents of the code block
   below (copy it verbatim — do not paraphrase or "improve" it inline), and
   `args: { today, focus, profile, lenses, depth, votesPerFinding, language, model }`, where
   `profile` is `{ languages, domain_summary }` read straight from the lenses file (not
   re-derived) and `lenses` is that file's `lenses` array verbatim. This IS the user's
   explicit opt-in to multi-agent orchestration — the user invoking this named skill is
   the consent; do not ask again before calling `Workflow`.
6. **Take the workflow's return value** (`{ reportMarkdown, reportJson, stats }`) and write
   **both** files with the `Write` tool:
   - Markdown: `<outputDir>/SECURITY_AUDIT_<today>.md` (human-readable).
   - JSON: `<outputDir>/SECURITY_AUDIT_<today>.json` (machine-readable — `reportJson`,
     already a JSON string from the script).
   - `<outputDir>` is `config.output.dir` if set, else `docs/` if that directory exists,
     else the repo root. If a report for `<today>` already exists at that path (a same-day
     re-run), append `-2`, `-3`, etc. to BOTH filenames — never overwrite an existing
     report.
   - Then write/overwrite `.16-eyes/last-run.json` (path from `config.lastRunPointer`,
     default `.16-eyes/last-run.json`) with `{ markdown: "<md path>", json: "<json path>",
     generatedAt: "<ISO timestamp from your own context>", stats }` — this is a small
     pointer, not the full findings, so `/16-eyes fix` can find the latest run later
     (including in a different session).
7. **Report a short summary** to the user: counts (lenses run, findings confirmed real,
   safe vs risky, any refuted-on-adversarial-review or corrupted-verification items), and
   the paths to both files. **If step 4 auto-bootstrapped config/lenses**, say so plainly
   (what was defaulted, and that `/16-eyes init` can be re-run anytime to customize it).
   Make clear that this skill **only produces the report — it does not touch any code**.
   Fixing is `/16-eyes fix`, a deliberate separate step; offer it, don't do it unprompted.

## The workflow script

```js
export const meta = {
  name: '16-eyes-audit',
  description:
    "Run a repo's persisted investigation lenses across the whole codebase, verify every finding, adversarially review high-impact ones, and produce a classified report.",
  phases: [
    { title: 'Preflight' },
    { title: 'Lens selection' },
    { title: 'Lenses' },
    { title: 'Verification' },
    { title: 'Adversarial review' },
    { title: 'Synthesis' },
  ],
}

// ── Schemas ──────────────────────────────────────────────────────────────
const LENS_SELECTION_SCHEMA = {
  type: 'object',
  properties: { selectedLensNames: { type: 'array', items: { type: 'string' } } },
  required: ['selectedLensNames'],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          description: { type: 'string' },
          initial_impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          initial_probability: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'file', 'description'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    is_real: { type: 'boolean' },
    impact: { type: 'string', enum: ['high', 'medium', 'low'] },
    probability: { type: 'string', enum: ['high', 'medium', 'low'] },
    fix_type: { type: 'string', enum: ['safe', 'risky'] },
    exploit_scenario: { type: 'string' },
    why: { type: 'string' },
    suggested_fix: { type: 'string' },
  },
  required: ['is_real', 'impact', 'probability', 'fix_type', 'why'],
}

const REFUTE_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['refuted', 'reason'],
}

const EXEC_SUMMARY_SCHEMA = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
}

// ── i18n — report content + agent output language ─────────────────────────
const LANGUAGE_NAMES = { en: 'English', pt: 'Brazilian Portuguese', es: 'Spanish' }

const T = {
  en: {
    intro:
      "> Generated by the `16-eyes` skill: runs this repo's tailored investigation lenses (designed once by `/16-eyes init`) in parallel across the whole codebase, verifies each finding skeptically, adversarially reviews (multiple independent skeptics) high-impact findings, and classifies the remainder into SAFE (mechanical fix) vs RISKY (needs a human decision). Not a linter, and not scoped to a single PR's diff — this is a sweep of the entire repository.",
    methodology: 'Methodology',
    repoProfile: 'Repo profile',
    lensesDesigned: 'Lenses run',
    rawToVerified: 'Raw → verified findings',
    corruptedSuffix: 'with corrupted/failed verification (see appendix)',
    adversarialReview: 'Adversarial review',
    adversarialSummary: (h, v, r) =>
      `${h} high-impact finding(s) went through ${v} independent reviewer(s) trying to refute them; ${r} were refuted and discarded.`,
    riskMatrixHeading: 'Risk matrix (impact × probability)',
    matrixHeaderCol: 'Impact \\ Probability',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    safeHeading: 'SAFE findings — mechanical fix, no behavior change',
    riskyHeading: 'RISKY findings — need a human decision before fixing',
    none: '_None._',
    appendixHeading: 'Appendix — discarded',
    falsePositiveHeading: 'False positive',
    adversarialDiscardedHeading: 'Discarded in adversarial review',
    corruptedHeading: 'Corrupted/failed verification — needs manual review',
    findingWhere: 'Where',
    findingLens: 'Lens',
    findingImpactProb: 'Impact/Probability',
    findingWhat: 'What',
    findingExploit: 'Exploit scenario',
    findingWhyRisky: "Why it's risky",
    findingWhySafe: "Why it's safe to fix",
    findingSuggestedFix: 'Suggested fix',
    notSpecified: '(not specified)',
    reviewersRefuted: 'reviewer(s) refuted',
  },
  pt: {
    intro:
      '> Gerado pelo skill `16-eyes`: roda as lentes de investigação deste repositório (desenhadas uma vez pelo `/16-eyes init`) em paralelo em todo o codebase, verifica cada achado ceticamente, faz revisão adversarial (múltiplos céticos independentes) nos achados de impacto alto, e classifica o resíduo em SAFE (correção mecânica) vs RISKY (decisão humana necessária). Não é um linter nem cobre só o diff de um PR — é um sweep do repositório inteiro.',
    methodology: 'Metodologia',
    repoProfile: 'Perfil do repo',
    lensesDesigned: 'Lentes rodadas',
    rawToVerified: 'Achados brutos → verificados',
    corruptedSuffix: 'com verificação corrompida/falha (ver apêndice)',
    adversarialReview: 'Revisão adversarial',
    adversarialSummary: (h, v, r) =>
      `${h} achado(s) de impacto alto passaram por ${v} revisor(es) independente(s) tentando refutar; ${r} foram refutados e descartados.`,
    riskMatrixHeading: 'Matriz de risco (impacto × probabilidade)',
    matrixHeaderCol: 'Impacto \\ Probabilidade',
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    safeHeading: 'Achados SAFE — correção mecânica, sem mudança de comportamento',
    riskyHeading: 'Achados RISKY — precisam de decisão humana antes de corrigir',
    none: '_Nenhum._',
    appendixHeading: 'Apêndice — descartados',
    falsePositiveHeading: 'Falso-positivo',
    adversarialDiscardedHeading: 'Refutado na revisão adversarial',
    corruptedHeading: 'Verificação corrompida/falhou — revisar manualmente',
    findingWhere: 'Onde',
    findingLens: 'Lente',
    findingImpactProb: 'Impacto/Probabilidade',
    findingWhat: 'O quê',
    findingExploit: 'Cenário de exploração',
    findingWhyRisky: 'Por quê é risky',
    findingWhySafe: 'Por quê é seguro corrigir',
    findingSuggestedFix: 'Sugestão de correção',
    notSpecified: '(não especificada)',
    reviewersRefuted: 'revisor(es) refutaram',
  },
  es: {
    intro:
      '> Generado por el skill `16-eyes`: ejecuta las lentes de investigación de este repositorio (diseñadas una vez por `/16-eyes init`) en paralelo en todo el código, verifica cada hallazgo de forma escéptica, hace una revisión adversarial (varios escépticos independientes) de los hallazgos de alto impacto, y clasifica el resto en SAFE (corrección mecánica) vs RISKY (requiere decisión humana). No es un linter ni se limita al diff de un PR — es un barrido de todo el repositorio.',
    methodology: 'Metodología',
    repoProfile: 'Perfil del repositorio',
    lensesDesigned: 'Lentes ejecutadas',
    rawToVerified: 'Hallazgos brutos → verificados',
    corruptedSuffix: 'con verificación corrupta/fallida (ver apéndice)',
    adversarialReview: 'Revisión adversarial',
    adversarialSummary: (h, v, r) =>
      `${h} hallazgo(s) de alto impacto pasaron por ${v} revisor(es) independiente(s) intentando refutarlos; ${r} fueron refutados y descartados.`,
    riskMatrixHeading: 'Matriz de riesgo (impacto × probabilidad)',
    matrixHeaderCol: 'Impacto \\ Probabilidad',
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    safeHeading: 'Hallazgos SAFE — corrección mecánica, sin cambio de comportamiento',
    riskyHeading: 'Hallazgos RISKY — requieren decisión humana antes de corregir',
    none: '_Ninguno._',
    appendixHeading: 'Apéndice — descartados',
    falsePositiveHeading: 'Falso positivo',
    adversarialDiscardedHeading: 'Descartado en la revisión adversarial',
    corruptedHeading: 'Verificación corrupta/fallida — revisar manualmente',
    findingWhere: 'Dónde',
    findingLens: 'Lente',
    findingImpactProb: 'Impacto/Probabilidad',
    findingWhat: 'Qué',
    findingExploit: 'Escenario de explotación',
    findingWhyRisky: 'Por qué es risky',
    findingWhySafe: 'Por qué es seguro corregir',
    findingSuggestedFix: 'Corrección sugerida',
    notSpecified: '(no especificada)',
    reviewersRefuted: 'revisor(es) refutaron',
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────

// Guard against a corruption pattern seen twice in real runs of this exact
// pattern: a schema-valid object where every string field is literally
// "test" (stale cache / crossed test fixture). Never trust it blindly —
// route it to manual review instead of silently trusting or dropping it.
function looksCorrupted(obj) {
  if (!obj || typeof obj !== 'object') return false
  const strings = Object.values(obj).filter((v) => typeof v === 'string' && v.length > 0)
  return strings.length > 0 && strings.every((v) => v.trim().toLowerCase() === 'test')
}

function dedupKey(f) {
  const file = (f.file || '').trim().toLowerCase()
  const line = f.line == null ? '?' : String(f.line)
  return `${file}:${line}`
}

function verifyPrompt(f, focusHint, languageName) {
  return `You are adversarially verifying a security finding raised by another agent during a full-repo audit${focusHint ? ` (scope: ${focusHint})` : ''}.

Finding: "${f.title}"
File: ${f.file}${f.line ? `:${f.line}` : ''}
Description: ${f.description}
Initial impact guess: ${f.initial_impact ?? 'unknown'} · Initial probability guess: ${f.initial_probability ?? 'unknown'}

Re-read the ACTUAL code at that location (and its real callers/config) yourself — do not trust the description above at face value. Then decide:
- is_real: is this a genuine issue in the code as it exists today (not hypothetical, not already mitigated elsewhere, not dead code)?
- impact: high/medium/low if exploited (money movement, auth bypass, data breach = high; degraded UX or internal-only = low).
- probability: high/medium/low that this is actually reachable/exploitable given real callers and current config — not just "possible in theory".
- fix_type: "safe" if a fix is purely mechanical and changes no behavior for any legitimate flow today (e.g. add a missing check, pin a version); "risky" if fixing it changes behavior for a flow that might be relied on today, touches money/auth, or needs a product decision (threshold, tolerance, UX tradeoff).
- exploit_scenario: concrete inputs/steps that would trigger it (empty if not real).
- suggested_fix: a specific, minimal fix.
- why: your reasoning, referencing the real code you read.

Be skeptical. A finding that sounds scary in the abstract but isn't actually reachable, or is already handled by a check elsewhere, is NOT real — say so.

Write "why", "exploit_scenario", and "suggested_fix" in ${languageName}.`
}

function refutePrompt(f, languageName) {
  return `Try to REFUTE this security finding from a full-repo audit (it already passed one verification pass and was classified impact=high — this is a 2nd, adversarial, independent check before it goes in a report someone will act on).

Finding: "${f.title}"
File: ${f.file}${f.line ? `:${f.line}` : ''}
Description: ${f.description}
Why it was judged real: ${f.verdict?.why ?? ''}
Exploit scenario claimed: ${f.verdict?.exploit_scenario ?? ''}

Read the actual code yourself. Look hard for a reason this ISN'T actually exploitable: a guard elsewhere, a precondition that can't occur, dead code, a framework default that already prevents it, or a misread of the code. If you genuinely cannot find a flaw in the finding after really trying, refuted=false. If you are UNCERTAIN either way, default to refuted=true — a finding has to survive skepticism to earn a spot in the report, not just avoid being disproven.

Write "reason" in ${languageName}.`
}

// ── Script body ──────────────────────────────────────────────────────────

const focus = args && args.focus ? String(args.focus) : null
const today = (args && args.today) || 'unknown-date'
const profile = (args && args.profile) || {}
const depth = args && args.depth === 'quick' ? 'quick' : 'thorough'
const configVotes =
  args && Number.isFinite(args.votesPerFinding) && args.votesPerFinding > 0 ? args.votesPerFinding : null
const language = args && T[args.language] ? args.language : 'en'
const L = T[language]
const languageName = LANGUAGE_NAMES[language]
const modelPolicy = args && typeof args.model === 'string' ? args.model : 'sonnet'
const modelOpt = modelPolicy !== 'default' ? { model: modelPolicy } : {}

const allLenses = ((args && Array.isArray(args.lenses) && args.lenses) || []).filter((l) => l && l.prompt && l.name)
if (allLenses.length === 0) {
  return {
    reportMarkdown: `# 16 Eyes — ${today}\n\nFailed: no investigation lenses were available (\`.16-eyes/lenses.json\` was empty, and auto-bootstrap did not produce any). Run \`/16-eyes init\` and try again.`,
    reportJson: JSON.stringify({ error: 'no-lenses-available' }, null, 2),
    stats: null,
  }
}

// ── Model preflight — fail fast, never let a broken model masquerade as a
// clean "0 findings" audit. Runs before any lens/verify/adversarial fan-out.
phase('Preflight')
const PREFLIGHT_SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }
const preflight = await agent('Reply with exactly {"ok": true}.', {
  schema: PREFLIGHT_SCHEMA,
  phase: 'Preflight',
  label: 'model-preflight',
  ...modelOpt,
})
if (!preflight || preflight.ok !== true) {
  return {
    reportMarkdown: `# 16 Eyes — ${today}\n\nAborted: the configured model (\`${modelPolicy}\`) failed a preflight check before any investigation ran — this is NOT a clean audit, no lenses ran. Fix \`model\` in \`.16-eyes/config.json\` (or re-run \`/16-eyes init\`) and try again.`,
    reportJson: JSON.stringify({ error: 'model-preflight-failed', model: modelPolicy }, null, 2),
    stats: null,
  }
}
log(
  `Model preflight ok (${modelPolicy}). Estimate: ${allLenses.length} lens agent(s), 1 verification per finding they report (uncapped), up to ${configVotes ?? (depth === 'quick' ? 1 : 3)} adversarial vote(s) per high-impact finding — expect tens of agent calls for a thorough run.`,
)

// ── Optional focus-based lens selection (lenses themselves are fixed —
// designed once by /16-eyes init — a per-invocation "focus" narrows WHICH
// of them run this time, it never redesigns any) ──────────────────────────
let lenses = allLenses
if (focus) {
  phase('Lens selection')
  log(`Selecting which of the ${allLenses.length} persisted lens(es) are relevant to focus: "${focus}"...`)
  const selection = await agent(
    `Given this focus area for a security review: "${focus}", and this list of available investigation lenses (name — focus), select every lens that's plausibly relevant. Be inclusive when in doubt — a lens can stay even if only partially relevant, but leave out ones with clearly no connection.\n\n${allLenses.map((l) => `- ${l.name} — ${l.focus}`).join('\n')}`,
    { schema: LENS_SELECTION_SCHEMA, phase: 'Lens selection', label: 'lens-selection', ...modelOpt },
  )
  const selectedNames = new Set((selection?.selectedLensNames || []).map((n) => String(n)))
  const filtered = allLenses.filter((l) => selectedNames.has(l.name))
  if (filtered.length === 0) {
    log('No persisted lens matched the requested focus — falling back to running all of them.')
  } else {
    lenses = filtered
    log(`${lenses.length}/${allLenses.length} lens(es) selected for this focus.`)
  }
}

// ── Lenses → verification (pipeline, no barrier: each lens verifies as soon
// as it finishes, without waiting for the others) ────────────────────────
phase('Lenses')
const seenKeys = new Set() // dedup by order of arrival across concurrent lenses — cost-only, not a correctness guarantee
let lensFailures = 0
const perLensVerified = await pipeline(
  lenses,
  (lens) => agent(lens.prompt, { schema: FINDINGS_SCHEMA, phase: 'Lenses', label: `lens:${lens.name}`, ...modelOpt }),
  (raw, lens) => {
    if (!raw) {
      lensFailures++
      log(`${lens.name}: lens agent call failed or returned nothing — skipped, NOT counted as "found nothing"`)
      return []
    }
    const findings = (raw?.findings || []).filter((f) => f && f.title && f.file)
    const fresh = findings.filter((f) => {
      const k = dedupKey(f)
      if (seenKeys.has(k)) return false
      seenKeys.add(k)
      return true
    })
    if (fresh.length < findings.length) {
      log(`${lens.name}: ${findings.length - fresh.length} finding(s) dropped by dedup (same file:line already seen)`)
    }
    return parallel(
      fresh.map((f) => () =>
        agent(verifyPrompt(f, focus, languageName), {
          schema: VERDICT_SCHEMA,
          phase: 'Verification',
          label: `verify:${lens.name}`,
          ...modelOpt,
        }).then((v) => {
          const corrupted = !v || looksCorrupted(v)
          return { ...f, lens: lens.name, verdict: corrupted ? null : v, verdict_corrupted: corrupted }
        }),
      ),
    )
  },
)
// guard: every lens failing must NOT read as "swept the repo, found nothing" —
// the exact failure mode that produced a false-clean report in a real run (bad
// configured model → every subagent call failed → report said "0 findings").
if (lensFailures > 0 && lensFailures === lenses.length) {
  return {
    reportMarkdown: `# 16 Eyes — ${today}\n\nAborted: all ${lenses.length} lens agent(s) failed mid-run (model: \`${modelPolicy}\`) — this is NOT a clean audit. Check the configured model in \`.16-eyes/config.json\` and try again.`,
    reportJson: JSON.stringify({ error: 'all-lenses-failed', model: modelPolicy, lensFailures }, null, 2),
    stats: null,
  }
}
const allVerified = perLensVerified.flat().filter(Boolean)

const corrupted = allVerified.filter((f) => f.verdict_corrupted)
const needsVerdict = allVerified.filter((f) => !f.verdict_corrupted && f.verdict)
const realFindings = needsVerdict.filter((f) => f.verdict.is_real)
const falsePositives = needsVerdict.filter((f) => !f.verdict.is_real)
// same guard for verification: every verify call failing/corrupted must not
// silently pass through as "0 real, 0 false-positive" — flag it loudly instead.
if (allVerified.length > 0 && corrupted.length === allVerified.length) {
  log(
    `WARNING: all ${allVerified.length} verification call(s) failed or returned corrupted output — every finding below is unverified.`,
  )
}
log(
  `${allVerified.length} unique finding(s) verified: ${realFindings.length} real, ${falsePositives.length} false-positive, ${corrupted.length} corrupted/failed verification (manual review)${lensFailures > 0 ? ` — ${lensFailures}/${lenses.length} lens(es) failed and were skipped` : ''}`,
)

// ── Adversarial review (high impact only) ────────────────────────────────
phase('Adversarial review')
const highImpact = realFindings.filter((f) => f.verdict.impact === 'high')
const otherImpact = realFindings.filter((f) => f.verdict.impact !== 'high')

// budget-aware: drops from the configured/default vote count to 1 refuter per finding
// if the token budget is running low.
const baseVotes = configVotes ?? (depth === 'quick' ? 1 : 3)
const votesPerFinding = budget.total && budget.remaining() < 200_000 ? 1 : baseVotes
if (highImpact.length > 0) {
  const budgetNote =
    votesPerFinding < baseVotes && budget.total
      ? ` (reduced from ${baseVotes} — budget running low: ~${Math.round((budget.remaining() / budget.total) * 100)}% remaining)`
      : ''
  log(`Adversarial review: ${highImpact.length} high-impact finding(s), ${votesPerFinding} refuter(s) each${budgetNote}`)
}

const adversarial = await parallel(
  highImpact.map((f) => () =>
    parallel(
      Array.from({ length: votesPerFinding }, (_, i) => () =>
        agent(refutePrompt(f, languageName), {
          schema: REFUTE_SCHEMA,
          phase: 'Adversarial review',
          label: `refute:${f.lens}:${i}`,
          ...modelOpt,
        }),
      ),
    ).then((votes) => {
      const valid = votes.filter(Boolean).filter((v) => !looksCorrupted(v))
      // guard: 0 valid votes must NOT count as "survived" (a real bug seen in an earlier run of this pattern).
      const refuteCount = valid.filter((v) => v.refuted).length
      const survived = valid.length > 0 && refuteCount * 2 < valid.length
      return { ...f, adversarial: { votes: valid.length, refuted: refuteCount, survived } }
    }),
  ),
)
const survivedHighImpact = adversarial.filter(Boolean).filter((f) => f.adversarial.survived)
const refutedHighImpact = adversarial.filter(Boolean).filter((f) => !f.adversarial.survived)
if (refutedHighImpact.length > 0) {
  log(
    `${refutedHighImpact.length} high-impact finding(s) refuted by a majority of reviewers — dropped from the final report (listed in the appendix)`,
  )
}

const finalReal = [...survivedHighImpact, ...otherImpact]
const safeFindings = finalReal.filter((f) => f.verdict.fix_type === 'safe')
const riskyFindings = finalReal.filter((f) => f.verdict.fix_type === 'risky')

// ── Synthesis ───────────────────────────────────────────────────────────────
phase('Synthesis')
const execSummaryOut = await agent(
  `Write a short (3-6 sentence) executive summary in ${languageName} for a full-repo security audit report, given these results:
- ${lenses.length} investigation lenses run, tailored to this repo${profile?.domain_summary ? ` (${profile.domain_summary})` : ''}.
- ${allVerified.length} candidate findings verified; ${realFindings.length} confirmed real, ${falsePositives.length} discarded as false-positive.
- ${refutedHighImpact.length} high-impact finding(s) were refuted by adversarial review and dropped.
- ${safeFindings.length} findings are SAFE to fix mechanically (no behavior change); ${riskyFindings.length} are RISKY (need a product/human decision before fixing).
Do not list individual findings — just the shape of the result and what the reader should do next (review the risky findings, decide on each; safe ones can be applied directly).`,
  { schema: EXEC_SUMMARY_SCHEMA, phase: 'Synthesis', label: 'exec-summary', ...modelOpt },
)
const execSummary = execSummaryOut?.summary || ''

// stable ids for the structured findings handoff (consumed by /16-eyes fix)
function withId(f, i) {
  return { id: `${f.lens}-${i}`, ...f }
}
const safeStructured = safeFindings.map(withId)
const riskyStructured = riskyFindings.map(withId)

function impactProbLabel(f) {
  return `${f.verdict.impact}/${f.verdict.probability}`
}

function findingBlock(f, i) {
  return `### ${i + 1}. ${f.title}

- **${L.findingWhere}:** \`${f.file}${f.line ? `:${f.line}` : ''}\`
- **${L.findingLens}:** ${f.lens} · **${L.findingImpactProb}:** ${impactProbLabel(f)}
- **${L.findingWhat}:** ${f.description}
${f.verdict.exploit_scenario ? `- **${L.findingExploit}:** ${f.verdict.exploit_scenario}\n` : ''}- **${f.verdict.fix_type === 'risky' ? L.findingWhyRisky : L.findingWhySafe}:** ${f.verdict.why}
- **${L.findingSuggestedFix}:** ${f.verdict.suggested_fix || L.notSpecified}
`
}

const riskMatrix = (() => {
  const cells = {
    high: { high: [], medium: [], low: [] },
    medium: { high: [], medium: [], low: [] },
    low: { high: [], medium: [], low: [] },
  }
  for (const f of finalReal) {
    const imp = cells[f.verdict.impact] ? f.verdict.impact : 'medium'
    const prob = cells[imp][f.verdict.probability] ? f.verdict.probability : 'medium'
    cells[imp][prob].push(f.title)
  }
  const row = (imp) =>
    `| **${L[imp]}** | ${cells[imp].low.join(' · ') || '—'} | ${cells[imp].medium.join(' · ') || '—'} | ${cells[imp].high.join(' · ') || '—'} |`
  return `| ${L.matrixHeaderCol} | ${L.low} | ${L.medium} | ${L.high} |\n|---|---|---|---|\n${row('high')}\n${row('medium')}\n${row('low')}`
})()

const corruptedSuffixText = corrupted.length ? `, ${corrupted.length} ${L.corruptedSuffix}` : ''

const reportMarkdown = `# 16 Eyes — ${today}

${L.intro}

${execSummary}

## ${L.methodology}

${profile?.languages || profile?.domain_summary ? `- **${L.repoProfile}:** ${(profile?.languages || []).join(', ')} · ${profile?.domain_summary || ''}\n` : ''}- **${L.lensesDesigned} (${lenses.length}):** ${lenses.map((l) => `\`${l.name}\` (${l.focus})`).join(', ')}
- **${L.rawToVerified}:** ${allVerified.length} candidates, ${realFindings.length} confirmed real, ${falsePositives.length} discarded as false positive${corruptedSuffixText}.
- **${L.adversarialReview}:** ${L.adversarialSummary(highImpact.length, votesPerFinding, refutedHighImpact.length)}

## ${L.riskMatrixHeading}

${riskMatrix}

---

## ${L.safeHeading} (${safeFindings.length})

${safeFindings.length === 0 ? L.none : safeFindings.map(findingBlock).join('\n')}

---

## ${L.riskyHeading} (${riskyFindings.length})

${riskyFindings.length === 0 ? L.none : riskyFindings.map(findingBlock).join('\n')}

---

## ${L.appendixHeading}

${falsePositives.length === 0 ? '' : `### ${L.falsePositiveHeading} (${falsePositives.length})\n\n${falsePositives.map((f) => `- **${f.title}** (\`${f.file}${f.line ? `:${f.line}` : ''}\`) — ${f.verdict.why}`).join('\n')}\n\n`}${refutedHighImpact.length === 0 ? '' : `### ${L.adversarialDiscardedHeading} (${refutedHighImpact.length})\n\n${refutedHighImpact.map((f) => `- **${f.title}** (\`${f.file}${f.line ? `:${f.line}` : ''}\`) — ${f.adversarial.refuted}/${f.adversarial.votes} ${L.reviewersRefuted}`).join('\n')}\n\n`}${corrupted.length === 0 ? '' : `### ${L.corruptedHeading} (${corrupted.length})\n\n${corrupted.map((f) => `- **${f.title}** (\`${f.file}${f.line ? `:${f.line}` : ''}\`)`).join('\n')}\n`}
`

const stats = {
  lenses: lenses.length,
  candidates: allVerified.length,
  real: realFindings.length,
  falsePositives: falsePositives.length,
  safe: safeFindings.length,
  risky: riskyFindings.length,
  refutedHighImpact: refutedHighImpact.length,
  corrupted: corrupted.length,
}

const reportJson = JSON.stringify(
  {
    schemaVersion: 1,
    date: today,
    stats,
    findings: { safe: safeStructured, risky: riskyStructured },
    appendix: {
      falsePositives: falsePositives.map((f, i) => withId(f, i)),
      refutedHighImpact: refutedHighImpact.map((f, i) => withId(f, i)),
      corrupted: corrupted.map((f, i) => withId(f, i)),
    },
  },
  null,
  2,
)

return { reportMarkdown, reportJson, stats }
```

## Design notes (for maintainers)

- **Why lenses are no longer designed here:** profiling + lens design moved to
  `/16-eyes init` (`init-flow.md`) — they're repo-shape work, not per-run work.
  This script now always receives a persisted `args.lenses` (guaranteed non-empty by the
  auto-bootstrap step in "When invoked" step 4) and starts straight at the Lenses→Verify
  pipeline.
- **`focus` now filters, it never designs.** A per-invocation focus narrows which of the
  persisted lenses run this time (one small selection agent call) — it can no longer
  steer what the lenses themselves investigate, since they're fixed at init time. If the
  selection call returns nothing relevant, fall back to running everything rather than
  silently producing an empty audit.
- **Why `pipeline()` for lenses→verify, not `parallel()`+barrier:** verification of
  lens A's findings starts the moment lens A finishes, without waiting on the
  slowest lens. This is the canonical "Review → Verify" pipeline pattern from the
  Workflow tool's own docs.
- **Why adversarial review only for `impact:"high"`:** cost control — a single
  skeptical verify pass is enough for medium/low findings; only findings that
  would justify real urgency get the expensive multi-refuter pass before being
  trusted enough to land in a report someone acts on.
- **The "0 valid votes ≠ survived" guard** (`valid.length > 0 && refuteCount * 2
  < valid.length`) exists because an earlier version of this exact pattern had a
  real bug: if every refuter agent failed (rate limit, transient error), the
  finding was treated as "survived" by default — meaning a finding could reach
  the final report with **zero** actual adversarial scrutiny. Never regress this.
- **Model preflight + the lens/verify all-failed guards** exist because a real run
  had a misconfigured `model` in `.16-eyes/config.json` (pointed at a model
  unavailable in that environment): every subagent call failed, and the script —
  before these guards existed — reported a clean "0 achados" audit instead of an
  error. Preflight catches a broken model in one cheap call before any fan-out
  starts; the lens/verify all-failed guards catch a model that degrades mid-run
  instead of failing outright at the start. Never regress either — a security
  audit that fails must say so loudly, never report clean.
- **`looksCorrupted()`** exists because two real audit runs of this pattern
  returned a schema-valid object where every string field was the literal word
  `"test"` (stale cache / crossed fixture from a prior run). Schema validation
  alone doesn't catch this — always sanity-check field content, not just shape.
- **Dedup is best-effort and cost-only**, not a correctness guarantee — a
  finding that slips past it just gets verified twice, which is harmless.
- **No filesystem access inside the Workflow script** (by design of the tool) —
  the script returns `reportMarkdown`/`reportJson` as strings; writing them to
  disk happens in step 6 of "When invoked" above, outside the script.
- **`reportJson`'s `findings.safe[]`/`findings.risky[]`** (each with a stable
  `id: "${lens.name}-${index}"`) exist specifically so `/16-eyes fix` never has
  to regex structured data out of the markdown prose — see `fix-flow.md`.
- **`profile`/`depth`/`votesPerFinding`/`language` all come from `args`**,
  populated by the outer "when invoked" instructions from `.16-eyes/config.json`
  and `.16-eyes/lenses.json` — every one of them has a safe default when config
  is absent (and lenses are guaranteed present by auto-bootstrap).
- **This exact script's Lenses→Synthesis stages are shared, conceptually, with
  `audit-diff-flow.md`** — that flow wraps each lens's prompt with diff content
  before running what is otherwise the identical pipeline. If you change the
  verify/adversarial/synthesis logic here, mirror the change there too.
