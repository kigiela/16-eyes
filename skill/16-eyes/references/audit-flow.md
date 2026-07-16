# `/16-eyes audit` — analyze

Read-only. Never edits code.

## When invoked

1. **Determine `today`** from your own session context (the current date is always
   available to you) as `YYYY-MM-DD`.
2. **Determine `focus`** (optional): if the user's invocation named a specific area to
   concentrate on, pass that as `focus`. Otherwise omit it — the audit covers the whole
   repo.
3. **Read `.16-eyes/config.json`** if it exists (via the `Read` tool — the Workflow script
   itself has no filesystem access). Extract `excludePatterns`, `depth`,
   `adversarial.votesPerFinding`, and `language`. If the file is absent, proceed with no
   config and say so in your final summary — `/16-eyes init` was never a hard requirement.
4. **Call the `Workflow` tool** with `script` set to the *exact* contents of the code block
   below (copy it verbatim — do not paraphrase or "improve" it inline), and
   `args: { today, focus, excludePatterns, depth, votesPerFinding, language }` (all but
   `today` may be omitted/undefined if there's no config). This IS the user's explicit
   opt-in to multi-agent orchestration — the user invoking this named skill is the
   consent; do not ask again before calling `Workflow`.
5. **Take the workflow's return value** (`{ reportMarkdown, reportJson, stats }`) and write
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
6. **Report a short summary** to the user: counts (lenses run, findings confirmed real,
   safe vs risky, any refuted-on-adversarial-review or corrupted-verification items), and
   the paths to both files. Make clear that this skill **only produces the report — it
   does not touch any code**. Fixing is `/16-eyes fix`, a deliberate separate step; offer
   it, don't do it unprompted.

## The workflow script

```js
export const meta = {
  name: '16-eyes-audit',
  description:
    'Profile a repo, design custom investigation lenses, run them, verify findings, adversarially review high-impact ones, and produce a classified report.',
  phases: [
    { title: 'Profile' },
    { title: 'Lens design' },
    { title: 'Lenses' },
    { title: 'Verification' },
    { title: 'Adversarial review' },
    { title: 'Synthesis' },
  ],
}

// ── Schemas ──────────────────────────────────────────────────────────────
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
      "> Generated by the `16-eyes` skill: profiles the repository, designs investigation lenses tailored to it, runs them in parallel, verifies each finding skeptically, adversarially reviews (multiple independent skeptics) high-impact findings, and classifies the remainder into SAFE (mechanical fix) vs RISKY (needs a human decision). Not a linter, and not scoped to a single PR's diff — this is a sweep of the entire repository.",
    methodology: 'Methodology',
    repoProfile: 'Repo profile',
    lensesDesigned: 'Lenses designed',
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
      '> Gerado pelo skill `16-eyes`: perfila o repositório, desenha lentes de investigação sob medida pra ele, roda as lentes em paralelo, verifica cada achado ceticamente, faz revisão adversarial (múltiplos céticos independentes) nos achados de impacto alto, e classifica o resíduo em SAFE (correção mecânica) vs RISKY (decisão humana necessária). Não é um linter nem cobre só o diff de um PR — é um sweep do repositório inteiro.',
    methodology: 'Metodologia',
    repoProfile: 'Perfil do repo',
    lensesDesigned: 'Lentes desenhadas',
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
      '> Generado por el skill `16-eyes`: perfila el repositorio, diseña lentes de investigación a medida, las ejecuta en paralelo, verifica cada hallazgo de forma escéptica, hace una revisión adversarial (varios escépticos independientes) de los hallazgos de alto impacto, y clasifica el resto en SAFE (corrección mecánica) vs RISKY (requiere decisión humana). No es un linter ni se limita al diff de un PR — es un barrido de todo el repositorio.',
    methodology: 'Metodología',
    repoProfile: 'Perfil del repositorio',
    lensesDesigned: 'Lentes diseñadas',
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
const excludePatterns = (args && Array.isArray(args.excludePatterns) && args.excludePatterns) || []
const depth = args && args.depth === 'quick' ? 'quick' : 'thorough'
const configVotes =
  args && Number.isFinite(args.votesPerFinding) && args.votesPerFinding > 0 ? args.votesPerFinding : null
const language = args && T[args.language] ? args.language : 'en'
const L = T[language]
const languageName = LANGUAGE_NAMES[language]

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
- risk_relevant_subsystems: a list of specific things THIS repo has that matter for security (e.g. "handles payment/money movement", "has public webhooks", "calls an LLM with user-controlled input", "parses uploaded files", "has its own auth/session system", "runs SQL built from user input somewhere", "has an admin/internal-only surface", "is a monorepo with N packages") — be concrete and specific to what you actually find, not a generic list.${focus ? `\n\nThe user asked to focus this audit on: ${focus}. Still note the whole repo's shape, but flag if the focus area is smaller/larger than expected.` : ''}${excludeNote}`,
  { schema: PROFILE_SCHEMA, phase: 'Profile', label: 'profile' },
)
log(
  `Profile: ${(profile?.languages || []).join(', ')} · ${(profile?.risk_relevant_subsystems || []).length} risk-relevant subsystem(s) identified`,
)

