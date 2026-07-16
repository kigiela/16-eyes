import fs from "node:fs";
import { copySkill } from "../lib/installCore.js";
import { installTargetDir, installMetaPath } from "../lib/paths.js";

export async function update({ project = false } = {}) {
  const targetDir = installTargetDir({ project });
  const previousVersion = readPreviousVersion(targetDir);

  const { fileCount, version } = copySkill({ project });

  if (!previousVersion) {
    console.log(`No existing install found at ${targetDir} — installed 16-eyes ${version} fresh (${fileCount} files).`);
  } else if (previousVersion === version) {
    console.log(`16-eyes ${version} was already up to date at ${targetDir} (re-copied ${fileCount} files anyway).`);
  } else {
    console.log(`Updated 16-eyes ${previousVersion} → ${version} at ${targetDir} (${fileCount} files).`);
  }
}

function readPreviousVersion(targetDir) {
  try {
    const meta = JSON.parse(fs.readFileSync(installMetaPath(targetDir), "utf8"));
    return meta.version ?? null;
  } catch {
    return null;
  }
}
