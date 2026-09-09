import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderArgs, getProviderPromptArgs } from '../src/providers.js';

test('claude and codex get a per-process flag; antigravity gets none here (identity via --agent)', () => {
  const agent = { systemPrompt: 'p' };
  assert.deepEqual(getProviderPromptArgs('claude', agent), ['--append-system-prompt', 'p']);
  assert.deepEqual(getProviderPromptArgs('codex', agent), ['-c', 'developer_instructions="p"']);
  assert.deepEqual(getProviderPromptArgs('antigravity', agent), []);
});

test('codex prompt is a TOML-safe string (quotes and newlines escaped)', () => {
  assert.deepEqual(
    getProviderPromptArgs('codex', { systemPrompt: 'say "hi"\nthen go' }),
    ['-c', 'developer_instructions="say \\"hi\\"\\nthen go"']
  );
});

test('no prompt means no args', () => {
  assert.deepEqual(getProviderPromptArgs('claude', {}), []);
  assert.deepEqual(getProviderPromptArgs('codex', {}), []);
});

test('buildProviderArgs appends --agent only when an antigravity agent was written', () => {
  const agent = { systemPrompt: 'p' };
  assert.deepEqual(buildProviderArgs('claude', agent, null), ['--append-system-prompt', 'p']);
  assert.deepEqual(buildProviderArgs('codex', agent, null), ['-c', 'developer_instructions="p"']);
  assert.deepEqual(
    buildProviderArgs('antigravity', agent, { name: 'ops-agent', file: '/x/agent.md' }),
    ['--agent', 'ops-agent']
  );
});
