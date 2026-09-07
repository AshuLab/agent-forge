import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTokenScope, pickInstallation } from '../src/github.js';

const installs = [
  { id: '1', account: 'vemec' },
  { id: '2', account: 'AshuLab' },
];

test('pickInstallation: matches account case-insensitively', () => {
  assert.equal(pickInstallation(installs, { account: 'ashulab' }), '2');
});

test('pickInstallation: single installation needs no account', () => {
  assert.equal(pickInstallation([installs[0]], { name: 'a' }), '1');
});

test('pickInstallation: ambiguous without account throws with the choices', () => {
  assert.throws(() => pickInstallation(installs, { name: 'a', appId: '9' }), /vemec, AshuLab/);
});

test('pickInstallation: unknown account throws', () => {
  assert.throws(() => pickInstallation(installs, { account: 'nope', appId: '9' }), /not installed on "nope"/);
});

test('pickInstallation: no installations throws', () => {
  assert.throws(() => pickInstallation([], { appId: '9' }), /no installations/);
});

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