phase('Lens design')
const lensDesign = await agent(
  `You are designing the investigation plan for a full-repository security audit, given this repo profile:

Languages: ${(profile?.languages || []).join(', ')}
Frameworks: ${(profile?.frameworks || []).join(', ')}
Domain: ${profile?.domain_summary}
Architecture: ${profile?.architecture_summary}
Risk-relevant subsystems found: ${(profile?.risk_relevant_subsystems || []).join('; ')}
${focus ? `User-requested focus: ${focus}` : ''}

Produce a list of investigation LENSES — each one a specific, non-overlapping area an independent subagent will investigate in depth. Consider (include what applies, SKIP what doesn't, and ADD repo-specific ones not listed here):
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

For each lens, write: a short "name" (slug-like), a one-line "focus" description, and a full "prompt" — the COMPLETE instructions you'd hand to an independent subagent with no other context, telling it exactly what to explore (which kind of files/patterns to grep for, what to read) and what to return: a list of findings, each with title, file, line (best-effort), description of the concrete issue, and an initial impact/probability guess. Tell each lens agent to anchor every finding to a real file:line it actually read — no speculation about code it didn't look at. Each lens's "prompt" you write MUST also tell that lens agent not to investigate the excluded paths below, if any.${excludeNote}${depthNote}`,
  { schema: LENSES_SCHEMA, phase: 'Lens design', label: 'lens-design' },
)
const lenses = (lensDesign?.lenses || []).filter((l) => l && l.prompt && l.name)
log(`${lenses.length} lens(es) designed: ${lenses.map((l) => l.name).join(', ')}`)
if (lenses.length === 0) {
  return {
    reportMarkdown: `# ${L.riskMatrixHeading.split(' ')[0]}\n\nFailed: no lenses were designed (the lens-design agent returned no valid lenses). Try again.`,
    reportJson: JSON.stringify({ error: 'no-lenses-designed' }, null, 2),
    stats: null,
  }
}

// ── Lenses → verification (pipeline, no barrier: each lens verifies as soon
// as it finishes, without waiting for the others) ────────────────────────
const seenKeys = new Set() // dedup by order of arrival across concurrent lenses — cost-only, not a correctness guarantee
const perLensVerified = await pipeline(
  lenses,
  (lens) => agent(lens.prompt, { schema: FINDINGS_SCHEMA, phase: 'Lenses', label: `lens:${lens.name}` }),
  (raw, lens) => {
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
        }).then((v) => {
          const corrupted = !v || looksCorrupted(v)
          return { ...f, lens: lens.name, verdict: corrupted ? null : v, verdict_corrupted: corrupted }
        }),
      ),
    )
  },
)
const allVerified = perLensVerified.flat().filter(Boolean)

const corrupted = allVerified.filter((f) => f.verdict_corrupted)
const needsVerdict = allVerified.filter((f) => !f.verdict_corrupted && f.verdict)
const realFindings = needsVerdict.filter((f) => f.verdict.is_real)
const falsePositives = needsVerdict.filter((f) => !f.verdict.is_real)
log(
  `${allVerified.length} unique finding(s) verified: ${realFindings.length} real, ${falsePositives.length} false-positive, ${corrupted.length} corrupted/failed verification (manual review)`,
)

// ── Adversarial review (high impact only) ────────────────────────────────
phase('Adversarial review')
const highImpact = realFindings.filter((f) => f.verdict.impact === 'high')
const otherImpact = realFindings.filter((f) => f.verdict.impact !== 'high')

// budget-aware: drops from the configured/default vote count to 1 refuter per finding
// if the token budget is running low.
const baseVotes = configVotes ?? (depth === 'quick' ? 1 : 3)
const votesPerFinding = budget.total && budget.remaining() < 200_000 ? 1 : baseVotes
if (highImpact.length > 0)
  log(`Adversarial review: ${highImpact.length} high-impact finding(s), ${votesPerFinding} refuter(s) each`)

const adversarial = await parallel(
  highImpact.map((f) => () =>
    parallel(
      Array.from({ length: votesPerFinding }, (_, i) => () =>
        agent(refutePrompt(f, languageName), {
          schema: REFUTE_SCHEMA,
          phase: 'Adversarial review',
          label: `refute:${f.lens}:${i}`,
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
- ${lenses.length} investigation lenses run, tailored to this repo (${profile?.domain_summary}).
- ${allVerified.length} candidate findings verified; ${realFindings.length} confirmed real, ${falsePositives.length} discarded as false-positive.
- ${refutedHighImpact.length} high-impact finding(s) were refuted by adversarial review and dropped.
- ${safeFindings.length} findings are SAFE to fix mechanically (no behavior change); ${riskyFindings.length} are RISKY (need a product/human decision before fixing).
Do not list individual findings — just the shape of the result and what the reader should do next (review the risky findings, decide on each; safe ones can be applied directly).`,
  { schema: EXEC_SUMMARY_SCHEMA, phase: 'Synthesis', label: 'exec-summary' },
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

- **${L.repoProfile}:** ${(profile?.languages || []).join(', ')} · ${profile?.domain_summary}
- **${L.lensesDesigned} (${lenses.length}):** ${lenses.map((l) => `\`${l.name}\` (${l.focus})`).join(', ')}
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
- **`looksCorrupted()`** exists because two real audit runs of this pattern
  returned a schema-valid object where every string field was the literal word
  `"test"` (stale cache / crossed fixture from a prior run). Schema validation
  alone doesn't catch this — always sanity-check field content, not just shape.
- **Dedup is best-effort and cost-only**, not a correctness guarantee — a
  finding that slips past it just gets verified twice, which is harmless.
- **No filesystem access inside the Workflow script** (by design of the tool) —
  the script returns `reportMarkdown`/`reportJson` as strings; writing them to
  disk happens in step 5 of "When invoked" above, outside the script.
- **`reportJson`'s `findings.safe[]`/`findings.risky[]`** (each with a stable
  `id: "${lens.name}-${index}"`) exist specifically so `/16-eyes fix` never has
  to regex structured data out of the markdown prose — see `fix-flow.md`.
- **`language`/`excludePatterns`/`depth`/`votesPerFinding` all come from
  `args`**, populated by the outer "when invoked" instructions from
  `.16-eyes/config.json` (read via `Read`, since the script itself can't touch
  the filesystem) — every one of them has a safe default when config is absent.
