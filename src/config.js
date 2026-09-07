import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { note } from '@clack/prompts';

const REQUIRED_FIELDS = ['name', 'appId', 'installationId', 'privateKeyPath'];
const SCHEMA_URL = 'https://raw.githubusercontent.com/AshuLab/agent-forge/main/schema/agents.schema.json';

const CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
export const GLOBAL_CONFIG = join(CONFIG_HOME, 'agent-forge', 'agents.json');
const CWD_CONFIG = resolve(process.cwd(), 'agents.json');

// "Which repo" is the cwd; "which identity" is the machine-global registry.
// Resolution order, first match wins:
//   1. $AGENT_FORGE_CONFIG      explicit override
//   2. ~/.config/agent-forge/agents.json   the global registry
//   3. ./agents.json              only if it already exists (running from a clone)
export function resolveConfigPath() {
  if (process.env.AGENT_FORGE_CONFIG) return resolve(process.env.AGENT_FORGE_CONFIG);
  if (existsSync(GLOBAL_CONFIG)) return GLOBAL_CONFIG;
  if (existsSync(CWD_CONFIG)) return CWD_CONFIG;
  return GLOBAL_CONFIG;
}

export function mergeAgent(config, agent) {
  const agents = Array.isArray(config?.agents) ? config.agents : [];
  if (agents.some((item) => item.name === agent.name)) {
    throw new Error(`Agent "${agent.name}" already exists`);
  }
  return { ...config, agents: [...agents, agent] };
}

export function addAgent(agent) {
  const path = resolveConfigPath();

  let current;
  if (existsSync(path)) {
    try {
      current = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      throw new Error(`${path} is not valid JSON: ${error.message}`);
    }
  } else {
    current = { $schema: SCHEMA_URL, agents: [] };
  }

  const next = mergeAgent(current, agent);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return path;
}

function validateAgents(agents) {
  const seen = new Set();
  agents.forEach((agent, index) => {
    const ref = agent.name || `#${index + 1}`;
    for (const field of REQUIRED_FIELDS) {
      if (!agent[field]) {
        throw new Error(`agents.json: agent ${ref} is missing "${field}"`);
      }
    }
    if (seen.has(agent.name)) {
      throw new Error(`agents.json: duplicate agent name "${agent.name}"`);
    }
    seen.add(agent.name);
  });
}

// Returns [] when no config exists yet or it holds no agents. Still throws on
// invalid JSON or malformed agents — "empty" and "broken" are different.
export function readAgentsOrEmpty() {
  const path = resolveConfigPath();
  if (!existsSync(path)) return [];

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`agents.json is not valid JSON: ${error.message}`);
  }

  if (!Array.isArray(parsed.agents) || parsed.agents.length === 0) return [];

  validateAgents(parsed.agents);
  return parsed.agents;
}

export function readAgents() {
  const agents = readAgentsOrEmpty();
  if (agents.length === 0) {
    if (!existsSync(resolveConfigPath())) {
      throw new Error(
        `No agents.json found. Run "agent-forge add" to create one at ${GLOBAL_CONFIG}, ` +
          'or point AGENT_FORGE_CONFIG at an existing file.'
      );
    }
    throw new Error('agents.json: no agents defined');
  }
  return agents;
}

export function listAgents() {
  const agents = readAgents();
  const rows = agents.map((agent) =>
    agent.label && agent.label !== agent.name ? `${agent.name}  —  ${agent.label}` : agent.name
  );
  note(rows.join('\n'), `${agents.length} agent${agents.length === 1 ? '' : 's'}`);
}
