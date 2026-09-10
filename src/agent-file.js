import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// antigravity (`agy`) has no per-process prompt flag. Instead it discovers
// "custom agents" — Markdown files with YAML frontmatter and an H1-delimited
// system prompt — and `--agent <name>` selects one for the session.
//
// We write the agent's identity as a global custom agent under the machine
// config root, so no repo file is touched. `name` + `mainAgent: true` are both
// required or `agy` silently falls back to its default agent. The `agentForge`
// key is our ownership marker: on a rerun we refuse to overwrite an agent.md we
// did not write.
//
// We deliberately omit `description:`. A non-empty description makes `agy`
// classify the agent as a restricted definition and strip its "fundamental
// components" — run_command, write_to_file, replace_file_content, subagents —
// leaving a read-only toolset that cannot run `gh`/`git` with the token we
// provision. Verified against `agy` locally (2026-09).
const MARKER = 'agentForge: true';
// Ownership is a frontmatter line, not a substring: only the exact
// `agentForge: true` spelling, and only inside the leading `---` block, counts
// as ours. A standalone marker line in the prompt body does not.
const MARKER_LINE = /^agentForge:\s*true\s*$/m;

function isManagedByAgentForge(text) {
  const end = text.startsWith('---\n') ? text.indexOf('\n---', 4) : -1;
  return end !== -1 && MARKER_LINE.test(text.slice(0, end));
}
const AGENTS_HOME = join(homedir(), '.gemini', 'config', 'agents');

// antigravity agent ids: lowercase letters, digits, hyphens. Also keeps `name`
// safe as a path segment (no traversal).
const VALID_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function renderAgentFile(name, prompt) {
  return [
    '---',
    `name: ${name}`,
    'mainAgent: true',
    MARKER,
    '---',
    '',
    '# Identity',
    '',
    prompt.trimEnd(),
    '',
  ].join('\n');
}

// Upsert ~/.gemini/config/agents/<name>/agent.md and return { file, name } for
// `agy --agent <name>`. Throws on an invalid name or a name collision with a
// file we do not manage.
export function syncAntigravityAgent(agent, prompt, agentsHome = AGENTS_HOME) {
  const name = agent.name;
  if (!VALID_NAME.test(name)) {
    throw new Error(
      `Agent name "${name}" is not a valid antigravity agent id (lowercase letters, digits, hyphens).`
    );
  }

  const dir = join(agentsHome, name);
  const file = join(dir, 'agent.md');
  const next = renderAgentFile(name, prompt);

  if (existsSync(file)) {
    const current = readFileSync(file, 'utf8');
    if (!isManagedByAgentForge(current)) {
      throw new Error(
        `${file} already exists and is not managed by agent-forge.\n` +
          `Rename the agent in your registry or remove that file.`
      );
    }
    if (next !== current) writeFileSync(file, next);
    return { file, name };
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, next);
  return { file, name };
}
