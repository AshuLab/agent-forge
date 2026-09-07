# AGENTS.md

Context for coding agents working in this repo.

## What this is

`@ashulab/agent-forge` — a small CLI that launches a coding-agent provider (`claude` / `codex` / `antigravity`) under a **GitHub App identity**.

Per run it:

1. reads agent metadata from `agents.json`,
2. mints a GitHub App installation token,
3. injects `GH_TOKEN` / `GITHUB_TOKEN` and `GIT_AUTHOR_*` / `GIT_COMMITTER_*` into the child environment,
4. writes the agent's `systemPrompt` into the provider's startup memory file (`CLAUDE.md` for claude, `AGENTS.md` for codex/antigravity) inside a managed `<!-- agent-forge:identity -->` block, so subagents inherit the identity,
5. spawns the provider CLI with stdio inherited.

Provider auth stays in the provider CLI. The launcher never handles provider API keys.

## Requirements

- Node.js >= 24
- pnpm (never npm or yarn)

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | run the CLI from source (`src/launcher.js`) |
| `pnpm test` | run `node --test` over `test/*.test.js` (built-in runner, no deps) |
| `pnpm build` | bundle to `dist/launcher.cjs` with esbuild (gitignored) |
| `pnpm start` | run the built binary |

## Layout

- `src/launcher.js` — entrypoint: arg routing, `launchAgent`, git-identity build, spawn.
- `src/cli.js` — arg parsing, help text, interactive selection, `add` wizard.
- `src/config.js` — locate/read/validate `agents.json`, append agents.
- `src/github.js` — App JWT, installation tokens, installation-id + bot-id resolution, App metadata.
- `src/providers.js` — provider table, PATH detection, per-provider prompt flags.
- `src/identity.js` — upsert the managed identity block in the memory file.
- `test/*.test.js` — one test file per module, run by Node's built-in test runner.
- `schema/agents.schema.json` — JSON Schema for `agents.json`, kept in sync with `schema/agents.example.json` (`test/schema.test.js` enforces it).
- `docs/github-app.md` — how a human creates the GitHub App, and how an agent can assist. Point users here when they lack an App ID / key / installation.

## Conventions

- ESM only, 2-space indent, positive conditions over negations.
- No speculative abstractions — add only what the task needs.
- Non-trivial logic gets a case in the matching `test/<module>.test.js`; `pnpm test` must pass.
- Markdown files are not hard-wrapped — one line per paragraph or list item, let the editor soft-wrap.
- Config resolution (first match): `$AGENT_FORGE_CONFIG`, then the global registry `~/.config/agent-forge/agents.json`, then `./agents.json` if it already exists. `add` and `readAgents` resolve the same path. "Which repo" is the cwd; "which identity" is this registry — they are decoupled on purpose.

## Gotchas

- `dist/` is gitignored; `prepublishOnly` rebuilds before publish.
- Running the launcher inside this repo will rewrite the identity block in this file — that is expected and safe to commit.
- Never commit `agents.json` or `*.pem` (private keys). Both are gitignored.

<!-- agent-forge:identity:start -->
You are Tassadar Agent, a Expert Senior software engineer and systems thinker. Work with discipline, prefer minimal correct changes, and explain trade-offs clearly. Keep your responses concise and technical.
<!-- agent-forge:identity:end -->
