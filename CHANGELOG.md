# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Launch summary and `agent-forge token` now report the scope GitHub actually
  granted the installation token, so a narrowed `permissions` allowlist that
  drops a needed scope is visible instead of surfacing later as a 403.
- `account` field on an agent: the installation id is now resolved from the App
  on each run (by `account`, or the sole installation), so it survives an
  uninstall/reinstall that rotates the id.

### Changed

- `generateGithubAppToken` returns `{ token, permissions, repositorySelection }`
  instead of a bare token string.
- `installationId` is no longer required or written by the `add` wizard. It stays
  accepted as an explicit override.

## [0.1.0] - 2026-09-07

First release — pre-1.0, API may still change. Not yet published to npm.

### Added

- Launch `claude` / `codex` / `antigravity` under a GitHub App identity.
- Per-run installation token minting; `GH_TOKEN` and `GIT_AUTHOR_*` / `GIT_COMMITTER_*`
  injected into the provider environment.
- `agent-forge add` guided wizard (derives slug, bot id and installation from
  App ID + private key).
- `agent-forge token --agent <name>` for long-session token refresh.
- Managed `agent-forge:identity` block written into `CLAUDE.md` / `AGENTS.md`
  so subagents inherit the identity.
- Optional least-privilege token scoping (`repositories`, `permissions`).
- JSON Schema (`schema/agents.schema.json`) for editor validation of `agents.json`.
- `docs/github-app.md` — guide for creating the GitHub App.
