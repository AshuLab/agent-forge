import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildProviderArgs,
  detectClaudeAccounts,
  getProviderPromptArgs,
  resolveClaudeAccount,
  resolveClaudeAccountDir,
} from '../src/providers.js';

const accounts = [
  { dir: null, email: 'a@x.com', org: 'Org A' },
  { dir: '/home/u/.claude-work', email: 'b@x.com', org: 'Org B' },
];

// A fake $HOME, torn down after use, so filesystem-backed tests don't touch
// the real machine's Claude accounts.
function withFakeHome(run) {
  const home = mkdtempSync(join(tmpdir(), 'agent-forge-home-'));
  try {
    return run(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

function writeAccount(configPath, emailAddress, organizationName) {
  writeFileSync(configPath, JSON.stringify({ oauthAccount: { emailAddress, organizationName } }));
}

test('claude and codex wrap the prompt in a per-process flag; antigravity gets none here (identity via --agent)', () => {
  assert.deepEqual(getProviderPromptArgs('claude', 'p'), ['--append-system-prompt', 'p']);
  assert.deepEqual(getProviderPromptArgs('codex', 'p'), ['-c', 'developer_instructions="p"']);
  assert.deepEqual(getProviderPromptArgs('antigravity', 'p'), []);
});

test('codex prompt is a TOML-safe string (quotes and newlines escaped)', () => {
  assert.deepEqual(
    getProviderPromptArgs('codex', 'say "hi"\nthen go'),
    ['-c', 'developer_instructions="say \\"hi\\"\\nthen go"']
  );
});

test('buildProviderArgs appends --agent only when an antigravity agent was written', () => {
  assert.deepEqual(buildProviderArgs('claude', 'p', null), ['--append-system-prompt', 'p']);
  assert.deepEqual(buildProviderArgs('codex', 'p', null), ['-c', 'developer_instructions="p"']);
  assert.deepEqual(
    buildProviderArgs('antigravity', 'p', { name: 'ops-agent', file: '/x/agent.md' }),
    ['--agent', 'ops-agent']
  );
});

test('resolveClaudeAccount matches by email, throws with the known list otherwise', () => {
  assert.deepEqual(resolveClaudeAccount('b@x.com', accounts), accounts[1]);
  assert.throws(() => resolveClaudeAccount('nope@x.com', accounts), /Known: a@x\.com, b@x\.com/);
});

test('resolveClaudeAccountDir: explicit email wins over agents.json, which wins over unset', () => {
  withFakeHome((home) => {
    const configuredDir = join(home, '.claude-configured');
    mkdirSync(configuredDir);
    writeAccount(join(configuredDir, '.claude.json'), 'configured@x.com');

    const agent = { providers: { claude: { accountDir: configuredDir } } };
    assert.equal(resolveClaudeAccountDir(agent, 'b@x.com', accounts), '/home/u/.claude-work');
    assert.equal(resolveClaudeAccountDir(agent, undefined, accounts), configuredDir);
    assert.equal(resolveClaudeAccountDir({}, undefined, accounts), undefined);
  });
});

test('resolveClaudeAccountDir: picking the default account resolves to null (force-unset), not undefined (leave as-is)', () => {
  assert.equal(resolveClaudeAccountDir({}, 'a@x.com', accounts), null);
});

test('resolveClaudeAccountDir: rejects a persisted accountDir with no logged-in account (typo, wiped login)', () => {
  withFakeHome((home) => {
    const staleDir = join(home, '.claude-stale');
    mkdirSync(staleDir); // no .claude.json inside
    const agent = { providers: { claude: { accountDir: staleDir } } };
    assert.throws(() => resolveClaudeAccountDir(agent, undefined, accounts), /has no logged-in Claude account/);
  });
});

test('detectClaudeAccounts: finds the default ($HOME/.claude.json) and a custom (.claude-*/.claude.json) account, skips broken/unauthenticated/missing ones', () => {
  withFakeHome((home) => {
    writeAccount(join(home, '.claude.json'), 'default@x.com', 'Default Org');

    const workDir = join(home, '.claude-work');
    mkdirSync(workDir);
    writeAccount(join(workDir, '.claude.json'), 'work@x.com', 'Work Org');

    const brokenDir = join(home, '.claude-broken');
    mkdirSync(brokenDir);
    writeFileSync(join(brokenDir, '.claude.json'), 'not json');

    const loggedOutDir = join(home, '.claude-loggedout');
    mkdirSync(loggedOutDir);
    writeFileSync(join(loggedOutDir, '.claude.json'), JSON.stringify({}));

    mkdirSync(join(home, '.claude-empty')); // no .claude.json at all

    const found = detectClaudeAccounts(home);
    assert.deepEqual(
      found.find((account) => account.dir === null),
      { dir: null, email: 'default@x.com', org: 'Default Org' }
    );
    assert.deepEqual(
      found.find((account) => account.dir === workDir),
      { dir: workDir, email: 'work@x.com', org: 'Work Org' }
    );
    assert.equal(found.length, 2, 'broken JSON, no oauthAccount, and no .claude.json must all be skipped');
  });
});
