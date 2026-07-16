import fs from "node:fs";
import { installTargetDir, integrationMetaPath } from "../lib/paths.js";
import { removeDirRecursive } from "../lib/copy.js";
import { removeIntegration } from "../lib/installCore.js";

const TOOL_LABELS = { gemini: "Gemini CLI", cursor: "Cursor", copilot: "GitHub Copilot" };

// Removes ONLY the installed skill/integration files. Never touches a target
// repository's own `.16-eyes/` directory (config, lenses, generated reports)
// or its `AGENTS.md` — those have a separate lifecycle and belong to
// whichever repo `/16-eyes init` ran in, not to this install.
export async function uninstall({ project = false, target = "claude" } = {}) {
  if (target === "claude") {
    return uninstallClaude({ project });
  }
  return uninstallIntegration(target);
}

async function uninstallClaude({ project }) {
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

async function uninstallIntegration(target) {
  const label = TOOL_LABELS[target] || target;
  const metaPath = integrationMetaPath(target);

  if (!metaPath || !fs.existsSync(metaPath)) {
    console.log(`Nothing installed for ${label} in this repo — nothing to do.`);
    return;
  }

  removeIntegration(target);
  console.log(`Removed the 16-eyes ${label} integration from this repo.`);
  console.log(
    "(Any .16-eyes/ config/lenses/reports, and the 16-eyes section of AGENTS.md, are untouched — those belong to this repo, not to this install.)",
  );
}
