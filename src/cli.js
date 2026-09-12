import { styleText } from 'node:util';
import { cancel, confirm, intro, isCancel, note, outro, select, spinner, text } from '@clack/prompts';
import { addAgent, readAgents, readAgentsOrEmpty } from './config.js';
import { fetchAppMetadata, generateGithubAppToken, resolveBotId } from './github.js';
import {
  assertAccountProvider,
  detectAvailableProviders,
  detectClaudeAccounts,
  hasPersistedClaudeAccount,
  resolveClaudeAccount,
} from './providers.js';
import pkg from '../package.json' with { type: 'json' };

const LOGO = `
▄▄  ▄▄▄ ▄▄▄ ▄▄  ▄▄▄      ▄▄▄ ▄▄  ▄▄  ▄▄▄ ▄▄▄
█▄█ █ ▄ █▄  █ █  █       █▄  █ █ █▄▀ █ ▄ █▄
█ █ ▀▄█ █▄▄ █ █  █       █   ▀▄▀ █ █ ▀▄█ █▄▄
`;

export function printVersion() {
  console.log(pkg.version);
}

export function printHelp() {
  console.log(`
Agent Forge v${pkg.version}

Usage:
  agent-forge
  agent-forge --agent <name> --provider <claude|codex|antigravity>
  agent-forge --agent <name> --provider claude --account <email>   pick which Claude login to run under
  agent-forge add                    guided setup for a new agent
  agent-forge token --agent <name>   print a fresh GitHub App token (for refresh)
  agent-forge gh <name> <gh args...> mint a fresh token and run gh with it, e.g.:
                                      agent-forge gh ops-agent pr create --title "..."
  agent-forge --list
  agent-forge --version
  agent-forge --help

Requirements:
  - an agents.json registry (run "agent-forge add" to create one)
  - a working provider CLI installed and available in PATH
  - the GitHub App private key readable at the configured privateKeyPath

Config resolution (first match wins):
  - $AGENT_FORGE_CONFIG
  - ~/.config/agent-forge/agents.json   (the global registry, where "add" writes)
  - ./agents.json                          (only if it already exists)
`);
}

// Clean stop on a user-initiated cancel: "└  ✖ <message>" then exit 0.
function bail(message = 'Cancelled') {
  cancel(`✖  ${message}`);
  process.exit(0);
}

function keep(value) {
  if (isCancel(value)) {
    bail();
  }
  return value;
}

export async function addAgentWizard({ embedded = false } = {}) {
  if (!embedded) intro('Add agent');

  const appId = keep(
    await text({
      message: 'GitHub App ID',
      validate: (v) => (/^\d+$/.test(v.trim()) ? undefined : 'Must be a numeric App ID'),
    })
  ).trim();

  const privateKeyPath = keep(
    await text({
      message: 'Private key path',
      placeholder: '~/.ssh/my-app.private-key.pem',
      validate: (v) => (v.trim() ? undefined : 'Required'),
    })
  ).trim();

  const probe = spinner();
  probe.start('Reading the App from GitHub');
  const meta = await fetchAppMetadata(appId, privateKeyPath);
  const botId = await resolveBotId({ botName: meta.slug });
  probe.stop(`App "${meta.name}" · bot ${meta.slug}[bot] #${botId}`);

  if (meta.installations.length === 0) {
    throw new Error('This App has no installations. Install it on an account or org first.');
  }

  // The installation id is resolved at run time from the repo you launch in,
  // never stored — nothing to ask here.
  const where =
    meta.installations.length === 1
      ? `${meta.installations[0].account} — resolved automatically each run`
      : `${meta.installations.map((i) => i.account).join(', ')} — resolved from the repo you launch in`;
  note(where, 'Installation');

  const name = (keep(await text({
    message: 'Agent name',
    placeholder: meta.slug,
    defaultValue: meta.slug,
    validate: (v) => (/^[a-z0-9][a-z0-9-]*$/.test(v.trim()) ? undefined : 'Lowercase letters, digits, hyphens'),
  })) || meta.slug).trim();
  const label = (keep(await text({ message: 'Label', placeholder: meta.name, defaultValue: meta.name })) || meta.name).trim();
  note(
    [
      'agent-forge already tells every launched agent:',
      '  · its bot git identity (GIT_AUTHOR_*/GIT_COMMITTER_*)',
      '  · that a scoped GH_TOKEN / GITHUB_TOKEN is in the environment',
      '',
      'Add only what is specific to this agent — role, style, guardrails.',
    ].join('\n'),
    'Identity is handled for you'
  );
  const systemPrompt = keep(await text({ message: 'System prompt (optional)', placeholder: 'You are ...' })).trim();

  const agent = {
    name,
    label,
    appId,
    botName: meta.slug,
    privateKeyPath,
    ...(systemPrompt ? { systemPrompt } : {}),
  };

  const check = spinner();
  check.start('Minting a test token');
  const { permissions } = await generateGithubAppToken(agent);
  const scope = Object.entries(permissions)
    .map(([name, level]) => `${name}:${level}`)
    .join(' ');
  check.stop(scope ? `Test token ok · ${scope}` : 'Test token ok');

  const path = addAgent(agent);
  if (embedded) {
    note(`Wrote ${path}`, 'Agent added');
  } else {
    outro(`Wrote ${path}`);
  }
  return agent.name;
}

