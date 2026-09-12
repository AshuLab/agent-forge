# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-09-12

### Added

- `agent-forge gh <name> <gh args...>` mints a fresh GitHub App token and runs the real `gh` with it for that one call — the ergonomic recovery path when a session's injected `GH_TOKEN` goes stale (installation tokens have a fixed, non-renewable-in-place lifetime).

### Changed

- The injected identity prompt now states the token's actual expiry (from GitHub's response, not an assumed duration) and its actual scope, and tells the agent how to mint a replacement (`agent-forge gh`/`agent-forge token`) instead of getting stuck on a `401` mid-session.
- `agent-forge token` and the new `agent-forge gh` both announce every mint to stderr (`minted fresh token for <name> · scope: ...`), so a mid-session refresh leaves a trace.

## [0.7.1] - 2026-09-11

### Changed

- The injected identity prompt now states it is authoritative over any human identity described in project/personal instructions (e.g. `CLAUDE.md`), so an agent doesn't confuse the human driving the session with the GitHub App identity it posts as.
- The injected identity prompt asks the agent to state its identity in its first reply, so the human driving it can see which one is active.

## [0.7.0] - 2026-09-11

### Added

- `--account <email>` picks which Claude login (`CLAUDE_CONFIG_DIR`) a `claude`-provider launch runs under. With no `--account`, the interactive wizard shows a picker when it detects more than one account on the machine; with exactly one, or when the agent already has a `providers.claude.accountDir` configured, the picker is skipped.
- `providers.claude.accountDir` in `agents.json` pins a fixed Claude account per agent, so it doesn't need to be picked on every run.

### Changed

- A `providers.claude.accountDir` with no valid login now fails fast with a clear error, instead of silently starting `claude` unauthenticated.
- `--account` combined with a non-`claude` provider is now rejected with an explicit error instead of being silently ignored.

## [0.6.0] - 2026-09-10

### Changed

- A `401` from a GitHub API call signed with the App JWT now explains the likely cause — `appId` not matching `privateKeyPath`, or a skewed system clock — instead of surfacing GitHub's bare `A JSON web token could not be decoded`.

### Fixed

- The antigravity custom agent no longer carries a `description:` field. A non-empty description made `agy` classify the agent as a restricted definition and strip its execution tools (`run_command`, `write_to_file`, `replace_file_content`, subagents), leaving a read-only session that could not use the `GH_TOKEN` it was handed. Launched antigravity agents now get the full toolset.

### Documentation

- Troubleshooting table gains a row for the rejected-App-JWT `401`.

## [0.5.0] - 2026-09-09

### Changed

- Every launched agent now gets a GitHub App identity prompt, even with no `systemPrompt` set — a fixed block naming the git author identity and the `GH_TOKEN` / `GITHUB_TOKEN` in the environment, with the agent's `systemPrompt` (when set) appended after. Before this, an agent with no prompt was launched with nothing.
- The `add` wizard notes that identity is injected for you, so `systemPrompt` should carry only what is specific to the agent — role, style, guardrails.
- `antigravity` identity is no longer a managed `AGENTS.md` block. The launcher writes a global antigravity custom agent at `~/.gemini/config/agents/<name>/agent.md` and passes `--agent <name>`, so the repo is untouched and several agents can share a worktree — matching `claude` and `codex`. The file is keyed by the registry `name`, upserted on each run, never auto-deleted, and a collision with a file lacking the `agentForge` marker aborts the launch.
- `agents.json` `name` must now match `^[a-z0-9][a-z0-9-]*$` (it is also the antigravity custom-agent id and a path segment).

### Removed

- `src/identity.js` and the `<!-- agent-forge:identity -->` block — no provider needs it now. If you launched `antigravity` before this change, an inert `<!-- agent-forge:identity -->` block may still sit in your repo's `AGENTS.md`; nothing reads or removes it now, so delete it by hand.

## [0.4.0] - 2026-09-07

### Changed

- Identity is injected per process for `claude` (`--append-system-prompt`) and `codex` (`-c developer_instructions`) — no `CLAUDE.md` / `AGENTS.md` is written, so the repo is untouched and several agents can share a worktree. Only `antigravity` still falls back to a managed `AGENTS.md` block.

### Removed

- The `account` agent field. The installation id is resolved from the repo you launch in, then the App's sole installation; an App on several accounts must be launched from inside a repo it covers. The `add` wizard no longer asks.

### Documentation

- Explain that a private GitHub App installs on one account only, and how to run one agent across several (public App, or one App per account).
- Document the launch summary rows and drop the stale "record the installation id" step.

## [0.3.0] - 2026-09-07

### Added

- `agent-forge --version` / `-v` prints the version.
- Interactive launcher shows an ASCII banner and the version in its header.
- The "Launch … with …?" prompt colors the agent and provider names.

### Changed

- Launch summary adds `account`, `repo` and `expires` rows, and the scope line is compacted (writes listed, reads counted) unless the agent narrows `permissions`/`repositories`.
- Cancelling a prompt shows `✖ Cancelled`; declining first-run onboarding exits with a plain hint instead of a red cancel.

## [0.2.0] - 2026-09-07

### Added

- First-run onboarding: when no agent is configured, the interactive launcher offers to run the `add` wizard instead of erroring out.
- Launch summary, `agent-forge token`, and the `add` wizard's test-mint now report the scope GitHub actually granted the installation token, so a narrowed `permissions` allowlist that drops a needed scope is visible instead of surfacing later as a 403.
- The installation id is now resolved on each run — from the owner of the repo you launch in, then the optional `account` field, then the App's sole installation. The same agent works across every org the App is on, and it survives an uninstall/reinstall that rotates the id.

### Changed

- Documentation is no longer hard-wrapped — one line per paragraph or list item.
- Interactive launcher auto-selects the agent or provider when only one is available, instead of showing a single-option menu.
- `generateGithubAppToken` returns `{ token, permissions, repositorySelection }` instead of a bare token string.
- `installationId` is no longer required or written by the `add` wizard. It stays accepted as an explicit override.

## [0.1.0] - 2026-09-07

First release — pre-1.0, API may still change. Not yet published to npm.

### Added

- Launch `claude` / `codex` / `antigravity` under a GitHub App identity.
- Per-run installation token minting; `GH_TOKEN` and `GIT_AUTHOR_*` / `GIT_COMMITTER_*` injected into the provider environment.
- `agent-forge add` guided wizard (derives slug, bot id and installation from App ID + private key).
- `agent-forge token --agent <name>` for long-session token refresh.
- Managed `agent-forge:identity` block written into `CLAUDE.md` / `AGENTS.md` so subagents inherit the identity.
- Optional least-privilege token scoping (`repositories`, `permissions`).
- JSON Schema (`schema/agents.schema.json`) for editor validation of `agents.json`.
- `docs/github-app.md` — guide for creating the GitHub App.
