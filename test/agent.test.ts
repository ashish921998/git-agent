import { describe, expect, it } from "vitest";
import { parsePlanForTest } from "../src/agent.js";

const validPlan = {
  summary: "List files",
  commands: [{ command: "ls", args: ["-la"], reason: "Show files" }],
};

describe("parsePlanForTest", () => {
  it("parses a plain plan object", () => {
    expect(parsePlanForTest(JSON.stringify(validPlan))).toEqual(validPlan);
  });

  it("parses a plan surrounded by text", () => {
    const raw = `Sure, here is the plan:\n${JSON.stringify(validPlan)}\nDone.`;
    expect(parsePlanForTest(raw)).toEqual(validPlan);
  });

  it("skips an earlier non-plan object and parses the later valid plan", () => {
    const raw = `{"error":"not enough context"}\n${JSON.stringify(validPlan)}`;
    expect(parsePlanForTest(raw)).toEqual(validPlan);
  });

  it("handles nested objects inside strings and escaped quotes", () => {
    const plan = {
      summary: "Explain JSON-looking text",
      commands: [
        {
          command: "git",
          args: ["commit", "-m", "message with { braces } and \"quotes\""],
          reason: "Commit with a message containing JSON-looking characters",
        },
      ],
    };

    expect(parsePlanForTest(JSON.stringify(plan))).toEqual(plan);
  });

  it("throws a helpful error for malformed JSON", () => {
    expect(() => parsePlanForTest('{"summary":"broken"')).toThrow(/invalid command plan/i);
  });

  it("throws a helpful error when no JSON exists", () => {
    expect(() => parsePlanForTest("not json at all")).toThrow(/non-json output/i);
  });

  it("throws when JSON does not match the plan schema", () => {
    expect(() => parsePlanForTest('{"summary":"missing commands"}')).toThrow(/invalid command plan/i);
  });
});
