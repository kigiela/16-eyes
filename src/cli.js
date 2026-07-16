import { install } from "./commands/install.js";
import { update } from "./commands/update.js";
import { uninstall } from "./commands/uninstall.js";
import { status } from "./commands/status.js";
import { VALID_TARGETS } from "./lib/paths.js";

const HELP = `16-eyes — security-audit skill/commands for Claude Code, Gemini CLI, Cursor, and GitHub Copilot

Usage:
  npx 16-eyes install [--project] [--target <target>]    Install (global by default; --target selects the tool)
  npx 16-eyes update [--project] [--target <target>]     Re-copy the latest version
  npx 16-eyes uninstall [--project] [--target <target>]  Remove what was installed
  npx 16-eyes status                                      Show what's installed, and where, across every tool

Flags:
  --project           Install/update/uninstall to this repo's .claude/skills/16-eyes
                       instead of the global ~/.claude/skills/user/16-eyes. Only
                       affects the "claude" target (the default) — every other
                       target (gemini/cursor/copilot) is always project-relative,
                       since none of those tools have a global-skills convention.
  --target <target>   claude (default) | gemini | cursor | copilot | all
                         claude:  Claude Code skill              → .claude/skills/16-eyes
                         gemini:  Gemini CLI commands + subagents → .gemini/
                         cursor:  Cursor skills + subagents       → .cursor/
                         copilot: Copilot custom agents + prompts → .github/
                         all:     every target above

After installing, open the corresponding tool in any repository. Invocation syntax
differs per tool:
  Claude Code:  /16-eyes init | /16-eyes audit | /16-eyes audit-diff | /16-eyes fix
  Gemini CLI:   /16-eyes:init | /16-eyes:audit | /16-eyes:audit-diff | /16-eyes:fix
  Cursor:       16-eyes-init  | 16-eyes-audit  | 16-eyes-audit-diff  | 16-eyes-fix
  Copilot:      @16-eyes-init | @16-eyes-audit | @16-eyes-audit-diff | @16-eyes-fix

Every target shares the same \`.16-eyes/\` config, lenses, and reports — run \`init\`
once with any one tool and every other installed tool reuses it.

Docs: https://github.com/kigiela/16-eyes
`;

function parseTargets(rest) {
  const idx = rest.indexOf("--target");
  const value = idx !== -1 ? rest[idx + 1] : "claude";
  if (value === "all") return VALID_TARGETS;
  if (!VALID_TARGETS.includes(value)) {
    throw new Error(`Invalid --target "${value}" — expected one of: ${VALID_TARGETS.join(", ")}, all`);
  }
  return [value];
}

export async function run(argv) {
  const [cmd, ...rest] = argv;
  const project = rest.includes("--project");

  switch (cmd) {
    case "install":
      for (const target of parseTargets(rest)) await install({ project, target });
      return;
    case "update":
      for (const target of parseTargets(rest)) await update({ project, target });
      return;
    case "uninstall":
      for (const target of parseTargets(rest)) await uninstall({ project, target });
      return;
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
