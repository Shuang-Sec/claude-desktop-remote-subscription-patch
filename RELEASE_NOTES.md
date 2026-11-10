# v0.1.0 — Claude Desktop Remote Subscription Patch

This is the first public release of the unofficial compatibility patch for
using a remote Claude Code subscription with a separate Claude Desktop copy on
Windows.

## Included

- Patch/build scripts for Claude Desktop 4.4212.0 (BYO official installation).
- SSH remote subscription auth branch with client-credential withholding.
- Model menu refresh from the remote Claude Code initialization catalog.
- Fable 5.2 1M menu metadata (verified with a new Desktop session; existing
  sessions may keep the old 200k context until recreated).
- Optional remote subscription usage panel.
- Unit tests and detailed Chinese documentation.

## Not included

- No `claude.exe`, `app.asar`, `ion-dist.asar`, extracted Anthropic source, or
  any other proprietary binary.
- No subscription sharing, token export, or prebuilt modified client.

## Requirements

- Windows 10/11 x64.
- Your own official Claude Desktop 4.4212.0 installation.
- A Linux server you control, with Claude Code logged into your own
  subscription.
- Node.js 20+ and OpenSSH.

## Quick start

```powershell
git clone https://github.com/Shuang-Sec/claude-desktop-remote-subscription-patch.git
cd claude-desktop-remote-subscription-patch
npm ci
Copy-Item config.example.json config.json
notepad config.json
pwsh scripts/install.ps1 -Check
pwsh scripts/install.ps1
pwsh scripts/start-trial.ps1
```

See [`README.md`](README.md) and [`docs/INSTALL.md`](docs/INSTALL.md) for the
full setup.

## Known issues

- Patch anchors are specific to Claude Desktop 4.4212.0. A newer official
  version will require re-adaptation.
- Existing sessions may not recalculate the context window after switching
  models; create a new session for Fable 5.2 1M.
- The official usage endpoint is internal and may change.
- This is an unofficial compatibility patch; use at your own risk and comply
  with Anthropic's terms.
