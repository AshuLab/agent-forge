# AGENTS.md

Context for coding agents working in this repo.

## What this is

`@ashulab/agent-forge` — a small CLI that launches a coding-agent provider (`claude` / `codex` / `antigravity`) under a **GitHub App identity**.

Per run it:

1. reads agent metadata from `agents.json`,
2. mints a GitHub App installation token,
3. injects `GH_TOKEN` / `GITHUB_TOKEN` and `GIT_AUTHOR_*` / `GIT_COMMITTER_*` into the child environment,
4. injects an identity prompt per process — a fixed block telling the model which GitHub App identity it acts under (git author identity + `GH_TOKEN`/`GITHUB_TOKEN` in env), with the agent's optional `systemPrompt` appended — via `claude --append-system-prompt`, `codex -c developer_instructions`; antigravity has no prompt flag, so the launcher writes a global custom agent at `~/.gemini/config/agents/<name>/agent.md` and passes `--agent <name>` — no repo file is touched,
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
- `src/providers.js` — provider table, PATH detection, per-provider prompt flags, claude multi-account detection (`CLAUDE_CONFIG_DIR`).
- `src/agent-file.js` — upsert the antigravity global custom agent (`~/.gemini/config/agents/<name>/agent.md`), guarded by the `agentForge` ownership marker.
- `src/format.js` — presentation helpers for the launch summary (scope, expiry).
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

- `dist/` is gitignored — `pnpm build` regenerates `dist/launcher.cjs`; `prepublishOnly` runs build + test before publish.
- No offline mode: `pnpm dev`, `agent-forge token`, and `agent-forge gh` always mint a real installation token, so they need a valid `appId` and a readable `privateKeyPath` or they fail at "Minting installation token".
- `agent-forge gh <name> <gh args...>` mints a token and execs the real `gh` with it for that one call only — the fix for a session's injected `GH_TOKEN` going stale mid-run (installation tokens aren't renewable in place). The identity prompt tells the agent to use it instead of the raw env var once a call starts 401ing.
- claude and codex receive their identity via a CLI flag — nothing is written. `antigravity` writes/updates a global custom agent under `~/.gemini/config/agents/<name>/` (outside the repo, persisted, never auto-deleted); a name collision with a file lacking the `agentForge` marker aborts the launch instead of overwriting it.
