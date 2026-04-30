export type AgentCommand = {
  command: string;
  args: string[];
  reason: string;
};

export type AgentPlan = {
  summary: string;
  commands: AgentCommand[];
};

export type RepoState = {
  folder: string;
  folderExists: boolean;
  isGitRepo: boolean;
  currentBranch: string | null;
  status: string;
};

export type CommandRisk = "readonly" | "mutating" | "guarded" | "refused";

export type CommandAssessment = {
  risk: CommandRisk;
  allowed: boolean;
  reason?: string;
  confirmationPhrase?: string;
};

export type CliOptions = {
  folder: string;
  yes: boolean;
  dryRun: boolean;
  json: boolean;
  verbose: boolean;
};

export type LogEntry = {
  ts: string;
  cwd: string;
  command: string[];
  reason: string;
  status: "planned" | "ok" | "error" | "skipped" | "refused";
  risk: CommandRisk;
  exitCode: number | null;
  durationMs: number;
  stdoutSummary: string;
  stderrSummary: string;
  message?: string;
};
