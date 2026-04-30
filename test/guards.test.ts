import { describe, expect, it } from "vitest";
import { assessCommand } from "../src/guards.js";

describe("assessCommand", () => {
  it("allows read-only git commands", () => {
    expect(assessCommand({ command: "git", args: ["status"], reason: "check" }).risk).toBe("readonly");
    expect(assessCommand({ command: "git", args: ["log", "--oneline"], reason: "history" }).risk).toBe("readonly");
  });

  it("marks normal git writes as mutating", () => {
    expect(assessCommand({ command: "git", args: ["init"], reason: "init" }).risk).toBe("mutating");
    expect(assessCommand({ command: "git", args: ["commit", "-m", "test"], reason: "commit" }).risk).toBe("mutating");
    expect(assessCommand({ command: "git", args: ["branch", "demo"], reason: "branch" }).risk).toBe("mutating");
    expect(assessCommand({ command: "git", args: ["remote", "add", "origin", "x"], reason: "remote" }).risk).toBe("mutating");
  });

  it("marks destructive git commands as guarded", () => {
    expect(assessCommand({ command: "git", args: ["reset", "--hard"], reason: "reset" }).risk).toBe("guarded");
    expect(assessCommand({ command: "git", args: ["push", "--force"], reason: "push" }).risk).toBe("guarded");
    expect(assessCommand({ command: "git", args: ["branch", "-D", "demo"], reason: "delete" }).risk).toBe("guarded");
    expect(assessCommand({ command: "git", args: ["checkout", "--", "src/foo.ts"], reason: "discard" }).risk).toBe("guarded");
    expect(assessCommand({ command: "git", args: ["checkout", "-f"], reason: "force checkout" }).risk).toBe("guarded");
    expect(assessCommand({ command: "git", args: ["checkout", "--force"], reason: "force checkout" }).risk).toBe("guarded");
  });

  it("allows small read-only inspection commands", () => {
    expect(assessCommand({ command: "ls", args: ["-la"], reason: "list" }).risk).toBe("readonly");
    expect(assessCommand({ command: "find", args: [".", "-maxdepth", "2", "-type", "f"], reason: "find" }).risk).toBe("readonly");
  });

  it("refuses arbitrary and mutating shell commands", () => {
    expect(assessCommand({ command: "rm", args: ["-rf", "."], reason: "delete" }).allowed).toBe(false);
    expect(assessCommand({ command: "npm", args: ["install"], reason: "install" }).allowed).toBe(false);
  });

  it("refuses shell syntax", () => {
    const result = assessCommand({ command: "git", args: ["status", "|", "cat"], reason: "pipe" });
    expect(result.allowed).toBe(false);
  });
});
