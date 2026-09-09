import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderAgentFile, syncAntigravityAgent } from '../src/agent-file.js';

const home = () => mkdtempSync(join(tmpdir(), 'agent-forge-'));

test('rendered agent.md has the required frontmatter and the prompt under an H1', () => {
  const md = renderAgentFile('ops-agent', 'Ops Agent', 'You are Ops.');
  assert.match(md, /^name: ops-agent$/m);
  assert.match(md, /^mainAgent: true$/m);
  assert.match(md, /^agentForge: true$/m);
  assert.match(md, /\n# Identity\n\nYou are Ops\.\n$/);
});

test('description is a YAML-safe scalar even with a colon', () => {
  const md = renderAgentFile('a', 'Ops: the agent', 'p');
  assert.match(md, /^description: "Ops: the agent"$/m);
});

test('creates the agent dir and returns { file, name }', () => {
  const agentsHome = home();
  const result = syncAntigravityAgent({ name: 'ops-agent', label: 'Ops', systemPrompt: 'p' }, agentsHome);
  assert.equal(result.name, 'ops-agent');
  assert.equal(result.file, join(agentsHome, 'ops-agent', 'agent.md'));
  assert.ok(readFileSync(result.file, 'utf8').includes('# Identity'));
});

test('no prompt means no agent file', () => {
  assert.equal(syncAntigravityAgent({ name: 'x' }, home()), null);
});

test('rejects a name that is not a safe slug', () => {
  assert.throws(() => syncAntigravityAgent({ name: '../evil', systemPrompt: 'p' }, home()), /not a valid antigravity agent id/);
  assert.throws(() => syncAntigravityAgent({ name: 'Ops_Agent', systemPrompt: 'p' }, home()), /not a valid antigravity agent id/);
});

test('updates our own file when the prompt changes, leaves it alone otherwise', () => {
  const agentsHome = home();
  const agent = { name: 'ops-agent', label: 'Ops', systemPrompt: 'first' };
  const { file } = syncAntigravityAgent(agent, agentsHome);
  const first = readFileSync(file, 'utf8');

  assert.equal(readFileSync(syncAntigravityAgent(agent, agentsHome).file, 'utf8'), first, 'no-op on identical input');

  syncAntigravityAgent({ ...agent, systemPrompt: 'second' }, agentsHome);
  const next = readFileSync(file, 'utf8');
  assert.ok(next.includes('second') && !next.includes('first'));
});

test('refuses to overwrite an agent.md it does not manage', () => {
  const agentsHome = home();
  const dir = join(agentsHome, 'ops-agent');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'agent.md'), '---\nname: ops-agent\nmainAgent: true\n---\n\n# Identity\n\nhand written\n');

  assert.throws(
    () => syncAntigravityAgent({ name: 'ops-agent', systemPrompt: 'p' }, agentsHome),
    /not managed by agent-forge/
  );
});

test('the ownership marker is a frontmatter line, not a substring of the prompt', () => {
  const agentsHome = home();
  const dir = join(agentsHome, 'ops-agent');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'agent.md'),
    '---\nname: ops-agent\nmainAgent: true\n---\n\n# Identity\n\nNote: agentForge: true means managed.\n'
  );

  assert.throws(
    () => syncAntigravityAgent({ name: 'ops-agent', systemPrompt: 'p' }, agentsHome),
    /not managed by agent-forge/
  );
});

test('a prompt with trailing whitespace does not add a blank line before EOF', () => {
  assert.match(renderAgentFile('a', 'A', 'You are A.\n\n'), /You are A\.\n$/);
});
