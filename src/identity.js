import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const START = '<!-- agent-forge:identity:start -->';
const END = '<!-- agent-forge:identity:end -->';

// Fallback for providers with no per-process identity flag (see
// getProviderPromptArgs): write the prompt into the memory file the CLI loads
// on startup. Only antigravity — claude and codex take a CLI flag.
const MEMORY_FILE = { antigravity: 'AGENTS.md' };

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
