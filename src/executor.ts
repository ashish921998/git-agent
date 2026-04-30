import { execa } from "execa";
import type { AgentCommand, LogEntry, CommandRisk } from "./types.js";

export async function executeCommand(
  cwd: string,
  command: AgentCommand,
  risk: CommandRisk,
  verbose: boolean,
): Promise<LogEntry> {
  const started = Date.now();
  try {
    const result = await execa(command.command, command.args, {
      cwd,
      shell: false,
      reject: false,
      timeout: 60_000,
    });

    return {
      ts: new Date().toISOString(),
      cwd,
      command: [command.command, ...command.args],
      reason: command.reason,
      status: result.exitCode === 0 ? "ok" : "error",
      risk,
      exitCode: result.exitCode ?? null,
      durationMs: Date.now() - started,
      stdoutSummary: summarize(result.stdout, verbose),
      stderrSummary: summarize(result.stderr, verbose),
    };
  } catch (error) {
    return {
      ts: new Date().toISOString(),
      cwd,
      command: [command.command, ...command.args],
      reason: command.reason,
      status: "error",
      risk,
      exitCode: null,
      durationMs: Date.now() - started,
      stdoutSummary: "",
      stderrSummary: error instanceof Error ? error.message : String(error),
    };
  }
}

export function summarize(value: string, verbose: boolean): string {
  const cleaned = value.trim();
  if (verbose || cleaned.length <= 2_000) {
    return cleaned;
  }
  return `${cleaned.slice(0, 2_000)}...`;
}
