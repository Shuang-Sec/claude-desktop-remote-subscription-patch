# FAQ

## Is this an official Anthropic project?

No. It is an unofficial compatibility patch. It is not affiliated with,
endorsed by, or supported by Anthropic.

## Does it include Claude Desktop or a modified exe?

No. The repository contains only our own scripts and documentation. It does not
contain `claude.exe`, `app.asar`, `ion-dist.asar`, extracted app code, or a
prebuilt modified client. You must use your own official installation.

## Does it copy my subscription token to Windows?

No. The remote Claude Code process keeps and uses its own login. The Windows
copy deliberately points its local gateway at an unused address.

## Can I use someone else's subscription?

No. Use only your own account/server and comply with Anthropic's terms. The
project is not a credential-sharing tool.

## Why 3P mode?

The desktop's third-party mode is the supported way to use a separate model
provider. The patch adjusts its SSH path so the remote host's own Claude Code
login is used instead of forwarding the local gateway credentials.

## Why does the model menu need refreshing?

The 3P menu is an administrator list (`inferenceModels`), not the official
catalog. It is generated from the remote engine's initialization response. A
new remote model requires a refresh and a restart.

## Why does Fable 5.2 show 200k in an old session?

The context window is established when a session/engine starts. Switching the
model in an existing session may keep the old window. Create a new session
after the menu refresh/restart. New sessions have been verified to show 1M.

## Does it work with a newer Claude Desktop?

Not by default. The patch anchors target 4.4212.0. A newer app requires a new
adaptation, fresh anchors, and full verification. Do not reuse the old build on
a new version.

## Can I use macOS/Linux desktop?

The scripts target Windows paths and Electron ASAR/hash handling. Porting is
possible but not supported in 0.1.0.

## Is the usage panel official?

It calls an official internal endpoint from the server, but the endpoint is not
a stable public API. It may change or stop working.

## Where are logs?

`trial/profile/Logs/main.log` and related logs. Do not paste them publicly
without removing server addresses, usernames, session IDs, and tokens.

## How do I uninstall?

```powershell
pwsh scripts/stop-trial.ps1
Remove-Item -Recurse -Force .\trial
```

The original official app and profile are untouched.
