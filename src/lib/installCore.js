import fs from "node:fs";
import path from "node:path";
import { SKILL_NAME, SKILL_SOURCE_DIR, installTargetDir, installMetaPath } from "./paths.js";
import { copyDirRecursive, listFilesRecursive } from "./copy.js";

function packageVersion() {
  const pkgPath = path.join(SKILL_SOURCE_DIR, "..", "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

/**
 * Copies skill/16-eyes/** into the target dir and writes .install-meta.json.
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
