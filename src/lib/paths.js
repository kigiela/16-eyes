import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_NAME = "16-eyes";

// Resolves to the package root (the directory containing package.json),
// regardless of whether this is running from a local checkout or a
// downloaded npm tarball.
const THIS_FILE = fileURLToPath(import.meta.url);
export const PACKAGE_ROOT = path.resolve(path.dirname(THIS_FILE), "..", "..");

export const SKILL_SOURCE_DIR = path.join(PACKAGE_ROOT, "skills", SKILL_NAME);

export function installTargetDir({ project = false } = {}) {
  return project
    ? path.join(process.cwd(), ".claude", "skills", SKILL_NAME)
    : path.join(os.homedir(), ".claude", "skills", "user", SKILL_NAME);
}

export function installMetaPath(targetDir) {
  return path.join(targetDir, ".install-meta.json");
}

// ── Multi-tool integrations (Gemini CLI, Cursor, GitHub Copilot) ───────────
// These are thin, best-effort adapters (see integrations/README or the main
// README's "Other tools" section) — always project-relative, no equivalent
// to a global/user-level install since none of these tools share Claude
// Code's global-skills convention.

export const INTEGRATIONS_SOURCE_DIR = path.join(PACKAGE_ROOT, "integrations");
export const AGENTS_MD_SNIPPET_PATH = path.join(INTEGRATIONS_SOURCE_DIR, "agents-md-snippet.md");

export const TOOL_INTEGRATIONS = {
  gemini: [
    { src: "gemini/commands", dest: path.join(".gemini", "commands") },
    { src: "gemini/agents", dest: path.join(".gemini", "agents") },
  ],
  cursor: [
    { src: "cursor/skills", dest: path.join(".cursor", "skills") },
    { src: "cursor/agents", dest: path.join(".cursor", "agents") },
  ],
  copilot: [
    { src: "copilot/agents", dest: path.join(".github", "agents") },
    { src: "copilot/prompts", dest: path.join(".github", "prompts") },
  ],
};

export const VALID_TARGETS = ["claude", "gemini", "cursor", "copilot"];

export function integrationMetaPath(tool, { cwd = process.cwd() } = {}) {
  const mappings = TOOL_INTEGRATIONS[tool];
  if (!mappings) return null;
  return path.join(cwd, mappings[0].dest, ".install-meta.json");
}
