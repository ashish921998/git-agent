# Vercel AI Git Agent CLI

A TypeScript CLI agent that turns natural-language Git requests into guarded command plans. It uses Vercel AI SDK with Anthropic Claude for planning, then runs only locally allowed commands inside the target folder.

## Setup

```bash
npm install
export ANTHROPIC_API_KEY="your_api_key_here"
npm run build
```

## Usage

```bash
npm run dev -- --folder ./repo "show me what changed"
npm run dev -- --folder ./repo "initialize git here"
npm run dev -- --folder ./repo "add everything and commit it"
npm run dev -- --folder ./repo "create a new branch called feature-login"
```

After building, the compiled CLI is available at:

```bash
node dist/index.js --folder ./repo "show status"
```

## Flags

- `--folder <path>`: target folder, defaults to the current directory
- `--yes`: approve normal mutating Git commands
- `--dry-run`: show the plan without running commands
- `--json`: print operation logs as JSON lines
- `--verbose`: show full command output

## Guardrails

Allowed commands:

- Git commands such as `git status`, `git init`, `git add`, `git commit`, `git diff`, `git log`, `git branch`, `git checkout`, `git switch`, `git remote`, `git fetch`, `git pull`, and `git push`
- Read-only inspection commands: `pwd`, `ls`, `find`, `cat`, `head`, `sed`

Disallowed in v1:

- arbitrary shell execution
- package installs
- shell redirects, pipes, or command chaining
- `rm`, `mv`, `cp`, `mkdir`, `touch`, `sudo`, `curl`, `wget`

Confirmation rules:

- read-only commands run immediately
- normal mutating Git commands require approval unless `--yes` is passed
- guarded commands always require typed confirmation, even with `--yes`
- guarded commands include force push, hard reset, clean, rebase, branch deletion, and other history or file-discarding operations

## Development

```bash
npm run typecheck
npm test
npm run build
```
