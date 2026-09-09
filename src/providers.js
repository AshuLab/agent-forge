import { spawnSync } from 'node:child_process';

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

export function getProviderPromptArgs(providerName, agent) {
  const prompt = agent.systemPrompt || agent.instructions || agent.identityPrompt;
  if (!prompt) {
    return [];
  }

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
export function buildProviderArgs(providerName, agent, antigravityAgent) {
  return [
    ...getProviderPromptArgs(providerName, agent),
    ...(antigravityAgent ? ['--agent', antigravityAgent.name] : []),
  ];
}
