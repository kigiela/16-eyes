import fs from "node:fs";
import { installTargetDir, installMetaPath, integrationMetaPath, TOOL_INTEGRATIONS } from "../lib/paths.js";

const TOOL_LABELS = { gemini: "Gemini CLI", cursor: "Cursor", copilot: "GitHub Copilot" };

function readMeta(metaPath) {
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

export async function status() {
  const globalDir = installTargetDir({ project: false });
  const projectDir = installTargetDir({ project: true });

  const globalMeta = readMeta(installMetaPath(globalDir));
  const projectMeta = readMeta(installMetaPath(projectDir));

  console.log("16-eyes install status:");
  console.log("");
  console.log(`  Claude Code — global   (${globalDir}):`);
  console.log(globalMeta ? `    installed, version ${globalMeta.version}` : "    not installed");
  console.log("");
  console.log(`  Claude Code — project  (${projectDir}, relative to cwd):`);
  console.log(projectMeta ? `    installed, version ${projectMeta.version}` : "    not installed");

  let anyInstalled = Boolean(globalMeta || projectMeta);

  for (const tool of Object.keys(TOOL_INTEGRATIONS)) {
    const label = TOOL_LABELS[tool] || tool;
    const meta = readMeta(integrationMetaPath(tool));
    console.log("");
    console.log(`  ${label} (relative to cwd):`);
    console.log(meta ? `    installed, version ${meta.version}` : "    not installed");
    anyInstalled = anyInstalled || Boolean(meta);
  }

  if (!anyInstalled) {
    console.log("");
    console.log("Run `npx 16-eyes install` to get started (add --target gemini|cursor|copilot for other tools).");
  }
}
