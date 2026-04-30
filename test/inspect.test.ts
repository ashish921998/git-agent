import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { inspectRepo, validateFolder } from "../src/inspect.js";

const created: string[] = [];

async function tempFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "git-agent-test-"));
  created.push(folder);
  return folder;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("inspectRepo", () => {
  it("detects a non-git folder", async () => {
    const folder = await tempFolder();
    const state = await inspectRepo(folder);
    expect(state.isGitRepo).toBe(false);
    expect(state.currentBranch).toBeNull();
  });

  it("detects a git repo", async () => {
    const folder = await tempFolder();
    await execa("git", ["init"], { cwd: folder });
    const state = await inspectRepo(folder);
    expect(state.isGitRepo).toBe(true);
  });
});

describe("validateFolder", () => {
  it("returns an absolute valid folder", async () => {
    const folder = await tempFolder();
    await expect(validateFolder(folder)).resolves.toBe(folder);
  });

  it("rejects a missing folder", async () => {
    await expect(validateFolder(join(tmpdir(), "missing-git-agent-folder"))).rejects.toThrow();
  });
});
