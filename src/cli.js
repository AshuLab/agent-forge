import { cancel, confirm, intro, isCancel, note, outro, select, spinner, text } from '@clack/prompts';
import { addAgent, readAgents } from './config.js';
import { fetchAppMetadata, generateGithubAppToken, resolveBotId } from './github.js';
import { detectAvailableProviders } from './providers.js';

export function printHelp() {
  console.log(`
Agent Forge

Usage:
  agent-forge
  agent-forge --agent <name> --provider <claude|codex|antigravity>
  agent-forge add                    guided setup for a new agent
  agent-forge token --agent <name>   print a fresh GitHub App token (for refresh)
  agent-forge --list
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

function keep(value) {
  if (isCancel(value)) {
    cancel('Cancelled.');
    process.exit(0);
  }
  return value;
}

export async function addAgentWizard() {
  intro('Add agent');

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

  let installationId = meta.installations[0].id;
  if (meta.installations.length === 1) {
    note(`${meta.installations[0].account} (${installationId})`, 'Installation');
  } else {
    installationId = keep(
      await select({
        message: 'Installation',
        options: meta.installations.map((i) => ({ value: i.id, label: `${i.account} (${i.id})` })),
      })
    );
  }

  const name = (keep(await text({ message: 'Agent name', placeholder: meta.slug, defaultValue: meta.slug })) || meta.slug).trim();
  const label = (keep(await text({ message: 'Label', placeholder: meta.name, defaultValue: meta.name })) || meta.name).trim();
  const systemPrompt = keep(await text({ message: 'System prompt (optional)', placeholder: 'You are ...' })).trim();

  const agent = {
    name,
    label,
    appId,
    installationId,
    botName: meta.slug,
    privateKeyPath,
    ...(systemPrompt ? { systemPrompt } : {}),
  };

  const check = spinner();
  check.start('Minting a test token');
  await generateGithubAppToken(agent);
  check.stop('Test token ok');

  const path = addAgent(agent);
  outro(`Wrote ${path}`);
}

export async function interactiveSelection(defaults = {}) {
  const availableProviders = detectAvailableProviders();

  if (availableProviders.length === 0) {
    throw new Error('No installed provider was detected. Install claude, codex, or antigravity before running the launcher.');
  }

  let providerChoice = defaults.provider;
  if (providerChoice && !availableProviders.some((provider) => provider.value === providerChoice)) {
    throw new Error(`The provider ${providerChoice} is not installed or not available in PATH.`);
  }
  if (!providerChoice) {
    providerChoice = keep(
      await select({
        message: 'Which provider do you want to use?',
        options: availableProviders.map((provider) => ({ value: provider.value, label: provider.label })),
      })
    );
  }

  const agents = readAgents();
  let agentChoice = defaults.agent;
  if (agentChoice && !agents.some((agent) => agent.name === agentChoice)) {
    throw new Error(`Agent not found: ${agentChoice}`);
  }
  if (!agentChoice) {
    agentChoice = keep(
      await select({
        message: 'Which agent do you want to launch?',
        options: agents.map((agent) => ({ value: agent.name, label: agent.label || agent.name })),
      })
    );
  }

  if (!keep(await confirm({ message: `Launch ${agentChoice} with ${providerChoice}?` }))) {
    cancel('Cancelled.');
    process.exit(0);
  }

  return { agentName: agentChoice, providerName: providerChoice };
}

export function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    command: args[0] && !args[0].startsWith('-') ? args[0] : undefined,
    help: false,
    list: false,
    agent: undefined,
    provider: undefined,
  };

  const value = (next) => (next && !next.startsWith('-') ? next : undefined);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--help' || arg === '-h') result.help = true;
    if (arg === '--list' || arg === '-l') result.list = true;
    if (arg === '--agent' || arg === '-a') {
      result.agent = value(next);
      i += 1;
    }
    if (arg === '--provider' || arg === '-p') {
      result.provider = value(next);
      i += 1;
    }
  }

  return result;
}

export function showIntro() {
  intro('Agent Forge');
}
