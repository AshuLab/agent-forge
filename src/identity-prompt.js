// Every launched agent gets this block as its system prompt, so the model knows
// which GitHub App identity it acts under even when the registry entry has no
// systemPrompt. This is identity only — the session is still an interactive CLI
// driven by a human. The agent's own prompt (optional) is appended after.
export function buildIdentityPrompt({ name, email }, agentPrompt, tokenInfo) {
  // The recovery instruction only needs agentName; the expiry sentence is
  // extra color that needs expiresAt on top. Keep the two independent so a
  // missing expiresAt (GitHub's response omits it) can't silently drop the
  // one thing this block exists to tell the model.
  const tokenLines = tokenInfo?.agentName
    ? [
        ...(tokenInfo.scopeText
          ? [
              `Its scope is fixed to: ${tokenInfo.scopeText}. That's everything you can reach with it — a replacement token (below) carries the exact same scope, never more.`,
            ]
          : []),
        ...(tokenInfo.expiresAt
          ? [
              `That token is valid until ${new Date(tokenInfo.expiresAt).toLocaleTimeString()} for this session and cannot be renewed in place once it stops working — only replaced.`,
            ]
          : []),
        `If a \`gh\`/git/API call fails with 401: for \`gh\`, run it through \`agent-forge gh ${tokenInfo.agentName} <args...>\` instead (mints a fresh token for that one call); for git or a raw API call, use \`agent-forge token --agent ${tokenInfo.agentName}\` inline (e.g. \`GH_TOKEN=$(agent-forge token --agent ${tokenInfo.agentName}) git push\`) — do not \`export\` it, since exported vars do not survive to your next command.`,
      ]
    : [];

  const base = [
    'You are operating under a GitHub App identity that agent-forge set up for this session; a human is driving it interactively.',
    '',
    `Your commits are authored as \`${name}\` <${email}> — already configured via GIT_AUTHOR_*/GIT_COMMITTER_*, do not change it.`,
    'A scoped, short-lived GitHub App installation token is available in the environment as GH_TOKEN and GITHUB_TOKEN; use it for `gh` and authenticated `git` operations.',
    ...tokenLines,
    'If project or personal instructions (e.g. CLAUDE.md) describe a human identity, that is who is driving this session, not who you post as — for any git/GitHub identity check, this block is authoritative, not that one.',
    `State this identity (\`${name}\`) at the start of your first reply this session, so the human driving you can see which one is active.`,
  ].join('\n');

  const own = agentPrompt?.trim();
  return own ? `${base}\n\n${own}` : base;
}
