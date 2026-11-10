# Installation

## 1. Windows prerequisites

- Windows 10/11 x64
- Official **Claude Desktop 4.4212.0** installed and run at least once
- Node.js 20+ (`node --version`)
- npm
- OpenSSH client (`ssh -V`)

The official app must be the matching version. The patch anchors are
version-specific. If you only have a newer official app, do not force the
build; the anchors will fail or produce an inconsistent copy.

## 2. Server prerequisites

On the Linux server:

```bash
claude --version
claude   # complete the official subscription login if needed
ls ~/.claude/remote/ccd-cli/
```

The `ccd-cli` directory is populated when Desktop first connects to the
server. Connect once with the stock Desktop or the prepared copy before running
the model refresh.

Create an SSH key and add its public key to the server. Test:

```powershell
ssh -i C:\Users\<you>\.ssh\id_ed25519 <user>@<host>
```

## 3. Clone and install

```powershell
git clone https://github.com/Shuang-Sec/claude-desktop-remote-subscription-patch.git
cd claude-desktop-remote-subscription-patch
npm ci
```

## 4. Configure

```powershell
Copy-Item config.example.json config.json
notepad config.json
```

Fill in:

- `officialApp` — the official `app` directory, not the shortcut;
- `officialProfile` — the official 3P profile (usually
  `%LOCALAPPDATA%\Claude-3p`);
- SSH user/host/key and remote directories;
- keep `trialRoot` outside the official installation.

Example:

```json
{
  "officialApp": "C:/Program Files/WindowsApps/AnthropicPBC.Claude_4.4212.0.0_x64__<publisher>/app",
  "officialProfile": "C:/Users/<you>/AppData/Local/Claude-3p",
  "trialRoot": "./trial",
  "version": "4.4212.0",
  "modelCatalogFile": "./trial/remote-models.json",
  "ssh": {
    "alias": "claude-remote",
    "user": "deploy",
    "host": "YOUR_SERVER_HOST",
    "port": 22,
    "identityFile": "C:/Users/<you>/.ssh/id_ed25519",
    "remoteCwd": "/home/deploy/project",
    "testCwd": "/home/deploy/claude-remote-test"
  },
  "usagePanel": true
}
```

## 5. Check

```powershell
pwsh scripts/install.ps1 -Check
```

It checks the official app, official profile, SSH key, Node, and npm. It does
not write anything.

## 6. Build

Close any running copy, then:

```powershell
pwsh scripts/install.ps1
```

This runs `prepare.mjs` then `build.mjs`.

If the target `trial/` already exists from a previous run, back it up or delete
it first; `prepare.mjs` refuses to overwrite an existing copy.

## 7. First run

```powershell
pwsh scripts/start-trial.ps1
```

In the copy:

1. Choose **Code**.
2. Create a session and choose the configured SSH host.
3. Select the remote folder.
4. Choose a model and send a short test message.

The `Can't reach 127.0.0.1:1` warning is expected: the copy deliberately points
its local gateway at an unused port.

## 8. Model menu

```powershell
pwsh scripts/refresh-remote-models.ps1
pwsh scripts/stop-trial.ps1
pwsh scripts/start-trial.ps1
```

Then create a new session. Existing sessions may keep the old context limit.

## 9. Usage panel

The panel is enabled by default (`usagePanel: true`). It requires the server's
Claude Code login file (`~/.claude/.credentials.json`) and network access from
the server to the official usage endpoint. No token is copied to Windows.

## 10. Verify and rollback

- Build logs: `trial/patch-manifest.json`
- Model catalog: `trial/remote-models.json` and `.previous`
- Config backup: `trial/backup/configLibrary-before.json`
- Rollback: `pwsh scripts/restore-model-menu.ps1`
- Uninstall: `pwsh scripts/stop-trial.ps1; Remove-Item -Recurse -Force .\trial`

The original official installation and profile are not touched.
