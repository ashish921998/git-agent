import { describe, expect, it } from "vitest";
import { shouldRunPlan } from "../src/confirm.js";
import type { AgentCommand, CliOptions, CommandAssessment } from "../src/types.js";

const options: CliOptions = {
  folder: "/tmp/repo",
  yes: false,
  dryRun: false,
  json: false,
  verbose: false,
};

const commands: AgentCommand[] = [
  { command: "git", args: ["reset", "--hard"], reason: "reset" },
  { command: "git", args: ["push", "--force"], reason: "force push" },
];

const guardedAssessments: CommandAssessment[] = [
  { risk: "guarded", allowed: true, confirmationPhrase: "reset hard" },
  { risk: "guarded", allowed: true, confirmationPhrase: "force push" },
];

describe("shouldRunPlan", () => {
  it("runs read-only plans without prompting", async () => {
    await expect(
      shouldRunPlan(
        [{ command: "git", args: ["status"], reason: "status" }],
        [{ risk: "readonly", allowed: true }],
        options,
        async () => {
          throw new Error("should not prompt");
        },
      ),
    ).resolves.toBe(true);
  });

  it("lets --yes approve non-guarded mutations", async () => {
    await expect(
      shouldRunPlan(
        [{ command: "git", args: ["commit", "-m", "test"], reason: "commit" }],
        [{ risk: "mutating", allowed: true }],
        { ...options, yes: true },
        async () => {
          throw new Error("should not prompt");
        },
      ),
    ).resolves.toBe(true);
  });

  it("requires each guarded command phrase even when --yes is set", async () => {
    const answers = ["reset hard", "force push"];
    await expect(
      shouldRunPlan(commands, guardedAssessments, { ...options, yes: true }, async () => answers.shift() ?? ""),
    ).resolves.toBe(true);
  });

  it("rejects when any guarded command phrase is missing", async () => {
    const answers = ["reset hard", "nope"];
    await expect(
      shouldRunPlan(commands, guardedAssessments, { ...options, yes: true }, async () => answers.shift() ?? ""),
    ).resolves.toBe(false);
  });

  it("does not run dry-run plans", async () => {
    await expect(shouldRunPlan(commands, guardedAssessments, { ...options, dryRun: true })).resolves.toBe(false);
  });
});
