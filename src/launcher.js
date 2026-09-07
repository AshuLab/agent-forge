import { spawn } from 'node:child_process';
import { relative } from 'node:path';
import { styleText } from 'node:util';
import { cancel, log, note, outro, spinner } from '@clack/prompts';
import { readAgents, listAgents } from './config.js';
import { generateGithubAppToken, resolveBotId } from './github.js';
import { detectAvailableProviders, getProviderInfo, getProviderPromptArgs } from './providers.js';
import { syncIdentityFile } from './identity.js';
import { addAgentWizard, interactiveSelection, parseArgs, printHelp, showIntro } from './cli.js';

function findAgent(agentName) {
  const agent = readAgents().find((item) => item.name === agentName);
  if (!agent) {
    throw new Error(`Agent not found: ${agentName}`);
  }
  return agent;
}

function buildGitIdentity(agent, botId) {
  const identity = `${agent.botName || agent.name}[bot]`;
  const email = `${botId}+${identity}@users.noreply.github.com`;

  return {
    GIT_AUTHOR_NAME: identity,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: identity,
    GIT_COMMITTER_EMAIL: email,
  };
}

async function launchAgent(agentName, providerName) {
  const agent = findAgent(agentName);
  const providerInfo = getProviderInfo(providerName, agent);

  const s = spinner();
  s.start('Minting installation token');
  const { token: githubToken, permissions, repositorySelection } = await generateGithubAppToken(agent);
  const botId = await resolveBotId(agent);
  const gitIdentity = buildGitIdentity(agent, botId);
  s.stop(`Token ready for ${styleText('green', gitIdentity.GIT_AUTHOR_NAME)}`);

  const identityFile = syncIdentityFile(providerName, agent);

  const runtimeEnv = {
    ...process.env,
    GITHUB_TOKEN: githubToken,
    GH_TOKEN: githubToken,
    ...gitIdentity,
  };

  const scopeEntries = Object.entries(permissions);
  const scopeText = scopeEntries.length
    ? scopeEntries.map(([name, level]) => `${name}:${level}`).join(' ')
    : 'full installation scope';

  const row = (label, value) => `${styleText('dim', label.padEnd(10))}${value}`;
  const summary = [
    row('provider', styleText(['cyan', 'bold'], providerName)),
    row('identity', styleText('green', gitIdentity.GIT_AUTHOR_NAME)),
    row('token', styleText('dim', repositorySelection === 'selected' ? `${scopeText} · selected repos` : scopeText)),
  ];
  if (identityFile) {
    summary.push(row('memory', styleText('dim', relative(process.cwd(), identityFile) || identityFile)));
  }
  note(summary.join('\n'), styleText('bold', agent.label || agent.name));

  const providerArgs = getProviderPromptArgs(providerName, agent);

  const child = spawn(providerInfo.command, providerArgs, {
    stdio: 'inherit',
    env: runtimeEnv,
    shell: false,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    cancel(`Could not execute ${providerInfo.command}: ${error.message}`);
    process.exit(1);
  });

  outro(`Running ${styleText('cyan', providerName)}…`);
}

async function main() {
  const flags = parseArgs();

  if (flags.help) {
    printHelp();
    return;
  }

  if (flags.list) {
    listAgents();
    return;
  }

  if (flags.command === 'add') {
    await addAgentWizard();
    return;
  }

  if (flags.command === 'token') {
    if (!flags.agent) {
      throw new Error('Usage: agent-forge token --agent <name>');
    }
    const minted = await generateGithubAppToken(findAgent(flags.agent));
    const scope = Object.entries(minted.permissions).map(([name, level]) => `${name}:${level}`).join(' ');
    if (scope) process.stderr.write(`scope: ${scope}${minted.repositorySelection === 'selected' ? ' (selected repos)' : ''}\n`);
    process.stdout.write(minted.token);
    return;
  }

  showIntro();

  if (flags.agent && flags.provider) {
    if (!detectAvailableProviders().some((provider) => provider.value === flags.provider)) {
      throw new Error(`The provider ${flags.provider} is not installed or not available in PATH.`);
    }
    await launchAgent(flags.agent, flags.provider);
    return;
  }

  const interactive = await interactiveSelection({ agent: flags.agent, provider: flags.provider });
  await launchAgent(interactive.agentName, interactive.providerName);
}

main().catch((error) => {
  log.error(error.message || String(error), { output: process.stderr });
  process.exit(1);
});
