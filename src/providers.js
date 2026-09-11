import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expandHome } from './github.js';

export const PROVIDER_OPTIONS = [
  { value: 'claude', label: 'Claude', defaultCommand: 'claude' },
  { value: 'codex', label: 'Codex', defaultCommand: 'codex' },
  { value: 'antigravity', label: 'Antigravity', defaultCommand: 'agy', aliases: ['antigravity', 'agy'] },
];

export function isCommandInstalled(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { stdio: 'ignore' });
  return result.status === 0;
}

export function detectAvailableProviders() {
  return PROVIDER_OPTIONS.filter((provider) => {
    const candidates = [provider.defaultCommand, ...(provider.aliases || [])];
    return candidates.some((candidate) => isCommandInstalled(candidate));
  }).map((provider) => ({
    ...provider,
    defaultCommand: provider.aliases?.find((candidate) => isCommandInstalled(candidate)) || provider.defaultCommand,
  }));
}

export function getProviderInfo(providerName, agent) {
  const provider = PROVIDER_OPTIONS.find((item) => item.value === providerName);
  if (!provider) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }

  const agentProvider = agent.providers?.[providerName] || {};
  const command = agentProvider.command || provider.defaultCommand;
  const resolvedCommand = isCommandInstalled(command)
    ? command
    : (provider.aliases || []).find((alias) => isCommandInstalled(alias)) || command;

  return { provider, command: resolvedCommand };
}

export function getProviderPromptArgs(providerName, prompt) {
  // Per-process identity, no repo file touched:
  //   claude — --append-system-prompt lands in the real system prompt
  //   codex  — -c developer_instructions appends a developer message (a real
  //            append, unlike model_instructions_file which replaces the base)
  // antigravity has no prompt flag: the launcher writes a global custom agent
  // (syncAntigravityAgent) and passes `--agent <name>` separately.
  if (providerName === 'claude') return ['--append-system-prompt', prompt];
  if (providerName === 'codex') return ['-c', `developer_instructions=${JSON.stringify(prompt)}`];
  return [];
}

// Full provider argv: the per-process prompt flag, plus `--agent <name>` when the
// launcher wrote an antigravity custom agent. Pure so the identity-critical
// assembly has a test.
export function buildProviderArgs(providerName, prompt, antigravityAgent) {
  return [
    ...getProviderPromptArgs(providerName, prompt),
    ...(antigravityAgent ? ['--agent', antigravityAgent.name] : []),
  ];
}

// A .claude.json is a real account only once it has actually logged in.
function readClaudeAccount(configPath) {
  if (!existsSync(configPath)) return null;
  try {
    const { oauthAccount } = JSON.parse(readFileSync(configPath, 'utf8'));
    return oauthAccount?.emailAddress ? oauthAccount : null;
  } catch {
    return null;
  }
}

// claude reads CLAUDE_CONFIG_DIR for its whole account (auth, settings, history).
// The default account (CLAUDE_CONFIG_DIR unset) keeps its .claude.json at
// $HOME, not under $HOME/.claude — that split is claude's own default layout,
// so it gets dir: null (meaning "unset CLAUDE_CONFIG_DIR", not "set it to $HOME").
// Any other login lives fully under a $HOME/.claude-* dir the user pointed
// CLAUDE_CONFIG_DIR at at least once. `home` is injectable for tests.
export function detectClaudeAccounts(home = homedir()) {
  const candidates = [
    { dir: null, configPath: join(home, '.claude.json') },
    ...readdirSync(home)
      .filter((entry) => entry.startsWith('.claude-'))
      .map((entry) => join(home, entry))
      .map((dir) => ({ dir, configPath: join(dir, '.claude.json') })),
  ];

  return candidates
    .map(({ dir, configPath }) => {
      const account = readClaudeAccount(configPath);
      return account ? { dir, email: account.emailAddress, org: account.organizationName } : null;
    })
    .filter(Boolean);
}

// Matches --account / a wizard pick (an email) against detected accounts.
export function resolveClaudeAccount(email, accounts = detectClaudeAccounts()) {
  const match = accounts.find((account) => account.email === email);
  if (!match) {
    const known = accounts.map((account) => account.email).join(', ') || 'none detected';
    throw new Error(`No Claude account matches "${email}". Known: ${known}`);
  }
  return match;
}

// agents.json stores a literal CLAUDE_CONFIG_DIR path (providers.claude.accountDir);
// --account/wizard picks resolve an email against detectClaudeAccounts() instead.
// A stale/typo'd configured path fails loudly here rather than silently inside
// the spawned claude process (a confusing "not logged in" with agent-forge
// having already reported success).
export function resolveClaudeAccountDir(agent, accountEmail, accounts = detectClaudeAccounts()) {
  if (accountEmail) return resolveClaudeAccount(accountEmail, accounts).dir;
  const configured = agent.providers?.claude?.accountDir;
  if (!configured) return undefined;
  const dir = expandHome(configured);
  if (!readClaudeAccount(join(dir, '.claude.json'))) {
    throw new Error(
      `providers.claude.accountDir "${configured}" has no logged-in Claude account (expected ${join(dir, '.claude.json')} with an oauthAccount)`
    );
  }
  return dir;
}

// True once an agent has a sticky Claude login in agents.json — the wizard
// skips its account picker in that case rather than overriding it every run.
export function hasPersistedClaudeAccount(agent) {
  return Boolean(agent?.providers?.claude?.accountDir);
}

// Shared by interactiveSelection (pre-confirm) and launchAgent (the direct
// --agent/--provider path, which has no confirm step to validate ahead of).
export function assertAccountProvider(providerName, accountEmail) {
  if (accountEmail && providerName !== 'claude') {
    throw new Error(`--account only applies to the claude provider (got --provider ${providerName})`);
  }
}
