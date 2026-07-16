import fs from "node:fs";
import { copySkill, copyIntegration } from "../lib/installCore.js";
import { installTargetDir, installMetaPath, integrationMetaPath } from "../lib/paths.js";

const TOOL_LABELS = { gemini: "Gemini CLI", cursor: "Cursor", copilot: "GitHub Copilot" };

export async function update({ project = false, target = "claude" } = {}) {
  if (target === "claude") {
    return updateClaude({ project });
  }
  return updateIntegration(target);
}

async function updateClaude({ project }) {
  const targetDir = installTargetDir({ project });
  const previousVersion = readVersion(installMetaPath(targetDir));

  const { fileCount, version } = copySkill({ project });

  if (!previousVersion) {
    console.log(`No existing install found at ${targetDir} — installed 16-eyes ${version} fresh (${fileCount} files).`);
  } else if (previousVersion === version) {
    console.log(`16-eyes ${version} was already up to date at ${targetDir} (re-copied ${fileCount} files anyway).`);
  } else {
    console.log(`Updated 16-eyes ${previousVersion} → ${version} at ${targetDir} (${fileCount} files).`);
  }
}

async function updateIntegration(target) {
  const label = TOOL_LABELS[target] || target;
  const previousVersion = readVersion(integrationMetaPath(target));

  const { fileCount, version, dirs } = copyIntegration(target);

  if (!previousVersion) {
    console.log(`No existing ${label} install found — installed 16-eyes ${version} fresh (${fileCount} files across ${dirs.length} director${dirs.length === 1 ? "y" : "ies"}).`);
  } else if (previousVersion === version) {
    console.log(`16-eyes ${version} for ${label} was already up to date (re-copied ${fileCount} files anyway).`);
  } else {
    console.log(`Updated 16-eyes ${previousVersion} → ${version} for ${label} (${fileCount} files).`);
  }
}

function readVersion(metaPath) {
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8")).version ?? null;
  } catch {
    return null;
  }
}
