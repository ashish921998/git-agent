import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { AgentPlan, RepoState } from "./types.js";

const commandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
  reason: z.string().min(1),
});

const planSchema = z.object({
  summary: z.string().min(1),
  commands: z.array(commandSchema).min(1),
});

export async function createAgentPlan(request: string, repoState: RepoState): Promise<AgentPlan> {
  const prompt = buildPrompt(request, repoState);
  const result = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema: planSchema,
    prompt,
  });

  return result.object;
}

function buildPrompt(request: string, repoState: RepoState): string {
  return `You are a Git operations planning agent. Return a structured command plan.

Rules:
- The user speaks in natural language. Convert the request into a small command plan.
- Allowed commands are git plus read-only inspection commands: pwd, ls, find, cat, head, sed.
- Prefer git commands for Git questions.
- Do not use pipes, redirects, command chaining, sudo, package managers, or file-writing shell commands.
- Return command as the executable only, for example "git" or "ls".
- Return args as an array, for example ["status", "--short"].
- If the user asks to commit without a message, choose a reasonable concise commit message.
- If the folder is not a Git repo and the user asks to inspect Git history/status, use a read-only inspection command or explain via a harmless command plan like ["pwd"].
- Keep the plan simple and practical for a CLI demo.

Repo state:
${JSON.stringify(repoState, null, 2)}

User request:
${request}`;
}

export function parsePlanForTest(raw: string): AgentPlan {
  return parsePlan(raw);
}

function parsePlan(raw: string): AgentPlan {
  const errors: string[] = [];
  try {
    for (const json of extractJsonObjects(raw)) {
      try {
        const parsed: unknown = JSON.parse(json);
        return planSchema.parse(parsed);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(`Claude returned an invalid command plan: ${errors.join("; ") || "no JSON object found"}\nRaw output:\n${raw}`);
}

function extractJsonObjects(raw: string): string[] {
  const trimmed = raw.trim();
  const objects: string[] = [];

  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] !== "{") {
      continue;
    }
    const json = readBalancedObject(trimmed, index);
    objects.push(json);
    index += json.length - 1;
  }

  if (objects.length === 0) {
    throw new Error(`Claude returned non-JSON output: ${raw}`);
  }
  return objects;
}

function readBalancedObject(input: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  throw new Error("Could not find a complete JSON object.");
}
