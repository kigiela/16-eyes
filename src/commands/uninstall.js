import fs from "node:fs";
import { installTargetDir } from "../lib/paths.js";
import { removeDirRecursive } from "../lib/copy.js";

// Removes ONLY the installed skill directory (SKILL.md/references/assets/.install-meta.json).
// Never touches a target repository's own `.16-eyes/` directory (config + generated
// reports) — that has a separate lifecycle and belongs to whichever repo `/16-eyes init`
// ran in, not to this global/per-project skill installation.
export async function uninstall({ project = false } = {}) {
  const targetDir = installTargetDir({ project });

  if (!fs.existsSync(targetDir)) {
    console.log(`Nothing installed at ${targetDir} — nothing to do.`);
    return;
  }

  removeDirRecursive(targetDir);
  console.log(`Removed 16-eyes from ${targetDir}.`);
  console.log(
    "(Any .16-eyes/ config or SECURITY_AUDIT_*.md/.json reports in repos where you ran /16-eyes are untouched — those belong to that repo, not to this install.)",
  );
}
