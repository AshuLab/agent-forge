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

// Given only App ID + key, derive slug, display name and the installations to pick from.
export async function fetchAppMetadata(appId, privateKeyPath) {
  const privateKey = readPrivateKey(privateKeyPath, `app ${appId}`);
  const jwtToken = signAppJwt(appId, privateKey);

  const app = await githubApi('/app', { jwtToken });
  const installations = await githubApi('/app/installations', { jwtToken });

  return {
    slug: app.slug,
    name: app.name || app.slug,
    installations: installations.map((item) => ({
      id: String(item.id),
      account: item.account?.login || item.account?.slug || 'unknown',
    })),
  };
}

export async function generateGithubAppToken(agent) {
  const privateKey = readPrivateKey(agent.privateKeyPath, agent.name || agent.appId);
  const jwtToken = signAppJwt(agent.appId, privateKey);

  // Optional least-privilege scoping from agents.json.
  const scope = {};
  if (Array.isArray(agent.repositories)) scope.repositories = agent.repositories;
  if (agent.permissions && typeof agent.permissions === 'object') scope.permissions = agent.permissions;

  const data = await githubApi(`/app/installations/${agent.installationId}/access_tokens`, {
    jwtToken,
    body: Object.keys(scope).length > 0 ? scope : {},
  });

  return data.token;
}
