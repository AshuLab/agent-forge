// Presentation helpers for the launch summary.

// Compact when the agent didn't narrow its own scope: list the write grants,
// count the rest. `full` (agent set `permissions`/`repositories`) prints every
// grant, since that's the case you're inspecting.
export function formatScope(permissions, full = false) {
  const entries = Object.entries(permissions);
  if (entries.length === 0) return 'full installation scope';
  if (full) return entries.map(([name, level]) => `${name}:${level}`).join(' ');

  const writes = entries.filter(([, level]) => level !== 'read').map(([name]) => name);
  if (writes.length === 0) return `read-only (${entries.length})`;

  const reads = entries.length - writes.length;
  return `write: ${writes.join(', ')}${reads ? `  ·  +${reads} read` : ''}`;
}

// "~59m" / "expired" from an ISO timestamp.
export function formatExpiry(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return String(iso);
  const minutes = Math.round(ms / 60000);
  return minutes > 0 ? `~${minutes}m` : 'expired';
}
