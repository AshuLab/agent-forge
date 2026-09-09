import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTokenScope, githubApiError, parseGithubRemote, pickInstallation } from '../src/github.js';

const installs = [
  { id: '1', account: 'vemec' },
  { id: '2', account: 'AshuLab' },
];

test('pickInstallation: the sole installation is taken', () => {
  assert.equal(pickInstallation([installs[0]], { name: 'a' }), '1');
});

test('pickInstallation: several installations throw with the choices listed', () => {
  assert.throws(() => pickInstallation(installs, { name: 'a', appId: '9' }), /vemec, AshuLab/);
});

test('pickInstallation: no installations throws', () => {
  assert.throws(() => pickInstallation([], { appId: '9' }), /no installations/);
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

test('githubApiError: 401 on a JWT call gets the appId/key hint', () => {
  const msg = githubApiError('/app/installations', 401, 'A JSON web token could not be decoded', true);
  assert.match(msg, /appId matches privateKeyPath/);
});

test('githubApiError: other statuses and non-JWT 401s are passed through plain', () => {
  assert.equal(
    githubApiError('/app', 404, 'Not Found', true),
    'GitHub API /app: 404 Not Found'
  );
  assert.equal(
    githubApiError('/users/x', 401, 'Bad credentials', false),
    'GitHub API /users/x: 401 Bad credentials'
  );
});
