import { install } from "./commands/install.js";
import { update } from "./commands/update.js";
import { uninstall } from "./commands/uninstall.js";
import { status } from "./commands/status.js";

const HELP = `16-eyes — install the full-repo security audit skill for Claude Code

Usage:
  npx 16-eyes install [--project]    Install the skill (global by default)
  npx 16-eyes update [--project]     Re-copy the skill files to the installed location
  npx 16-eyes uninstall [--project]  Remove the installed skill (never touches
                                      a target repo's .16-eyes/ config or reports)
  npx 16-eyes status                 Show where the skill is installed, if at all

Flags:
  --project    Install/update/uninstall to this repo's .claude/skills/16-eyes
               instead of the global ~/.claude/skills/user/16-eyes

After installing, open Claude Code in any repository and run:
  /16-eyes init     configure (detect gates, exclude patterns, output location)
  /16-eyes audit    profile the repo, design custom lenses, run the audit
  /16-eyes fix      apply the audit's findings (safe ones directly, risky ones
                    with your confirmation — never commits or pushes)

Docs: https://github.com/kigiela/16-eyes
`;

export async function run(argv) {
  const [cmd, ...rest] = argv;
  const project = rest.includes("--project");

  switch (cmd) {
    case "install":
      return install({ project });
    case "update":
      return update({ project });
    case "uninstall":
      return uninstall({ project });
    case "status":
      return status();
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}
