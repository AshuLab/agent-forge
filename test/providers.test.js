import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderArgs, getProviderPromptArgs } from '../src/providers.js';

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
