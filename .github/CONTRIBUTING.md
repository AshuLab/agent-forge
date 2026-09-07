# Contributing

Thanks for helping out. This is a small, dependency-light CLI — keep changes minimal and correct.

## Setup

```bash
pnpm install   # never npm or yarn
pnpm test      # node --test over test/*.test.js
pnpm dev       # run the CLI from source
```

Requires Node.js >= 24.

## Ground rules

- ESM only, 2-space indent, positive conditions over negations.
- No speculative abstractions — add only what the task needs.
- Non-trivial logic gets a case in the matching `test/<module>.test.js`. `pnpm test` must pass before you open a PR.
- Never commit `agents.json` or `*.pem` private keys (both are gitignored).
- Keep `schema/agents.schema.json` and `schema/agents.example.json` in sync — `test/schema.test.js` enforces it.
- Don't hard-wrap Markdown — one line per paragraph or list item.

See [AGENTS.md](../AGENTS.md) for the module layout and gotchas.

## Pull requests

1. Branch off `main`.
2. Keep the diff focused; one concern per PR.
3. Update `CHANGELOG.md` under `## [Unreleased]` if the change is user-visible.
4. Make sure `pnpm test` passes.

## Reporting bugs

Open an issue with the command you ran, what you expected, and what happened. Redact App IDs, installation IDs, and key paths.
