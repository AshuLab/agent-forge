import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => JSON.parse(readFileSync(new URL(`../schema/${name}`, import.meta.url)));

test('agents.schema.json stays in sync with agents.example.json', () => {
  const itemSchema = read('agents.schema.json').properties.agents.items;
  const allowed = new Set(Object.keys(itemSchema.properties));

  for (const agent of read('agents.example.json').agents) {
    for (const key of Object.keys(agent)) {
      assert.ok(allowed.has(key), `schema is missing property "${key}"`);
    }
    for (const req of itemSchema.required) {
      assert.ok(req in agent, `agents.example.json missing required "${req}"`);
    }
  }
});
