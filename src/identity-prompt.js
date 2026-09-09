// Every launched agent gets this block as its system prompt, so the model knows
// it is running as a GitHub App bot even when the registry entry has no
// systemPrompt. The agent's own systemPrompt (optional) is appended after it.
export function buildIdentityPrompt({ name, email }, systemPrompt) {
  const base = [
    'You are running as an automated GitHub App agent, launched by agent-forge.',
    '',
    `Your commits are authored as \`${name}\` <${email}> — already configured via GIT_AUTHOR_*/GIT_COMMITTER_*, do not change it.`,
    'A scoped, short-lived GitHub App installation token is available in the environment as GH_TOKEN and GITHUB_TOKEN; use it for `gh` and authenticated `git` operations.',
  ].join('\n');

  const own = systemPrompt?.trim();
  return own ? `${base}\n\n${own}` : base;
}
