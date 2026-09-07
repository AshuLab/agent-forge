import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';

export function expandHome(path) {
  if (!path) return path;
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

function readPrivateKey(privateKeyPath, ref) {
  const path = expandHome(privateKeyPath);
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Private key for "${ref}" not found or unreadable: ${path}`);
  }
}

function signAppJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iat: now - 60, exp: now + 600, iss: String(appId) }, privateKey, {
    algorithm: 'RS256',
  });
}

async function githubApi(path, { jwtToken, body } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'agent-forge',
      ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`GitHub API ${path}: ${response.status} ${data?.message || 'Unknown error'}`);
  }
  return data;
}

export async function resolveBotId(agent) {
  if (agent.botId) return String(agent.botId);

  const handle = `${agent.botName || agent.name}[bot]`;
  const data = await githubApi(`/users/${encodeURIComponent(handle)}`);
  if (!data?.id) {
    throw new Error(`Could not resolve bot id for ${handle}: no id in response`);
  }
  return String(data.id);
}

async function listInstallations(jwtToken) {
  const items = await githubApi('/app/installations', { jwtToken });
  return items.map((item) => ({
    id: String(item.id),
    account: item.account?.login || item.account?.slug || 'unknown',
  }));
}

// Given only App ID + key, derive slug, display name and the installations to pick from.
export async function fetchAppMetadata(appId, privateKeyPath) {
  const privateKey = readPrivateKey(privateKeyPath, `app ${appId}`);
  const jwtToken = signAppJwt(appId, privateKey);

  const app = await githubApi('/app', { jwtToken });

  return {
    slug: app.slug,
    name: app.name || app.slug,
    installations: await listInstallations(jwtToken),
  };
}

// Choose which installation to mint a token for. An explicit installationId wins;
// otherwise match agent.account, or take the only installation when there is one.
export function pickInstallation(installations, agent) {
  if (installations.length === 0) {
    throw new Error(`GitHub App ${agent.appId} has no installations. Install it on an account or org first.`);
  }

  if (agent.account) {
    const want = String(agent.account).toLowerCase();
    const match = installations.find((item) => item.account.toLowerCase() === want);
    if (!match) {
      throw new Error(
        `GitHub App ${agent.appId} is not installed on "${agent.account}". ` +
          `Installed on: ${installations.map((item) => item.account).join(', ')}.`
      );
    }
    return match.id;
  }

  if (installations.length === 1) return installations[0].id;

  throw new Error(
    `GitHub App ${agent.appId} is installed on ${installations.length} accounts ` +
      `(${installations.map((item) => item.account).join(', ')}). ` +
      `Add "account" to agent "${agent.name}" to pick one.`
  );
}

async function resolveInstallationId(agent, jwtToken) {
  // ponytail: an extra /app/installations GET per mint. Set `installationId` on the
  // agent to skip it — worth doing when `token` runs in a git credential helper.
  if (agent.installationId) return String(agent.installationId);
  return pickInstallation(await listInstallations(jwtToken), agent);
}

// Optional least-privilege scoping from agents.json. `permissions` is a COMPLETE
// allowlist: GitHub drops anything not listed, regardless of what the App grants.
export function buildTokenScope(agent) {
  const scope = {};
  if (Array.isArray(agent.repositories)) scope.repositories = agent.repositories;
  if (agent.permissions && typeof agent.permissions === 'object') scope.permissions = agent.permissions;
  return scope;
}

export async function generateGithubAppToken(agent) {
  const privateKey = readPrivateKey(agent.privateKeyPath, agent.name || agent.appId);
  const jwtToken = signAppJwt(agent.appId, privateKey);
  const installationId = await resolveInstallationId(agent, jwtToken);

  const data = await githubApi(`/app/installations/${installationId}/access_tokens`, {
    jwtToken,
    body: buildTokenScope(agent),
  });

  return {
    token: data.token,
    // What GitHub actually granted, after both the App's config and our scoping.
    permissions: data.permissions || {},
    repositorySelection: data.repository_selection || 'all',
  };
}
