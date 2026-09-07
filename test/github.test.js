import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTokenScope } from '../src/github.js';

test('buildTokenScope: nothing set means no scoping (inherit App grant)', () => {
  assert.deepEqual(buildTokenScope({ name: 'a' }), {});
});

test('buildTokenScope: passes through repositories and permissions', () => {
  assert.deepEqual(
    buildTokenScope({ repositories: ['skills'], permissions: { pull_requests: 'write' } }),
    { repositories: ['skills'], permissions: { pull_requests: 'write' } }
  );
});

test('buildTokenScope: ignores malformed values', () => {
  assert.deepEqual(buildTokenScope({ repositories: 'skills', permissions: 'write' }), {});
});
