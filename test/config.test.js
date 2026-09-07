import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mergeAgent, readAgents, readAgentsOrEmpty, resolveConfigPath } from '../src/config.js';

const withConfig = (contents, fn) => {
  const path = join(mkdtempSync(join(tmpdir(), 'af-')), 'agents.json');
  if (contents !== undefined) writeFileSync(path, contents);
  process.env.AGENT_FORGE_CONFIG = path;
  try {
    return fn(path);
  } finally {
    delete process.env.AGENT_FORGE_CONFIG;
  }
};

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

test('readAgentsOrEmpty: missing file and empty registry are [], not errors', () => {
  withConfig(undefined, () => assert.deepEqual(readAgentsOrEmpty(), []));
  withConfig('{"agents":[]}', () => assert.deepEqual(readAgentsOrEmpty(), []));
});

test('readAgentsOrEmpty: broken JSON still throws', () => {
  withConfig('{ not json', () => assert.throws(() => readAgentsOrEmpty(), /not valid JSON/));
});

test('readAgents: distinct messages for missing file vs empty registry', () => {
  withConfig(undefined, () => assert.throws(() => readAgents(), /No agents\.json found/));
  withConfig('{"agents":[]}', () => assert.throws(() => readAgents(), /no agents defined/));
});
