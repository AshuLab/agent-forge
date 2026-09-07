import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTokenScope, parseGithubRemote, pickInstallation } from '../src/github.js';

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

test('pickInstallation: a non-string account fails cleanly, not with a TypeError', () => {
  assert.throws(() => pickInstallation(installs, { account: 12345, appId: '9' }), /not installed on "12345"/);
});

test('parseGithubRemote: ssh, https, with and without .git and trailing slash', () => {
  const want = { owner: 'AshuLab', repo: 'agent-forge' };
  assert.deepEqual(parseGithubRemote('git@github.com:AshuLab/agent-forge.git'), want);
  assert.deepEqual(parseGithubRemote('https://github.com/AshuLab/agent-forge.git'), want);
  assert.deepEqual(parseGithubRemote('https://github.com/AshuLab/agent-forge'), want);
  assert.deepEqual(parseGithubRemote('ssh://git@github.com/AshuLab/agent-forge.git\n'), want);
  assert.deepEqual(parseGithubRemote('https://github.com/AshuLab/agent-forge/'), want);
});

test('parseGithubRemote: non-github or junk is null', () => {
  assert.equal(parseGithubRemote('git@gitlab.com:foo/bar.git'), null);
  assert.equal(parseGithubRemote(''), null);
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
