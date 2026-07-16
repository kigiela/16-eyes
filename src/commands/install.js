import { copySkill } from "../lib/installCore.js";

export async function install({ project = false } = {}) {
  const { targetDir, fileCount, version, alreadyInstalled } = copySkill({ project });

  if (alreadyInstalled) {
    console.log(`16-eyes ${version} refreshed at ${targetDir} (${fileCount} files).`);
  } else {
    console.log(`16-eyes ${version} installed at ${targetDir} (${fileCount} files).`);
  }
  console.log("");
  console.log("Next: open Claude Code in a repository and run:");
  console.log("  /16-eyes init     configure (gates, exclude patterns, output location)");
  console.log("  /16-eyes audit    profile the repo, design custom lenses, run the audit");
  console.log("  /16-eyes fix      apply the audit's findings");
  console.log("");
  console.log(
    `A brand-new Claude Code session may be needed to discover the skill (skills are read at session start).`,
  );
  if (!project) {
    console.log("");
    console.log(`(Installed globally. Use --project to install into this repo's .claude/skills/ instead.)`);
  }
}
