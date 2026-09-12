import { spawn } from 'node:child_process';
import { styleText } from 'node:util';
import { cancel, log, note, outro, spinner } from '@clack/prompts';
import { readAgents, listAgents } from './config.js';
import { currentRepoSlug, generateGithubAppToken, resolveBotId } from './github.js';
import {
  assertAccountProvider,
  buildProviderArgs,
  detectAvailableProviders,
  getProviderInfo,
  resolveClaudeAccountDir,
} from './providers.js';
import { syncAntigravityAgent } from './agent-file.js';
import { buildIdentityPrompt } from './identity-prompt.js';
import { formatExpiry, formatScope } from './format.js';
import { addAgentWizard, interactiveSelection, parseArgs, printHelp, printVersion, showIntro } from './cli.js';

function findAgent(agentName) {
  const agent = readAgents().find((item) => item.name === agentName);
  if (!agent) {
    throw new Error(`Agent not found: ${agentName}`);
  }
  return agent;
}

// Leaves a trace in stderr every time an agent (or a human) mints a token
// outside the initial launch — `token`/`gh` are callable at will mid-session,
// so this is the only record that it happened and with what scope.
function announceMint(agentName, minted) {
  const scope = Object.entries(minted.permissions).map(([name, level]) => `${name}:${level}`).join(' ');
  const suffix = scope ? ` · scope: ${scope}${minted.repositorySelection === 'selected' ? ' (selected repos)' : ''}` : '';
  process.stderr.write(`minted fresh token for ${agentName}${suffix}\n`);
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

async function launchAgent(agentName, providerName, accountEmail) {
  const agent = findAgent(agentName);
  const providerInfo = getProviderInfo(providerName, agent);
  assertAccountProvider(providerName, accountEmail);
  const claudeAccountDir = providerName === 'claude' ? resolveClaudeAccountDir(agent, accountEmail) : undefined;

  const s = spinner();
  s.start('Minting installation token');
  const { token: githubToken, account, expiresAt, permissions, repositorySelection } =
    await generateGithubAppToken(agent);
  const botId = await resolveBotId(agent);
  const gitIdentity = buildGitIdentity(agent, botId);
  s.stop(`Token ready for ${styleText('green', gitIdentity.GIT_AUTHOR_NAME)}`);

  const narrowed = Boolean(agent.permissions) || Boolean(agent.repositories);
  const scopeText = formatScope(permissions, narrowed);
  const scopeSummary = repositorySelection === 'selected' ? `${scopeText} · selected repos` : scopeText;

  const gitIdentityInfo = { name: gitIdentity.GIT_AUTHOR_NAME, email: gitIdentity.GIT_AUTHOR_EMAIL };
  const ownPrompt = agent.systemPrompt || agent.instructions || agent.identityPrompt;
  const tokenInfoBase = { agentName: agent.name, scopeText: scopeSummary };
  const identityPrompt = buildIdentityPrompt(gitIdentityInfo, ownPrompt, { ...tokenInfoBase, expiresAt });

  // Antigravity's copy is persisted to disk and only rewritten on the next
  // agent-forge launch (see agent-file.js) — an absolute expiry timestamp in
  // it would go stale the moment `agy --agent <name>` runs without going
  // through agent-forge again. Omit expiresAt here; the recovery instruction
  // alone doesn't age. Scope is safe to keep — it's fixed by the registry
  // entry, not by any one token's clock.
  const antigravityAgent =
    providerName === 'antigravity'
      ? syncAntigravityAgent(agent, buildIdentityPrompt(gitIdentityInfo, ownPrompt, tokenInfoBase))
      : null;

  const runtimeEnv = {
    ...process.env,
    GITHUB_TOKEN: githubToken,
    GH_TOKEN: githubToken,
    ...gitIdentity,
  };
  // claudeAccountDir is undefined (no account picked, leave CLAUDE_CONFIG_DIR
  // as inherited), null (default account picked — force-unset it, in case one
  // was already exported), or a path (a non-default account picked).
  if (claudeAccountDir === null) delete runtimeEnv.CLAUDE_CONFIG_DIR;
  else if (claudeAccountDir) runtimeEnv.CLAUDE_CONFIG_DIR = claudeAccountDir;

  const repoSlug = currentRepoSlug();

  const row = (label, value) => `${styleText('dim', label.padEnd(10))}${value}`;
  const summary = [
    row('provider', styleText(['cyan', 'bold'], providerName)),
    row('identity', styleText('green', gitIdentity.GIT_AUTHOR_NAME)),
  ];
  if (account) summary.push(row('account', styleText('yellow', account)));
  if (claudeAccountDir !== undefined) {
    summary.push(row('claude', styleText('dim', claudeAccountDir === null ? 'default account' : claudeAccountDir)));
  }
  if (repoSlug) summary.push(row('repo', styleText('dim', `${repoSlug.owner}/${repoSlug.repo}`)));
  summary.push(row('scope', styleText('dim', scopeSummary)));
  if (expiresAt) summary.push(row('expires', styleText('dim', formatExpiry(expiresAt))));
  if (antigravityAgent) {
    summary.push(row('agent', styleText('dim', `--agent ${antigravityAgent.name}  ·  ${antigravityAgent.file}`)));
  }
  note(summary.join('\n'), styleText('bold', agent.label || agent.name));

  const providerArgs = buildProviderArgs(providerName, identityPrompt, antigravityAgent);

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

  if (flags.version) {
    printVersion();
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
    announceMint(flags.agent, minted);
    process.stdout.write(minted.token);
    return;
  }

  if (flags.command === 'gh') {
    if (!flags.agent || flags.ghArgs.length === 0) {
      throw new Error('Usage: agent-forge gh <agent-name> <gh args...>');
    }
    const minted = await generateGithubAppToken(findAgent(flags.agent));
    announceMint(flags.agent, minted);
    const child = spawn('gh', flags.ghArgs, {
      stdio: 'inherit',
      env: { ...process.env, GH_TOKEN: minted.token, GITHUB_TOKEN: minted.token },
      shell: false,
    });
    child.on('exit', (code) => process.exit(code ?? 1));
    child.on('error', (error) => {
      log.error(`Could not execute gh: ${error.message}`, { output: process.stderr });
      process.exit(1);
    });
    return;
  }

  showIntro();

  if (flags.agent && flags.provider) {
    if (!detectAvailableProviders().some((provider) => provider.value === flags.provider)) {
      throw new Error(`The provider ${flags.provider} is not installed or not available in PATH.`);
    }
    await launchAgent(flags.agent, flags.provider, flags.account);
    return;
  }

  const interactive = await interactiveSelection({ agent: flags.agent, provider: flags.provider, account: flags.account });
  await launchAgent(interactive.agentName, interactive.providerName, interactive.accountChoice);
}

main().catch((error) => {
  log.error(error.message || String(error), { output: process.stderr });
  process.exit(1);
});
