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

  // Only claude gets a flag: --append-system-prompt lands in the real system
  // prompt, stronger than the CLAUDE.md memory block. codex/antigravity read
  // their identity from AGENTS.md (syncIdentityFile) — passing it as a CLI arg
  // there is a fake first user turn (codex) or headless --print (antigravity).
  return providerName === 'claude' ? ['--append-system-prompt', prompt] : [];
}
