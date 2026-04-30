import type { AgentCommand, CommandAssessment } from "./types.js";
import { resolve } from "node:path";

const READONLY_SHELL = new Set(["pwd", "ls", "find", "cat", "head", "sed"]);
const GIT_READONLY = new Set([
  "status",
  "diff",
  "log",
  "branch",
  "remote",
  "show",
  "grep",
  "rev-parse",
]);

const GIT_MUTATING = new Set([
  "init",
  "add",
  "commit",
  "checkout",
  "switch",
  "fetch",
  "pull",
  "push",
  "merge",
  "restore",
  "tag",
]);

const GIT_GUARDED = new Set(["reset", "clean", "rebase", "filter-branch", "update-ref"]);
const DISALLOWED_SHELL = new Set([
  "rm",
  "mv",
  "cp",
  "mkdir",
  "touch",
  "sudo",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "curl",
  "wget",
  "chmod",
  "chown",
]);

export function assessCommand(command: AgentCommand, targetFolder = process.cwd()): CommandAssessment {
  const executable = command.command.trim();
  const args = command.args ?? [];

  if (!executable) {
    return { risk: "refused", allowed: false, reason: "Empty command." };
  }

  if (containsShellSyntax(executable) || args.some(containsShellSyntax)) {
    return {
      risk: "refused",
      allowed: false,
      reason: "Shell syntax such as pipes, redirects, and command chaining is not allowed.",
    };
  }

  if (executable === "git") {
    return assessGit(args);
  }

  if (READONLY_SHELL.has(executable)) {
    return assessReadonlyShell(executable, args, targetFolder);
  }

  if (DISALLOWED_SHELL.has(executable)) {
    return {
      risk: "refused",
      allowed: false,
      reason: `${executable} is not allowed in v1.`,
    };
  }

  return {
    risk: "refused",
    allowed: false,
    reason: "Only git plus safe read-only inspection commands are allowed.",
  };
}

function assessGit(args: string[]): CommandAssessment {
  const subcommand = args.find((arg) => !arg.startsWith("-"));
  if (!subcommand) {
    return { risk: "readonly", allowed: true };
  }

  if (isForcePush(args)) {
    return {
      risk: "guarded",
      allowed: true,
      confirmationPhrase: "force push",
      reason: "Force push can overwrite remote history.",
    };
  }

  if (subcommand === "reset" && args.includes("--hard")) {
    return {
      risk: "guarded",
      allowed: true,
      confirmationPhrase: "reset hard",
      reason: "Hard reset can discard local work.",
    };
  }

  if (subcommand === "clean") {
    return {
      risk: "guarded",
      allowed: true,
      confirmationPhrase: "git clean",
      reason: "Git clean can permanently delete untracked files.",
    };
  }

  if (subcommand === "restore" && !args.includes("--staged")) {
    return {
      risk: "guarded",
      allowed: true,
      confirmationPhrase: "restore files",
      reason: "Restore can discard file changes.",
    };
  }

  if (subcommand === "restore") {
    return { risk: "mutating", allowed: true };
  }

  if (subcommand === "checkout" && isDiscardingCheckout(args)) {
    return {
      risk: "guarded",
      allowed: true,
      confirmationPhrase: "discard changes",
      reason: "Checkout can discard local file changes.",
    };
  }

  if (GIT_GUARDED.has(subcommand)) {
    return {
      risk: "guarded",
      allowed: true,
      confirmationPhrase: `git ${subcommand}`,
      reason: `git ${subcommand} is guarded because it can rewrite or discard work.`,
    };
  }

  if (subcommand === "branch") {
    if (args.some((arg) => arg === "-d" || arg === "-D" || arg === "--delete")) {
      return {
        risk: "guarded",
        allowed: true,
        confirmationPhrase: "delete branch",
        reason: "Deleting branches is guarded in v1.",
      };
    }
    return args.length === 1 || args.every((arg) => arg === "branch" || arg.startsWith("-"))
      ? { risk: "readonly", allowed: true }
      : { risk: "mutating", allowed: true };
  }

  if (subcommand === "remote") {
    const remoteAction = args[1];
    if (!remoteAction || remoteAction === "-v" || remoteAction === "show") {
      return { risk: "readonly", allowed: true };
    }
    return { risk: "mutating", allowed: true };
  }

  if (GIT_READONLY.has(subcommand)) {
    return { risk: "readonly", allowed: true };
  }

  if (GIT_MUTATING.has(subcommand)) {
    return { risk: "mutating", allowed: true };
  }

  return {
    risk: "refused",
    allowed: false,
    reason: `git ${subcommand} is not in the v1 allowlist.`,
  };
}

function assessReadonlyShell(command: string, args: string[], targetFolder: string): CommandAssessment {
  if (command === "sed" && args.some((arg) => arg === "-i" || arg.startsWith("-i"))) {
    return {
      risk: "refused",
      allowed: false,
      reason: "sed in-place editing is not allowed in v1.",
    };
  }

  if (args.some((arg) => looksLikeEscapingPath(arg, targetFolder))) {
    return {
      risk: "refused",
      allowed: false,
      reason: "Inspection command paths must stay inside the target folder.",
    };
  }

  if (command === "find" && !args.includes("-maxdepth")) {
    return {
      risk: "refused",
      allowed: false,
      reason: "find must include -maxdepth in v1.",
    };
  }

  return { risk: "readonly", allowed: true };
}

function looksLikeEscapingPath(arg: string, targetFolder: string): boolean {
  if (arg.startsWith("-")) {
    return false;
  }

  if (arg === "." || arg === "./") {
    return false;
  }

  if (!arg.startsWith("/") && !arg.includes("..")) {
    return false;
  }

  const base = resolve(targetFolder);
  const resolved = resolve(base, arg);
  return resolved !== base && !resolved.startsWith(`${base}/`);
}

function containsShellSyntax(value: string): boolean {
  return /[|;&<>`$]/.test(value);
}

function isForcePush(args: string[]): boolean {
  return args[0] === "push" && args.some((arg) => arg === "--force" || arg === "-f" || arg.startsWith("--force-with-lease"));
}

function isDiscardingCheckout(args: string[]): boolean {
  return args.some((arg) => arg === "--" || arg === "-f" || arg === "--force");
}
