import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const START = '<!-- agent-forge:identity:start -->';
const END = '<!-- agent-forge:identity:end -->';

// Memory file each provider CLI loads on startup, so the identity also reaches
// subagents the provider spawns (not just its main thread).
const MEMORY_FILE = { claude: 'CLAUDE.md', codex: 'AGENTS.md', antigravity: 'AGENTS.md' };

export function upsertIdentityBlock(content, prompt) {
  const block = `${START}\n${prompt}\n${END}`;
  const start = content.indexOf(START);
  const end = content.indexOf(END);

  if (start !== -1 && end > start) {
    return content.slice(0, start) + block + content.slice(end + END.length);
  }

  return content ? `${content.trimEnd()}\n\n${block}\n` : `${block}\n`;
}

export function syncIdentityFile(providerName, agent, cwd = process.cwd()) {
  const prompt = agent.systemPrompt || agent.instructions || agent.identityPrompt;
  const name = MEMORY_FILE[providerName];
  if (!prompt || !name) return null;

  const file = join(cwd, name);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const next = upsertIdentityBlock(current, prompt);
  if (next !== current) writeFileSync(file, next);
  return file;
}
