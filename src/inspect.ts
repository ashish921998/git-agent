import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import type { RepoState } from "./types.js";

export async function validateFolder(folder: string): Promise<string> {
  const absolute = resolve(folder);
  await access(absolute, constants.R_OK);
  const info = await stat(absolute);
  if (!info.isDirectory()) {
    throw new Error(`Target is not a folder: ${absolute}`);
  }
  return absolute;
}

export async function inspectRepo(folder: string): Promise<RepoState> {
  const base: RepoState = {
    folder,
    folderExists: true,
    isGitRepo: false,
    currentBranch: null,
    status: "",
  };

  const isRepo = await gitOk(folder, ["rev-parse", "--is-inside-work-tree"]);
  if (!isRepo) {
    return base;
  }

  const branch = await gitText(folder, ["branch", "--show-current"]);
  const status = await gitText(folder, ["status", "--short"]);
  return {
    ...base,
    isGitRepo: true,
    currentBranch: branch || null,
    status,
  };
}

async function gitOk(cwd: string, args: string[]): Promise<boolean> {
  const result = await execa("git", args, { cwd, shell: false, reject: false });
  return result.exitCode === 0;
}

async function gitText(cwd: string, args: string[]): Promise<string> {
  const result = await execa("git", args, { cwd, shell: false, reject: false });
  return result.stdout.trim();
}
