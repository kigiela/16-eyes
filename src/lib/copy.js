import fs from "node:fs";
import path from "node:path";

/** Recursively lists every file (not directory) under `dir`, as paths relative to `dir`. */
export function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(abs).map((f) => path.join(entry.name, f)));
    } else if (entry.isFile()) {
      out.push(entry.name);
    }
  }
  return out;
}

/** Recursively copies every file from `srcDir` to `destDir`, creating directories as needed. */
export function copyDirRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const rel of listFilesRecursive(srcDir)) {
    const srcFile = path.join(srcDir, rel);
    const destFile = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
  }
}

/** Removes `dir` and everything in it, if it exists. No-op if it doesn't. */
export function removeDirRecursive(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
