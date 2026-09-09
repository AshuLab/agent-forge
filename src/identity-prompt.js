// Every launched agent gets this block as its system prompt, so the model knows
// which GitHub App identity it acts under even when the registry entry has no
// systemPrompt. This is identity only — the session is still an interactive CLI
// driven by a human. The agent's own prompt (optional) is appended after.
export function buildIdentityPrompt({ name, email }, agentPrompt) {
  const base = [
    'You are operating under a GitHub App identity that agent-forge set up for this session; a human is driving it interactively.',
    '',
    `Your commits are authored as \`${name}\` <${email}> — already configured via GIT_AUTHOR_*/GIT_COMMITTER_*, do not change it.`,
    'A scoped, short-lived GitHub App installation token is available in the environment as GH_TOKEN and GITHUB_TOKEN; use it for `gh` and authenticated `git` operations.',
  ].join('\n');

  const own = agentPrompt?.trim();
  return own ? `${base}\n\n${own}` : base;
}
