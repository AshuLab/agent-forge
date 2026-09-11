import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderArgs, getProviderPromptArgs, resolveClaudeAccount, resolveClaudeAccountDir } from '../src/providers.js';

const accounts = [
  { dir: null, email: 'a@x.com', org: 'Org A' },
  { dir: '/home/u/.claude-work', email: 'b@x.com', org: 'Org B' },
];

test('claude and codex wrap the prompt in a per-process flag; antigravity gets none here (identity via --agent)', () => {
  assert.deepEqual(getProviderPromptArgs('claude', 'p'), ['--append-system-prompt', 'p']);
  assert.deepEqual(getProviderPromptArgs('codex', 'p'), ['-c', 'developer_instructions="p"']);
  assert.deepEqual(getProviderPromptArgs('antigravity', 'p'), []);
});

test('codex prompt is a TOML-safe string (quotes and newlines escaped)', () => {
  assert.deepEqual(
    getProviderPromptArgs('codex', 'say "hi"\nthen go'),
    ['-c', 'developer_instructions="say \\"hi\\"\\nthen go"']
  );
});

test('buildProviderArgs appends --agent only when an antigravity agent was written', () => {
  assert.deepEqual(buildProviderArgs('claude', 'p', null), ['--append-system-prompt', 'p']);
  assert.deepEqual(buildProviderArgs('codex', 'p', null), ['-c', 'developer_instructions="p"']);
  assert.deepEqual(
    buildProviderArgs('antigravity', 'p', { name: 'ops-agent', file: '/x/agent.md' }),
    ['--agent', 'ops-agent']
  );
});

test('resolveClaudeAccount matches by email, throws with the known list otherwise', () => {
  assert.deepEqual(resolveClaudeAccount('b@x.com', accounts), accounts[1]);
  assert.throws(() => resolveClaudeAccount('nope@x.com', accounts), /Known: a@x\.com, b@x\.com/);
});

test('resolveClaudeAccountDir: explicit email wins over agents.json, which wins over unset', () => {
  const agent = { providers: { claude: { accountDir: '~/.claude-configured' } } };
  assert.equal(resolveClaudeAccountDir(agent, 'b@x.com', accounts), '/home/u/.claude-work');
  assert.match(resolveClaudeAccountDir(agent, undefined, accounts), /\.claude-configured$/);
  assert.equal(resolveClaudeAccountDir({}, undefined, accounts), undefined);
});

test('resolveClaudeAccountDir: picking the default account resolves to null (force-unset), not undefined (leave as-is)', () => {
  assert.equal(resolveClaudeAccountDir({}, 'a@x.com', accounts), null);
});
