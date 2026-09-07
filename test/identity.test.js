import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertIdentityBlock } from '../src/identity.js';

test('fresh insert is idempotent', () => {
  const fresh = upsertIdentityBlock('', 'FIRST IDENTITY');
  assert.equal(upsertIdentityBlock(fresh, 'FIRST IDENTITY'), fresh);
});

test('keeps existing content and swaps the prompt in place', () => {
  const withDoc = upsertIdentityBlock('# Title\n\nbody', 'FIRST IDENTITY');
  assert.ok(withDoc.startsWith('# Title\n\nbody'), 'keeps existing content');

  const swapped = upsertIdentityBlock(withDoc, 'SECOND IDENTITY');
  assert.ok(swapped.includes('SECOND IDENTITY'), 'replaces prompt');
  assert.ok(!swapped.includes('FIRST IDENTITY'), 'old prompt removed');
  assert.equal((swapped.match(/identity:start/g) || []).length, 1, 'single block');
});
