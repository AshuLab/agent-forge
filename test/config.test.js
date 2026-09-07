import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mergeAgent, resolveConfigPath } from '../src/config.js';

test('AGENT_FORGE_CONFIG overrides config discovery', () => {
  process.env.AGENT_FORGE_CONFIG = 'some/custom/agents.json';
  try {
    assert.equal(resolveConfigPath(), resolve('some/custom/agents.json'));
  } finally {
    delete process.env.AGENT_FORGE_CONFIG;
  }
});

test('append, no mutation, dedupe by name', () => {
  const base = { agents: [{ name: 'a' }] };
  const next = mergeAgent(base, { name: 'b' });
  assert.equal(next.agents.length, 2);
  assert.deepEqual(base.agents, [{ name: 'a' }], 'input not mutated');
  assert.throws(() => mergeAgent(base, { name: 'a' }), /already exists/);
  assert.equal(mergeAgent({}, { name: 'x' }).agents.length, 1, 'handles missing agents array');
});
