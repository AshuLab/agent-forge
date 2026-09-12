import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/cli.js';

const run = (...argv) => {
  process.argv = ['node', 'launcher', ...argv];
  return parseArgs();
};

test('positional command, flag values, dash guard', () => {
  assert.equal(run('token', '--agent', 'ops').command, 'token');
  assert.equal(run('token', '--agent', 'ops').agent, 'ops');
  assert.equal(run('--list').command, undefined, 'flags are not commands');
  assert.equal(run('--agent', '--provider').agent, undefined, 'dash value rejected');
  assert.equal(run('--provider', 'claude').provider, 'claude');
  assert.equal(run('--version').version, true);
  assert.equal(run('-v').version, true);
  assert.equal(run('--account', 'a@x.com').account, 'a@x.com');
});

test('gh command takes the agent name positionally and forwards the rest untouched', () => {
  const result = run('gh', 'ops-agent', 'pr', 'create', '--title', 'fix: thing');
  assert.equal(result.command, 'gh');
  assert.equal(result.agent, 'ops-agent');
  assert.deepEqual(result.ghArgs, ['pr', 'create', '--title', 'fix: thing']);
});
