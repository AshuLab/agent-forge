# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
