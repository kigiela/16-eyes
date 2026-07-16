import fs from "node:fs";
import { installTargetDir, installMetaPath } from "../lib/paths.js";

function readMeta(targetDir) {
  try {
    return JSON.parse(fs.readFileSync(installMetaPath(targetDir), "utf8"));
  } catch {
    return null;
  }
}

export async function status() {
  const globalDir = installTargetDir({ project: false });
  const projectDir = installTargetDir({ project: true });

  const globalMeta = readMeta(globalDir);
  const projectMeta = readMeta(projectDir);

  console.log("16-eyes install status:");
  console.log("");
  console.log(`  Global   (${globalDir}):`);
  console.log(globalMeta ? `    installed, version ${globalMeta.version}` : "    not installed");
  console.log("");
  console.log(`  Project  (${projectDir}, relative to cwd):`);
  console.log(projectMeta ? `    installed, version ${projectMeta.version}` : "    not installed");

  if (!globalMeta && !projectMeta) {
    console.log("");
    console.log("Run `npx 16-eyes install` to get started.");
  }
}
