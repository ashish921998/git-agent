import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeCommand } from "../src/executor.js";

const created: string[] = [];

async function tempFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "git-agent-exec-"));
  created.push(folder);
  return folder;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("executeCommand", () => {
  it("logs successful commands", async () => {
    const folder = await tempFolder();
    const entry = await executeCommand(folder, { command: "pwd", args: [], reason: "show cwd" }, "readonly", false);
    expect(entry.status).toBe("ok");
    expect(entry.stdoutSummary).toBe(await realpath(folder));
  });

  it("logs failed commands", async () => {
    const folder = await tempFolder();
    const entry = await executeCommand(folder, { command: "git", args: ["status"], reason: "status" }, "readonly", false);
    expect(entry.status).toBe("error");
    expect(entry.exitCode).not.toBe(0);
  });
});
