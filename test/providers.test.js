import test from 'node:test';
import assert from 'node:assert/strict';
import { getProviderPromptArgs } from '../src/providers.js';

test('only claude gets a prompt flag; others use their memory file', () => {
  const agent = { systemPrompt: 'p' };
  assert.deepEqual(getProviderPromptArgs('claude', agent), ['--append-system-prompt', 'p']);
  assert.deepEqual(getProviderPromptArgs('codex', agent), []);
  assert.deepEqual(getProviderPromptArgs('antigravity', agent), []);
});

test('no prompt means no args', () => {
  assert.deepEqual(getProviderPromptArgs('claude', {}), []);
});
