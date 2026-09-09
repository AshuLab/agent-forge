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
const MARKER = 'agentForge: true';
const AGENTS_HOME = join(homedir(), '.gemini', 'config', 'agents');

// antigravity agent ids: lowercase letters, digits, hyphens. Also keeps `name`
// safe as a path segment (no traversal).
const VALID_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function renderAgentFile(name, description, prompt) {
  return [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    'mainAgent: true',
    MARKER,
    '---',
    '',
    '# Identity',
    '',
    prompt,
    '',
  ].join('\n');
}

// Upsert ~/.gemini/config/agents/<name>/agent.md and return { file, name } for
// `agy --agent <name>`, or null when the agent has no prompt. Throws on an
// invalid name or a name collision with a file we do not manage.
export function syncAntigravityAgent(agent, agentsHome = AGENTS_HOME) {
  const prompt = agent.systemPrompt || agent.instructions || agent.identityPrompt;
  if (!prompt) return null;

  const name = agent.name;
  if (!VALID_NAME.test(name)) {
    throw new Error(
      `Agent name "${name}" is not a valid antigravity agent id (lowercase letters, digits, hyphens).`
    );
  }

  const dir = join(agentsHome, name);
  const file = join(dir, 'agent.md');
  const next = renderAgentFile(name, agent.label || 'GitHub App identity managed by agent-forge', prompt);

  if (existsSync(file)) {
    const current = readFileSync(file, 'utf8');
    if (!current.includes(MARKER)) {
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
