# Creating the GitHub App

`agent-forge` runs each agent under a **GitHub App installation**. That gives you:

- a distinct bot identity — commits and comments show up as `your-app[bot]`, not as you
- short-lived tokens (~1 hour), minted per run, never stored
- per-repo, least-privilege scoping

You create the App once. After that, `agent-forge add` wires it in.

> **Can an agent do this for me?** Not the creation itself — GitHub has no REST endpoint to create an App from a normal token; it needs the web UI (or the [manifest flow](#appendix-manifest-flow)). An agent *can* fill in `agents.json`, run the wizard, mint a test token, and read API errors back to you. See [Notes for an assisting agent](#notes-for-an-assisting-agent).

## 1. Open the "new App" form

- Personal: <https://github.com/settings/apps/new>
- Organization: `https://github.com/organizations/<ORG>/settings/apps/new`

## 2. Fill in the form

| Field | What to put |
| --- | --- |
| **GitHub App name** | Anything unique. The slug becomes `botName`, and the commit identity is `<slug>[bot]`. |
| **Homepage URL** | Required. Your repo URL is fine. |
| **Webhook → Active** | **Uncheck it.** The launcher doesn't use webhooks. |
| **Where can this app be installed?** | "Only on this account" for a single account. See below if you need more than one. |

### One App on more than one account

A **private** App only installs on the account that owns it — one user *or* one org. To run the same agent on your personal repos **and** an org, you need one of:

- **Make the App public** ("Any account"). The private key never leaves you, so nobody else can mint tokens or reach your repos with it — "public" only means the App gets a listing page and others could install it on *their* own repos.
- **A separate App per account** (two App IDs, two keys, two `agents.json` entries). The bot identity differs per account, since App slugs are globally unique.

`agent-forge` then picks the right installation automatically from the repo you launch in — see the Configuration section of the README.

## 3. Set permissions

Under **Repository permissions**, grant the minimum for a coding agent:

| Permission | Level | Why |
| --- | --- | --- |
| Contents | Read and write | commit, push, branches |
| Pull requests | Read and write | open / update PRs, review comments |
| Issues | Read and write | comment on issues and PRs |
| Metadata | Read-only | mandatory, auto-selected |

Add only if the agent needs it:

- **Workflows** (Read and write) — to push files under `.github/workflows/`
- **Checks** / **Commit statuses** — if the agent reports build status

You can widen permissions later; each installation must then re-approve.

## 4. Create it, then collect three things

Click **Create GitHub App**. From the App's settings page:

1. **App ID** — shown near the top (`App ID: 123456`). This is `appId`.
2. **Private key** — scroll to *Private keys* → **Generate a private key**. A `.pem` downloads. Move it somewhere safe and lock it down:

   ```bash
   mv ~/Downloads/your-app.*.private-key.pem ~/.ssh/your-app.pem
   chmod 600 ~/.ssh/your-app.pem
   ```

   This path is `privateKeyPath`. Never commit it (`*.pem` is git-ignored here).
3. **Installation** — go to the *Install App* tab → **Install** → pick the account/org → choose **All repositories** or a specific set. You don't need to record the installation id — `agent-forge` resolves it on each run from the repo you're in (or the App's sole installation).

## 5. Wire it into agent-forge

```bash
agent-forge add
```

Give it the **App ID** and the **private key path**. The wizard calls the GitHub API to fill in the rest — slug (`botName`), bot user id (`botId`) — mints a test token, and writes the entry to your registry.

Manual equivalent in `agents.json`:

| Field | Value |
| --- | --- |
| `appId` | from step 4.1 |
| `privateKeyPath` | from step 4.2 |
| `botName` | the App slug (lowercase name, dashes for spaces) |
| `botId` | optional — resolved from `botName` via the API when omitted |

## 6. Verify

```bash
agent-forge token --agent <name> >/tmp/tok
curl -s -H "Authorization: token $(cat /tmp/tok)" \
  https://api.github.com/installation/repositories | head
```

A JSON list of repos means the App, key, and installation all line up.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `This App has no installations` | You created it but never hit *Install*. Do step 4.3. |
| The org isn't offered on the *Install* screen | The App is private (owner account only). Make it public, or transfer it to the org — General → Danger Zone. |
| `is installed on N accounts …` | You ran outside a repo the App covers. Launch from inside a repo under one of those accounts. |
| `Private key ... not found or unreadable` | Wrong `privateKeyPath`, or the file isn't readable. |
| `error:1E08010C` / `PEM routines` | The `.pem` is corrupted or not the App key. Regenerate it. |
| `401 … the App JWT was rejected` | `appId` doesn't match `privateKeyPath` (the key belongs to a different App), or the system clock is off. |
| `Resource not accessible by integration` | Missing a permission from step 3. Add it, then re-approve the installation. |
| `404` resolving the bot id | The App slug in `botName` is wrong, or the App is brand new — retry, or set `botId` manually from `https://api.github.com/users/<slug>%5Bbot%5D`. |

## Notes for an assisting agent

You cannot create the App, but you can:

- draft the `agents.json` entry and run `agent-forge add`
- run `agent-forge token --agent <name>` and the `curl` check above
- read GitHub API error bodies and map them to the table above (e.g. a `403` `Resource not accessible by integration` names the missing permission)
- confirm the key file exists and is `chmod 600`

Hand the human the exact URL for step 1 and the permission list for step 3.

## Appendix: manifest flow

GitHub can pre-fill the creation form from a JSON manifest, so the human only clicks "Create". This is not automated by `agent-forge` yet (you exchange the returned `code` manually), but the manifest saves the form-filling:

```json
{
  "name": "your-app",
  "url": "https://github.com/AshuLab/agent-forge",
  "hook_attributes": { "active": false },
  "public": false,
  "default_permissions": {
    "contents": "write",
    "pull_requests": "write",
    "issues": "write",
    "metadata": "read"
  }
}
```

POST it as a `manifest` form field to `https://github.com/settings/apps/new?state=<random>` (or the org equivalent), let the human click **Create**, then exchange the `code` GitHub redirects with: `POST https://api.github.com/app-manifests/{code}/conversions` → returns `id`, `pem`, and secrets in one response.
