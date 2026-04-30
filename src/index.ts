#!/usr/bin/env node
import { Command } from "commander";
import ora from "ora";
import { createAgentPlan } from "./agent.js";
import { shouldRunPlan } from "./confirm.js";
import { executeCommand } from "./executor.js";
import { assessCommand } from "./guards.js";
import { inspectRepo, validateFolder } from "./inspect.js";
import { plannedLog, printLog, printPlan, refusedLog, skippedLog } from "./logger.js";
import type { CliOptions } from "./types.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("git-agent")
    .description("Natural-language Git operations powered by Claude Agent SDK")
    .option("--folder <path>", "target folder", process.cwd())
    .option("--yes", "approve normal mutating Git commands", false)
    .option("--dry-run", "show plan without running commands", false)
    .option("--json", "print operation logs as JSON lines", false)
    .option("--verbose", "show full command output", false)
    .argument("<request...>", "natural-language Git request")
    .parse(process.argv);

  const rawOptions = program.opts<{
    folder: string;
    yes: boolean;
    dryRun: boolean;
    json: boolean;
    verbose: boolean;
  }>();
  const request = program.args.join(" ").trim();

  if (!request) {
    throw new Error("Please provide a natural-language Git request.");
  }

  const folder = await validateFolder(rawOptions.folder);
  const options: CliOptions = { ...rawOptions, folder };
  const repoState = await inspectRepo(folder);
  const planningSpinner = options.json ? null : ora("Asking Claude to plan the Git operations...").start();
  let plan;
  try {
    plan = await createAgentPlan(request, repoState);
    planningSpinner?.succeed("Claude returned a command plan.");
  } catch (error) {
    planningSpinner?.fail("Claude could not create a command plan.");
    throw error;
  }
  const assessments = plan.commands.map((command) => assessCommand(command, folder));

  printPlan(plan, assessments, options.json);

  const refused = assessments
    .map((assessment, index) => ({ assessment, command: plan.commands[index] }))
    .filter((item) => !item.assessment.allowed);

  for (const item of refused) {
    printLog(
      refusedLog(
        folder,
        [item.command.command, ...item.command.args],
        item.command.reason,
        item.assessment.risk,
        item.assessment.reason ?? "Command refused.",
      ),
      options.json,
    );
  }

  if (refused.length > 0) {
    process.exitCode = 3;
    return;
  }

  const shouldRun = await shouldRunPlan(plan.commands, assessments, options);
  if (!shouldRun) {
    for (const [index, command] of plan.commands.entries()) {
      const logFactory = options.dryRun ? plannedLog : skippedLog;
      printLog(
        logFactory(
          folder,
          [command.command, ...command.args],
          command.reason,
          assessments[index]?.risk ?? "refused",
          options.dryRun ? "Dry run: command was not executed." : "User did not approve execution.",
        ),
        options.json,
      );
    }
    process.exitCode = options.dryRun ? 0 : 1;
    return;
  }

  for (const [index, command] of plan.commands.entries()) {
    const assessment = assessments[index];
    const execSpinner = options.json ? null : ora(`Running ${[command.command, ...command.args].join(" ")}...`).start();
    const entry = await executeCommand(folder, command, assessment?.risk ?? "refused", options.verbose);
    if (entry.status === "ok") {
      execSpinner?.succeed(`Finished ${[command.command, ...command.args].join(" ")}.`);
    } else {
      execSpinner?.fail(`Failed ${[command.command, ...command.args].join(" ")}.`);
    }
    printLog(entry, options.json);
    if (entry.status === "error") {
      for (let skippedIndex = index + 1; skippedIndex < plan.commands.length; skippedIndex += 1) {
        const skippedCommand = plan.commands[skippedIndex];
        printLog(
          skippedLog(
            folder,
            [skippedCommand.command, ...skippedCommand.args],
            skippedCommand.reason,
            assessments[skippedIndex]?.risk ?? "refused",
            "Skipped due to prior command failure.",
          ),
          options.json,
        );
      }
      process.exitCode = 3;
      return;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
