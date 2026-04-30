import chalk from "chalk";
import type { AgentPlan, CommandAssessment, LogEntry } from "./types.js";

export function printPlan(plan: AgentPlan, assessments: CommandAssessment[], json: boolean): void {
  if (json) {
    return;
  }

  console.log(chalk.bold("Plan"));
  console.log(plan.summary);
  for (const [index, command] of plan.commands.entries()) {
    const assessment = assessments[index];
    const risk = assessment?.risk ?? "refused";
    console.log(`  ${index + 1}. ${chalk.cyan(formatCommand(command.command, command.args))} ${chalk.gray(`(${risk})`)}`);
    console.log(`     ${command.reason}`);
    if (assessment && !assessment.allowed) {
      console.log(`     ${chalk.red(`Refused: ${assessment.reason}`)}`);
    }
  }
}

export function printLog(entry: LogEntry, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(entry));
    return;
  }

  const icon = entry.status === "ok" ? chalk.green("✓") : entry.status === "refused" ? chalk.red("✗") : chalk.yellow("•");
  console.log(`${icon} ${formatCommand(entry.command[0] ?? "", entry.command.slice(1))} ${chalk.gray(`(${entry.durationMs}ms)`)}`);

  if (entry.message) {
    console.log(chalk.gray(entry.message));
  }
  if (entry.stdoutSummary) {
    console.log(entry.stdoutSummary);
  }
  if (entry.stderrSummary) {
    console.error(chalk.red(entry.stderrSummary));
  }
}

export function plannedLog(cwd: string, command: string[], reason: string, risk: LogEntry["risk"], message: string): LogEntry {
  return {
    ts: new Date().toISOString(),
    cwd,
    command,
    reason,
    status: "planned",
    risk,
    exitCode: null,
    durationMs: 0,
    stdoutSummary: "",
    stderrSummary: "",
    message,
  };
}

export function skippedLog(cwd: string, command: string[], reason: string, risk: LogEntry["risk"], message: string): LogEntry {
  return {
    ts: new Date().toISOString(),
    cwd,
    command,
    reason,
    status: "skipped",
    risk,
    exitCode: null,
    durationMs: 0,
    stdoutSummary: "",
    stderrSummary: "",
    message,
  };
}

export function refusedLog(cwd: string, command: string[], reason: string, risk: LogEntry["risk"], message: string): LogEntry {
  return {
    ts: new Date().toISOString(),
    cwd,
    command,
    reason,
    status: "refused",
    risk,
    exitCode: null,
    durationMs: 0,
    stdoutSummary: "",
    stderrSummary: "",
    message,
  };
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(" ");
}
