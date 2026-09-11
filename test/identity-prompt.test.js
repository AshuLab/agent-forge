import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentityPrompt } from '../src/identity-prompt.js';

const id = { name: 'ops-agent[bot]', email: '42+ops-agent[bot]@users.noreply.github.com' };

test('base block names the git identity and the token env vars', () => {
  const p = buildIdentityPrompt(id);
  assert.match(p, /`ops-agent\[bot\]` <42\+ops-agent\[bot\]@users\.noreply\.github\.com>/);
  assert.match(p, /GH_TOKEN and GITHUB_TOKEN/);
});

test('the base block tells the model this identity wins over a human identity in CLAUDE.md', () => {
  const p = buildIdentityPrompt(id);
  assert.match(p, /authoritative/);
});

test('the agent systemPrompt is appended after a blank line, trimmed', () => {
  const p = buildIdentityPrompt(id, '  You are Ops.  ');
  assert.match(p, /\n\nYou are Ops\.$/);
});

test('an absent or empty systemPrompt leaves just the base block', () => {
  assert.equal(buildIdentityPrompt(id), buildIdentityPrompt(id, ''));
  assert.equal(buildIdentityPrompt(id), buildIdentityPrompt(id, '   '));
});