export async function interactiveSelection(defaults = {}) {
  const availableProviders = detectAvailableProviders();

  if (availableProviders.length === 0) {
    throw new Error('No installed provider was detected. Install claude, codex, or antigravity before running the launcher.');
  }

  let agents = readAgentsOrEmpty();
  if (agents.length === 0 && !defaults.agent) {
    note('No agents configured yet. Each agent is a GitHub App identity the launcher runs under.', 'First run');
    if (!keep(await confirm({ message: 'Add one now?' }))) {
      outro(`Run ${styleText('cyan', 'agent-forge add')} when you're ready.`);
      process.exit(0);
    }
    await addAgentWizard({ embedded: true });
    agents = readAgents();
  }

  let agentChoice = defaults.agent;
  if (agentChoice && !agents.some((agent) => agent.name === agentChoice)) {
    throw new Error(`Agent not found: ${agentChoice}`);
  }
  if (!agentChoice) {
    agentChoice =
      agents.length === 1
        ? agents[0].name
        : keep(
            await select({
              message: 'Which agent do you want to launch?',
              options: agents.map((agent) => ({ value: agent.name, label: agent.label || agent.name })),
            })
          );
  }

  let providerChoice = defaults.provider;
  if (providerChoice && !availableProviders.some((provider) => provider.value === providerChoice)) {
    throw new Error(`The provider ${providerChoice} is not installed or not available in PATH.`);
  }
  if (!providerChoice) {
    providerChoice =
      availableProviders.length === 1
        ? availableProviders[0].value
        : keep(
            await select({
              message: 'Which provider do you want to use?',
              options: availableProviders.map((provider) => ({ value: provider.value, label: provider.label })),
            })
          );
  }

  let accountChoice = defaults.account;
  assertAccountProvider(providerChoice, accountChoice);
  if (providerChoice === 'claude') {
    if (accountChoice) {
      resolveClaudeAccount(accountChoice);
    } else {
      const persisted = hasPersistedClaudeAccount(agents.find((item) => item.name === agentChoice));
      const accounts = persisted ? [] : detectClaudeAccounts();
      if (accounts.length > 1) {
        accountChoice = keep(
          await select({
            message: 'Which Claude account?',
            options: accounts.map((account) => ({
              value: account.email,
              label: account.org ? `${account.email}  ·  ${account.org}` : account.email,
            })),
          })
        );
      }
    }
  }

  const launchPrompt = `Launch ${styleText('green', agentChoice)} with ${styleText(['cyan', 'bold'], providerChoice)}?`;
  if (!keep(await confirm({ message: launchPrompt }))) {
    bail('Cancelled — nothing launched');
  }

  return { agentName: agentChoice, providerName: providerChoice, accountChoice };
}

export function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args[0] : undefined;

  const result = {
    command,
    help: false,
    version: false,
    list: false,
    agent: undefined,
    provider: undefined,
    account: undefined,
  };

  // `gh` forwards everything after the agent name to the real `gh` binary
  // as opaque argv — it must not go through the flag loop below, or a
  // passthrough flag like `--title` could collide with agent-forge's own.
  if (command === 'gh') {
    return { ...result, agent: args[1], ghArgs: args.slice(2) };
  }

  const value = (next) => (next && !next.startsWith('-') ? next : undefined);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--help' || arg === '-h') result.help = true;
    if (arg === '--version' || arg === '-v') result.version = true;
    if (arg === '--list' || arg === '-l') result.list = true;
    if (arg === '--agent' || arg === '-a') {
      result.agent = value(next);
      i += 1;
    }
    if (arg === '--provider' || arg === '-p') {
      result.provider = value(next);
      i += 1;
    }
    if (arg === '--account') {
      result.account = value(next);
      i += 1;
    }
  }

  return result;
}

export function showIntro() {
  console.log(styleText('cyan', LOGO));
  intro(`Agent Forge ${styleText('dim', `v${pkg.version}`)}`);
}
