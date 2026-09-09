import test from 'node:test';
import assert from 'node:assert/strict';
import { getProviderPromptArgs } from '../src/providers.js';

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
