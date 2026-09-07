import test from 'node:test';
import assert from 'node:assert/strict';
import { formatExpiry, formatScope } from '../src/format.js';

const grant = {
  actions: 'read',
  checks: 'read',
  contents: 'write',
  issues: 'write',
  metadata: 'read',
  pull_requests: 'write',
  statuses: 'read',
};

test('formatScope: compact lists writes and counts reads', () => {
  assert.equal(formatScope(grant), 'write: contents, issues, pull_requests  ·  +4 read');
});

test('formatScope: full keeps every grant', () => {
  assert.equal(formatScope({ contents: 'write', metadata: 'read' }, true), 'contents:write metadata:read');
});

test('formatScope: read-only and empty', () => {
  assert.equal(formatScope({ contents: 'read', metadata: 'read' }), 'read-only (2)');
  assert.equal(formatScope({}), 'full installation scope');
});

test('formatExpiry: minutes ahead, and past', () => {
  assert.equal(formatExpiry(new Date(Date.now() + 59 * 60000).toISOString()), '~59m');
  assert.equal(formatExpiry(new Date(Date.now() - 1000).toISOString()), 'expired');
  assert.equal(formatExpiry('not-a-date'), 'not-a-date');
});
