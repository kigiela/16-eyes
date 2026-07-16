import path from "node:path";
import { copySkill, copyIntegration, appendAgentsMdSnippet } from "../lib/installCore.js";

const TOOL_LABELS = { gemini: "Gemini CLI", cursor: "Cursor", copilot: "GitHub Copilot" };

export async function install({ project = false, target = "claude" } = {}) {
  if (target === "claude") {
    return installClaude({ project });
  }
  return installIntegration(target);
}

async function installClaude({ project }) {
  const { targetDir, fileCount, version, alreadyInstalled } = copySkill({ project });

  if (alreadyInstalled) {
    console.log(`16-eyes ${version} refreshed at ${targetDir} (${fileCount} files).`);
  } else {
    console.log(`16-eyes ${version} installed at ${targetDir} (${fileCount} files).`);
  }
  console.log("");
  console.log("Next: open Claude Code in a repository and run:");
  console.log("  /16-eyes init         configure (gates, exclude patterns, output location, lenses)");
  console.log("  /16-eyes audit        run every persisted lens across the whole repo");
  console.log("  /16-eyes audit-diff   the same engine, scoped to a diff/PR");
  console.log("  /16-eyes fix          apply the audit's findings");
  console.log("");
  console.log(
    `A brand-new Claude Code session may be needed to discover the skill (skills are read at session start).`,
  );
  if (!project) {
    console.log("");
    console.log(`(Installed globally. Use --project to install into this repo's .claude/skills/ instead.)`);
  }
}

async function installIntegration(target) {
  const label = TOOL_LABELS[target] || target;
  const { dirs, fileCount, version, alreadyInstalled } = copyIntegration(target);

  console.log(
    `16-eyes ${version} ${alreadyInstalled ? "refreshed" : "installed"} for ${label} (${fileCount} files across ${dirs.length} director${dirs.length === 1 ? "y" : "ies"}: ${dirs.map((d) => "." + path.sep + path.relative(process.cwd(), d)).join(", ")}).`,
  );

  const { created, updated } = appendAgentsMdSnippet();
  if (created) console.log("Created AGENTS.md with a 16-eyes summary (read automatically by several AI coding tools).");
  else if (updated) console.log("Updated the 16-eyes section of AGENTS.md.");

  console.log("");
  console.log(
    `This integration is best-effort: ${label} has no equivalent to Claude Code's schema-validated multi-agent Workflow pipeline, so the fan-out/verify/adversarial-review steps rely on prompted JSON + instructions rather than an enforced schema. See the README's "Other tools" section for what that means in practice.`,
  );
}

// process.cwd()-relative display path, without pulling in a path-formatting dependency.
function require_relative(absPath) {
  const cwd = process.cwd();
  return absPath.startsWith(cwd) ? `.${absPath.slice(cwd.length)}` : absPath;
}
