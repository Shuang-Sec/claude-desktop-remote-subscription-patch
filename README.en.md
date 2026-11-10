# Claude Desktop Remote Subscription Patch

**Language / 语言:** [简体中文](README.md) | [English](README.en.md)

> Run a separate copy of the official Claude Desktop on Windows while the
> Claude Code engine runs on a remote Linux VPS and uses the subscription that
> is already logged in there. The Windows host does not log in to Anthropic,
> does not need an official API key, and does not copy the remote subscription
> token.
>
> **Unofficial project.** This repository does not contain Anthropic's
> `claude.exe`, `app.asar`, `ion-dist.asar`, or extracted application source.
> You must obtain your own licensed copy of the official Claude Desktop. This
> project is not affiliated with Anthropic.

## Contents

- [The real pain point](#the-real-pain-point)
- [Why put the subscription on a remote VPS](#why-put-the-subscription-on-a-remote-vps)
- [What this project is](#what-this-project-is)
- [What it solves](#what-it-solves)
- [Security model](#security-model)
- [Account safety and compliance](#account-safety-and-compliance)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Remote server setup](#remote-server-setup)
- [How the build works](#how-the-build-works)
- [Model menu and Fable 5.2 1M](#model-menu-and-fable-52-1m)
- [Remote usage panel](#remote-usage-panel)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Rollback and uninstall](#rollback-and-uninstall)
- [Repository layout](#repository-layout)
- [Tests](#tests)
- [Security and privacy](#security-and-privacy)
- [License and disclaimer](#license-and-disclaimer)

## The real pain point

The official Claude Desktop SSH remote session still uses the Desktop's own
**client authentication / 3P provider configuration**. It is not a delegation
channel that hands an existing Claude Code subscription on another machine to
the Windows UI.

In the common combination of:

- a Windows machine without a stable official-login network,
- a remote VPS that already has a logged-in Claude Code subscription,
- and no local official login or API key,

the stock path does not work:

1. The official subscription route requires the local Desktop to complete an
   official login. If the Windows network cannot reach the login service, the
   authentication cannot complete.
2. The 3P route passes the local provider credentials to the remote session and
   rejects a localhost gateway. The remote `~/.claude` login is not
   automatically treated as the Desktop's authentication source.
3. An SSH entry may be visible, but that does not mean the remote subscription
   can be used; the session may still ask for local credentials or fail.
4. If a local third-party gateway is configured, its address/credentials and
   the remote subscription are two different things. Mixing them creates the
   false impression that "SSH is connected, therefore the remote subscription
   is being used".

This patch changes only the dedicated SSH-host branch: the Desktop hands that
host's session to the remote Claude Code engine, and the remote engine uses its
own login. The Windows side does not log in, does not hold the remote token,
and does not use the local gateway as the remote model source.

## Why put the subscription on a remote VPS

The point is not to bypass anything; it is to keep the authentication
environment stable:

| Dimension | Windows host | Remote VPS |
|---|---|---|
| Public IP | Home/campus/proxy egress; may change | Fixed public IP |
| Region/network | May not reach the official login reliably | Fixed region and stable egress |
| Uptime | Shutdown, sleep, network changes | 24/7 |
| Credential location | Would have to be on Windows if logged in locally | Stays on the server; renewal stays there |
| Daily operation | Log in from a changing environment | Windows only uses SSH |

A fixed public IP, fixed region, stable DNS/TLS egress, and 24/7 availability
can reduce extra verification and risk-control triggers caused by a frequently
changing environment. **Under compliant use, this can reduce abnormal triggers
caused by IP/region/device changes, and therefore reduce false-positive risk
controls or suspension risk. It cannot guarantee that an account will never be
suspended.** Account safety ultimately depends on complying with Anthropic's
terms and normal usage behavior. It must not be used for account sharing,
multi-account abuse, or region evasion.

For this project there is also a direct security benefit: the login/signature
state stays on the server, while the Windows copy only handles the UI and SSH.
No subscription token is copied to the Windows machine.

## What this project is

The official Claude Desktop's third-party (3P) mode normally forwards local
model credentials to the remote host and refuses a localhost gateway. This
project is a set of auditable patch scripts that:

1. copy the official Claude Desktop into a separate directory;
2. modify the copy so the configured SSH host:
   - skips the localhost-gateway precondition;
   - does not inject local Anthropic/gateway credentials into the remote;
   - lets the remote Claude Code use its own subscription login;
   - keeps the remote HOME and the server's own command environment;
3. updates ASAR/EXE integrity hashes without disabling Electron integrity
   checks;
4. generates the model menu from the remote engine's initialization catalog;
5. optionally adds a remote subscription usage panel.

It is not an Anthropic client, and it does not modify the original official
installation.

## What it solves

```text
Windows host (no local official subscription login)
  └─ separate official Claude Desktop copy
       └─ SSH
            └─ Linux VPS (Claude Code subscription already logged in)
                 └─ remote Claude Code engine uses that subscription/network
```

The Windows side only provides the UI and SSH transport. Model requests, file
operations, shell commands, and subscription authentication happen on the
server.

## Security model

- The remote subscription token is not copied to Windows.
- The Windows host does not log in to the Anthropic account.
- Local API keys, OAuth tokens, gateway addresses, and third-party provider
  markers are not sent to the remote.
- The copy's gateway points at an unused address (`http://127.0.0.1:1`) to
  demonstrate that remote sessions do not use the local gateway.
- The remote engine keeps using the server's existing `~/.claude` login and
  renewal mechanism.
- `config.json`, `trial/`, `profile/`, logs, and keys are ignored by git.

**Warning:** this is an unofficial compatibility patch. It may conflict with
Anthropic's terms. Use it only with your own account and server, at your own
risk.

## Account safety and compliance

- A fixed VPS environment only reduces abnormal triggers caused by changing
  IP/region/login environments. It cannot guarantee that an account will not be
  limited or suspended.
- Do not share subscriptions, perform login-for-hire, rotate multiple accounts,
  register in bulk, or use this project to evade region or payment
  requirements.
- Account safety depends on complying with Anthropic's terms, normal usage
  behavior, and the account's own reputation. This patch only changes the
  client authentication path; it does not change account rules.
- If Anthropic explicitly prohibits this remote-subscription usage, stop using
  the project.

## Prerequisites

### Windows

- Windows 10/11 x64.
- Official Claude Desktop **4.4212.0**. The patch anchors target this version;
  other versions require re-adaptation.
- Node.js 20+ and npm.
- OpenSSH client.

### Remote Linux server

- SSH access.
- Claude Code installed and logged in with a valid subscription.
- The Desktop companion engine cache is present, usually under
  `~/.claude/remote/ccd-cli/*`. It is normally downloaded on the first Desktop
  SSH connection.
- Prefer a non-root user and keep the normal HOME.

### Network

- Windows can SSH to the server.
- The server can reach Anthropic API and Claude Code update domains.
- The Windows host does not need direct access to the official API.

## Quick start

### 1. Clone and install dependencies

```powershell
git clone https://github.com/Shuang-Sec/claude-desktop-remote-subscription-patch.git
cd claude-desktop-remote-subscription-patch
npm ci
```

### 2. Prepare configuration

```powershell
Copy-Item config.example.json config.json
notepad config.json
```

Fill in at least:

- `officialApp`: the official `app` directory;
- `officialProfile`: the official 3P profile (usually
  `%LOCALAPPDATA%\Claude-3p`);
- `ssh.user`, `ssh.host`, `ssh.identityFile`;
- `ssh.remoteCwd`, `ssh.testCwd`.

`config.json` is gitignored and must not be committed.

### 3. Check the environment

```powershell
pwsh scripts/install.ps1 -Check
```

### 4. Connect to the remote once

Complete one SSH connection with the stock Desktop or the copy first, so the
Desktop downloads the Linux companion engine into
`~/.claude/remote/ccd-cli/`.

### 5. Build the copy

```powershell
pwsh scripts/install.ps1
```

This runs `prepare.mjs` and `build.mjs`: copy the official app/profile, apply
the patches, generate the menu, repack ASAR, and update the EXE integrity hash.

### 6. Start

```powershell
pwsh scripts/start-trial.ps1
```

Create a Code session, select the configured SSH host, choose the remote
folder, and send a short message.

### 7. Refresh models

```powershell
pwsh scripts/refresh-remote-models.ps1
pwsh scripts/stop-trial.ps1
pwsh scripts/start-trial.ps1
```

Create a new session after refreshing. Existing sessions may keep their old
context limit.

## Configuration

See [`config.example.json`](config.example.json). Main fields:

| Field | Required | Description |
|---|---|---|
| `officialApp` | yes | Official Desktop `app` directory |
| `officialProfile` | yes | Official 3P profile directory |
| `trialRoot` | yes | Output directory for the independent copy |
| `version` | no | Official version, default `4.4212.0` |
| `modelCatalogFile` | no | Remote model catalog, default `./trial/remote-models.json` |
| `providerConfigFile` | no | Explicit `configLibrary` provider JSON |
| `ssh.alias` | no | Display alias |
| `ssh.user` | yes | SSH user |
| `ssh.host` | yes | Server hostname/IP |
| `ssh.port` | no | SSH port, default 22 |
| `ssh.identityFile` | yes | Windows private key path |
| `ssh.remoteCwd` | yes | Initial remote folder |
| `ssh.testCwd` | no | Remote working directory for model initialization |
| `ssh.desktopCli` | no | Explicit `~/.claude/remote/ccd-cli/*` path |
| `nodePath` | no | Custom Node executable |
| `usagePanel` | no | Enable the remote usage panel, default true |

Use placeholders such as `YOUR_SERVER_HOST`, `<user>`, and `/home/<user>/project`.
Do not commit real values.

## Remote server setup

```bash
claude --version
claude   # complete the official subscription login
ls ~/.claude/remote/ccd-cli/
```

Create an SSH key and test it from Windows:

```powershell
ssh -i C:\Users\<you>\.ssh\id_ed25519 <user>@<host>
```

Create a dedicated test directory for model initialization and keep it separate
from production projects.

## How the build works

```text
official app.asar
  -> extract to trial/source
  -> force data directory to trial/profile
  -> bypass the localhost precondition for the configured host
  -> filter local credentials from the remote environment
  -> inject the host-aware policy module
  -> optionally inject the usage route
  -> repack app.asar
  -> update the ASAR integrity hash in claude.exe

official ion-dist.asar
  -> optionally inject the usage UI
  -> update its integrity hash in claude.exe
```

Electron integrity validation remains enabled. The build aborts if an anchor or
hash position is not unique.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.

## Model menu and Fable 5.2 1M

The menu is generated from the remote initialization response of:

- `claude-vscode` (the server's `claude` CLI);
- `claude-desktop` (the Desktop companion engine).

`refresh-remote-models.ps1` sends only initialize control requests. It does not
send prompts, read the subscription token, or copy credentials.

For `claude-fable-5-2`, the menu includes:

```json
{"supports1m": true, "prefer1m": true}
```

Verified on 2026-11-10: a new Desktop session with Fable 5.2 shows 1M context.
Existing sessions may keep the old 200k context because the context window is
fixed when the session/engine starts. Create a new session or reload the remote
engine.

See [`docs/MODEL-MENU.md`](docs/MODEL-MENU.md).

## Remote usage panel

The optional panel shows:

- 5-hour and weekly utilization/reset times;
- Pro/Max/Team/Enterprise label when returned;
- extra-usage enabled flag;
- a refresh button and a five-minute auto-refresh while open.

The query runs over SSH on the server, reads the server's
`~/.claude/.credentials.json`, and returns only whitelisted usage fields. No
token is sent to Windows. The endpoint is internal and may change.

See [`docs/USAGE-PANEL.md`](docs/USAGE-PANEL.md).

## Troubleshooting

### The copy does not start or reports an integrity error

- Run the build to completion; do not manually edit `app.asar` or `claude.exe`.
- Do not disable integrity checks.
- A different official version needs new anchors.

### `Can't reach 127.0.0.1:1`

Expected. The copy's local gateway is intentionally dead; choose the remote
environment.

### `setgroups` / nested sandbox error

The patch removes the gateway-only sandbox policy for the configured SSH host.
Check that the correct host is selected and that the server's normal Claude Code
environment works. Do not change the server kernel just to satisfy the client.

### Model menu is stale

Refresh, close the copy, restart, and create a new session.

### Fable 5.2 shows 200k

Create a new session first. If it is still 200k, the remote engine/account has
not enabled 1M for that model; local menu changes cannot override it.

### Usage panel has no data

Check the server's Claude Code login, network, and error reason. Never copy the
token to Windows for debugging.

More in [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).

## Known limitations

- Targets Claude Desktop 4.4212.0 only; newer versions need re-adaptation.
- Windows + Linux remote only; macOS/Linux desktop is not supported.
- Unofficial; may conflict with Anthropic's terms.
- No exe/asar/official source is distributed; bring your own installation.
- The official usage endpoint is internal and may change.
- Existing sessions may not recalculate context after a model switch; create a
  new session for Fable 5.2 1M.
- No subscription sharing or credential forwarding.

## Rollback and uninstall

Restore the previous model menu:

```powershell
pwsh scripts/restore-model-menu.ps1 -Preview
pwsh scripts/restore-model-menu.ps1
```

Remove the copy:

```powershell
pwsh scripts/stop-trial.ps1
Remove-Item -Recurse -Force .\trial
```

The original official app, profile, CC Switch, VS Code, and server are not
modified.

## Repository layout

```text
scripts/          build, install, refresh, start, stop, restore
scripts/lib/      configuration loader
docs/             installation, configuration, architecture, security,
                  model menu, usage panel, troubleshooting, FAQ, legal
examples/         placeholder-only configuration examples
tests/unit/       tests that do not require the proprietary app
tests/integration/ tests that require your own app/config
```

## Tests

```powershell
npm test
npm run check
```

PowerShell syntax check:

```powershell
Get-ChildItem scripts\*.ps1 | ForEach-Object {
  [void][ScriptBlock]::Create((Get-Content -Raw $_.FullName))
}
```

Unit tests do not use the proprietary app or the network. Integration build
requires your own official installation and `config.json`.

## Security and privacy

- The repository contains no real server IP, SSH user/alias/key, account UUID,
  session ID, paper/project data, cookie, token, or sealed key.
- `.gitignore` excludes `config.json`, `trial/`, `profile/`, `app/`, logs,
  images, asar, and exe.
- Commit identity uses a GitHub noreply address, not a personal email.
- If you paste logs in an issue or PR, remove server addresses, usernames,
  session IDs, and credentials first.

Report security issues through GitHub Security Advisories. See
[`SECURITY.md`](SECURITY.md).

## License and disclaimer

Original project code is MIT licensed. Anthropic's application, names, and
marks are not part of this project. See [`LICENSE`](LICENSE), [`NOTICE`](NOTICE),
and [`docs/LEGAL.md`](docs/LEGAL.md).

The software is provided "as is", without warranty. You are responsible for
ensuring that you have the right to use your official Claude Desktop and
remote Claude Code subscription, and for complying with Anthropic's terms.
