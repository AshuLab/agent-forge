import { execFileSync } from 'node:child_process';
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

// Fallback when the repo you launch in doesn't pin an installation: take the
// sole one, or fail if the App spans several (launch from a covered repo then).
export function pickInstallation(installations, agent) {
  if (installations.length === 0) {
    throw new Error(`GitHub App ${agent.appId} has no installations. Install it on an account or org first.`);
  }

  if (installations.length === 1) return installations[0].id;

  throw new Error(
    `GitHub App ${agent.appId} is installed on ${installations.length} accounts ` +
      `(${installations.map((item) => item.account).join(', ')}). ` +
      `Launch from inside a repo under one of them.`
  );
}

// owner/repo from a github.com remote URL (ssh, https, git://). null otherwise.
export function parseGithubRemote(url) {
  const match = String(url)
    .trim()
    .match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

export function currentRepoSlug() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    return parseGithubRemote(url);
  } catch {
    return null;
  }
}

async function installationForRepo(slug, jwtToken) {
  try {
    const data = await githubApi(`/repos/${slug.owner}/${slug.repo}/installation`, { jwtToken });
    return { id: String(data.id), account: data.account?.login || data.account?.slug || null };
  } catch {
    return null; // App has no installation reaching this repo
  }
}

// Returns { id, account }. Resolution order: explicit installationId (account
// unknown), then the current repo's owner, then the App's sole installation
// (see pickInstallation).
async function resolveInstallation(agent, jwtToken) {
  if (agent.installationId) return { id: String(agent.installationId), account: null };

  const slug = currentRepoSlug();
  if (slug) {
    const hit = await installationForRepo(slug, jwtToken);
    if (hit) return hit;
  }

  const installations = await listInstallations(jwtToken);
  const id = pickInstallation(installations, agent);
  return { id, account: installations.find((item) => item.id === id)?.account ?? null };
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
  const { id: installationId, account } = await resolveInstallation(agent, jwtToken);

  const data = await githubApi(`/app/installations/${installationId}/access_tokens`, {
    jwtToken,
    body: buildTokenScope(agent),
  });

  return {
    token: data.token,
    account,
    expiresAt: data.expires_at || null,
    // What GitHub actually granted, after both the App's config and our scoping.
    permissions: data.permissions || {},
    repositorySelection: data.repository_selection || 'all',
  };
}
