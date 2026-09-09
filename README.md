# Agent Forge

A small CLI for launching coding agents (`claude`, `codex`, `antigravity`) with a **GitHub App identity** and a provider CLI chosen at runtime.

On each run the launcher:

- reads agent metadata from `agents.json`
- generates a GitHub App installation token
- detects installed provider CLIs on your PATH
- asks which provider to use (or takes it from a flag)
- starts the provider with the GitHub token and a per-agent git identity injected into the environment
- injects the agent's `systemPrompt` per process (`claude --append-system-prompt`, `codex -c developer_instructions`; antigravity via a global custom agent selected with `--agent`) — no repo file is touched

Provider auth stays in the provider CLI — the launcher never handles provider API keys.

## Requirements

- Node.js 24+
- a GitHub App with an installation on the target account/org — [how to create one](docs/github-app.md)
- the App private key stored locally (e.g. in `~/.ssh`)
- one of these provider CLIs on your PATH: `claude`, `codex`, `agy` (antigravity)

## Install

```bash
pnpm add -g @ashulab/agent-forge
```

Or run without installing:

```bash
pnpm dlx @ashulab/agent-forge --help
```

## Configuration

Your agents live in a single machine-global registry — you launch the tool from inside each target repo, but the identities are not per-repo. The launcher reads `agents.json` from the first of these that exists:

1. `$AGENT_FORGE_CONFIG`
2. `~/.config/agent-forge/agents.json` — the global registry (`agent-forge add` writes here)
3. `./agents.json` — only if it already exists

The easiest path is `agent-forge add` (see below), which creates the global file for you. Do **not** drop `agents.json` into a project you run the agent in: it holds real App / installation IDs and private-key paths and must stay out of version control.

The shape, for reference — the `"$schema"` line points at the published schema so any editor that understands JSON Schema gives you field descriptions, required-field checks and typo detection:

```json
{
  "$schema": "https://raw.githubusercontent.com/AshuLab/agent-forge/main/schema/agents.schema.json",
  "agents": [
    {
      "name": "ops-agent",
      "label": "Ops Agent",
      "appId": "123456",
      "botName": "ops-agent",
      "privateKeyPath": "~/.ssh/ops-agent.private-key.pem",
      "systemPrompt": "You are Ops Agent, a senior DevOps engineer. Prefer safe, minimal changes and explain operational risks clearly."
    }
  ]
}
```

- The **installation id is not stored** — it is resolved on each run, in order: the owner of the repo you launch in, then the App's sole installation. So the same agent works across every org the App is installed on, and it survives an uninstall/reinstall (which rotates the id).
- An App installed on more than one account only resolves when you launch from inside a repo it covers — that repo picks the installation.
- `installationId` is accepted as an explicit override — set it to pin a specific id or skip the lookup (offline, or in a git credential helper).
- One agent, many accounts: a **private** GitHub App only installs on the account that owns it. To run the agent on both a personal account and an org, make the App public or use one App per account — see [docs/github-app.md](docs/github-app.md).
- `botId` is optional. When omitted it is resolved from the GitHub API using `botName` so the git author email links commits to the bot. Set it explicitly only to skip that lookup (e.g. offline).
- Do not put provider-specific config here — providers are auto-detected from PATH.

### Least-privilege tokens (optional)

By default the installation token carries the full installation scope. Narrow it per agent with either or both of:

```json
{
  "repositories": ["some-repo", "another-repo"],
  "permissions": { "contents": "read", "pull_requests": "write" }
}
```

**`permissions` is a complete allowlist, not a patch.** GitHub grants *only* the keys you list and drops everything else — even permissions the GitHub App itself has. If you set `permissions` at all, you must list every scope the agent needs. Common cases:

| The agent needs to… | Minimum `permissions` |
| --- | --- |
| Push commits / open PRs | `{ "contents": "write", "pull_requests": "write" }` |
| Review PRs (incl. inline comments) | `{ "contents": "read", "pull_requests": "write" }` |
| Read-only (clone, read issues) | `{ "contents": "read" }` |

Omitting the `permissions` key entirely is the safe default — the token then carries whatever the App grants. `repositories` works the same way: list it and the token can only touch those repos.

On launch, `agent-forge` prints the scope GitHub actually granted (`scope` row in the summary, alongside the `account` the token is for); `agent-forge token --agent <name>` prints it to stderr. If a call fails with `403 Resource not accessible by integration`, check that row first.

## Add an agent

You need a GitHub App first — its **App ID**, a **private key**, and an **installation**. If you don't have one yet, follow [docs/github-app.md](docs/github-app.md).

Running `agent-forge` with no agents configured offers to run the wizard for you.

### Guided (recommended)

```bash
agent-forge add
```

You provide the **GitHub App ID** and the **path to its private key**. The wizard derives the rest from the GitHub API — slug (`botName`), bot user id — asks for a label and an optional system prompt, mints a test token to confirm it works, and writes the entry. It writes to the resolved config path — the global registry (`~/.config/agent-forge/agents.json`) unless `$AGENT_FORGE_CONFIG` or an existing `./agents.json` redirects it.

### Manual

Copy one agent object inside the `agents` array and set unique values for `name`, `label`, `appId`, `botName`, `privateKeyPath`. Make sure the private key file exists and is readable.

## Launch

Interactive:

```bash
agent-forge
```

Direct flags (passing both skips the menus; passing one pre-fills it, the other is prompted — or auto-picked when only one agent or provider is available):

```bash
agent-forge --agent ops-agent --provider claude
agent-forge --agent review-agent --provider codex
```

Before launching, it prints a summary:

```
│  provider  claude
│  identity  ops-agent[bot]
│  account   AshuLab            ← which account the token is for
│  repo      AshuLab/app        ← the repo you're in (drives account)
│  scope     write: contents, issues, pull_requests  ·  +4 read
│  expires   ~59m               ← installation tokens last ~1h
```

(The `antigravity` provider adds an `agent` row showing the `--agent` id and the custom-agent file it wrote.)

Other commands:

```bash
agent-forge --list
agent-forge --version
agent-forge --help
```

### Provider-specific prompt behavior

`systemPrompt` is injected per process — no repo file is touched:

- `claude`: `--append-system-prompt` (lands in the real system prompt)
- `codex`: `-c developer_instructions=…` (appends a developer message; unlike `model_instructions_file` it does not replace codex's base prompt)
- `antigravity` (`agy`): no prompt flag — the launcher writes `systemPrompt` as a global antigravity custom agent at `~/.gemini/config/agents/<name>/agent.md` (frontmatter `name`, `mainAgent: true`, `agentForge: true`; prompt under an `# Identity` heading) and passes `--agent <name>`. The file is keyed by the agent's registry `name`, upserted on each run, and never deleted. If a file with that name exists without our `agentForge` marker, the launch fails rather than overwrite it — rename the agent or remove that file.

## Token refresh

Installation tokens last ~1 hour. For longer sessions, print a fresh one on demand:

```bash
export GH_TOKEN=$(agent-forge token --agent ops-agent)
```

Or wire it into git as a credential helper so pushes never see a stale token:

```bash
git config credential.https://github.com.helper \
  '!f() { test "$1" = get && echo username=x-access-token && echo "password=$(agent-forge token --agent ops-agent)"; }; f'
```

Resolution still works here — the repo you push from is the one used. Setting `installationId` explicitly just skips the lookup on every push.

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md).

## License

[MIT](./LICENSE)
