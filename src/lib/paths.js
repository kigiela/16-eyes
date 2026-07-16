import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_NAME = "16-eyes";

// Resolves to the package root (the directory containing package.json),
// regardless of whether this is running from a local checkout or a
// downloaded npm tarball.
const THIS_FILE = fileURLToPath(import.meta.url);
export const PACKAGE_ROOT = path.resolve(path.dirname(THIS_FILE), "..", "..");

export const SKILL_SOURCE_DIR = path.join(PACKAGE_ROOT, "skill", SKILL_NAME);

export function installTargetDir({ project = false } = {}) {
  return project
    ? path.join(process.cwd(), ".claude", "skills", SKILL_NAME)
    : path.join(os.homedir(), ".claude", "skills", "user", SKILL_NAME);
}

export function installMetaPath(targetDir) {
  return path.join(targetDir, ".install-meta.json");
}
