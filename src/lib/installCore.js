import fs from "node:fs";
import path from "node:path";
import {
  SKILL_NAME,
  SKILL_SOURCE_DIR,
  installTargetDir,
  installMetaPath,
  INTEGRATIONS_SOURCE_DIR,
  AGENTS_MD_SNIPPET_PATH,
  TOOL_INTEGRATIONS,
  integrationMetaPath,
} from "./paths.js";
import { copyDirRecursive, listFilesRecursive, removeDirRecursive } from "./copy.js";

function packageVersion() {
  const pkgPath = path.join(SKILL_SOURCE_DIR, "..", "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

/**
 * Copies skills/16-eyes/** into the target dir and writes .install-meta.json.
 * Always overwrites (v1 has no diff/hash-aware update — see plan's "later" section).
 * Returns { targetDir, fileCount, version, alreadyInstalled }.
 */
export function copySkill({ project = false } = {}) {
  const targetDir = installTargetDir({ project });
  const alreadyInstalled = fs.existsSync(installMetaPath(targetDir));
  const version = packageVersion();

  copyDirRecursive(SKILL_SOURCE_DIR, targetDir);

  const fileCount = listFilesRecursive(SKILL_SOURCE_DIR).length;
  fs.writeFileSync(
    installMetaPath(targetDir),
    JSON.stringify(
      {
        package: "16-eyes",
        version,
        skillName: SKILL_NAME,
        installedAt: new Date().toISOString(),
        project,
      },
      null,
      2,
    ) + "\n",
  );

  return { targetDir, fileCount, version, alreadyInstalled };
}

/**
 * Copies integrations/<tool>/** into this repo's tool-specific directories
 * (always project-relative — none of these tools have a global-install
 * convention the way Claude Code's skills do) and writes a
 * `.install-meta.json` marker inside the first mapped directory.
 * Returns { tool, dirs, fileCount, version, alreadyInstalled }.
 */
export function copyIntegration(tool) {
  const mappings = TOOL_INTEGRATIONS[tool];
  if (!mappings) {
    throw new Error(`Unknown integration target "${tool}" — expected one of: ${Object.keys(TOOL_INTEGRATIONS).join(", ")}`);
  }

  const version = packageVersion();
  const metaPath = integrationMetaPath(tool);
  const alreadyInstalled = fs.existsSync(metaPath);

  const dirs = [];
  let fileCount = 0;
  for (const { src, dest } of mappings) {
    const srcDir = path.join(INTEGRATIONS_SOURCE_DIR, src);
    const destDir = path.join(process.cwd(), dest);
    copyDirRecursive(srcDir, destDir);
    fileCount += listFilesRecursive(srcDir).length;
    dirs.push(destDir);
  }

  fs.writeFileSync(
    metaPath,
    JSON.stringify({ package: "16-eyes", version, tool, installedAt: new Date().toISOString() }, null, 2) + "\n",
  );

  return { tool, dirs, fileCount, version, alreadyInstalled };
}

/**
 * Removes every directory `copyIntegration(tool)` wrote, then prunes each
 * one's parent directory if that parent is now empty (e.g. an empty
 * `.gemini/` left behind after removing `.gemini/commands` and
 * `.gemini/agents`). No-op for an unknown tool.
 */
export function removeIntegration(tool) {
  const mappings = TOOL_INTEGRATIONS[tool];
  if (!mappings) return;
  for (const { dest } of mappings) {
    const destDir = path.join(process.cwd(), dest);
    removeDirRecursive(destDir);

    const parent = path.dirname(destDir);
    if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
      fs.rmdirSync(parent);
    }
  }
}

/**
 * Appends (or refreshes) a marked `16-eyes` section in this repo's root
 * `AGENTS.md`, creating the file if it doesn't exist yet. Never touches any
 * other content in an existing file — the section is bounded by HTML
 * comment markers so a re-run replaces just that block.
 * Returns { created, updated }.
 */
export function appendAgentsMdSnippet({ cwd = process.cwd() } = {}) {
  const snippet = fs.readFileSync(AGENTS_MD_SNIPPET_PATH, "utf8").trim();
  const target = path.join(cwd, "AGENTS.md");

  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, snippet + "\n");
    return { created: true, updated: false };
  }

  const existing = fs.readFileSync(target, "utf8");
  const hasBlock = existing.includes("<!-- 16-eyes:start -->") && existing.includes("<!-- 16-eyes:end -->");

  const next = hasBlock
    ? existing.replace(/<!-- 16-eyes:start -->[\s\S]*?<!-- 16-eyes:end -->/, snippet)
    : existing.trimEnd() + "\n\n" + snippet + "\n";

  fs.writeFileSync(target, next);
  return { created: false, updated: true };
}
