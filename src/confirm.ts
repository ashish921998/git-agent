import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { AgentCommand, CommandAssessment, CliOptions } from "./types.js";

type Ask = (question: string) => Promise<string>;

export async function shouldRunPlan(
  commands: AgentCommand[],
  assessments: CommandAssessment[],
  options: CliOptions,
  ask?: Ask,
): Promise<boolean> {
  if (options.dryRun) {
    return false;
  }

  const hasGuarded = assessments.some((item) => item.risk === "guarded");
  const hasMutation = assessments.some((item) => item.risk === "mutating");

  if (!hasGuarded && !hasMutation) {
    return true;
  }

  if (!hasGuarded && options.yes) {
    return true;
  }

  const rl = ask ? null : createInterface({ input, output });
  const question: Ask = ask ?? ((prompt) => rl!.question(prompt));
  try {
    if (hasGuarded) {
      for (const [index, assessment] of assessments.entries()) {
        if (assessment.risk !== "guarded") {
          continue;
        }
        const phrase = assessment.confirmationPhrase ?? "confirm guarded operation";
        const command = commands[index];
        const renderedCommand = command ? [command.command, ...command.args].join(" ") : "guarded command";
        const answer = await question(`Guarded operation detected (${renderedCommand}). Type "${phrase}" to continue: `);
        if (answer.trim() !== phrase) {
          return false;
        }
      }
      return true;
    }

    const answer = await question("Run these mutating Git commands? [y/N] ");
    return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
  } finally {
    rl?.close();
  }
}
