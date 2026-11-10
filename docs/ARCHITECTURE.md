# Architecture

## Why a remote VPS

The stock Desktop SSH path is tied to the Desktop's own client authentication /
3P provider configuration. It is not a delegation channel for a subscription
that already exists on another machine. This becomes a practical blocker when
the Windows host cannot complete an official login (network/region) but the VPS
already has a working Claude Code subscription.

Putting the subscription login on a VPS also makes the authentication
environment more stable: fixed public IP, fixed region, stable DNS/TLS egress,
and 24/7 availability. That reduces environment-change triggers, but it does
not guarantee account safety; users must comply with Anthropic's terms and must
not use the project for account sharing or region evasion.

## Components

```text
Windows host
┌──────────────────────────────────────────────┐
│ Claude Desktop copy (trial/app)              │
│  - patched app.asar                          │
│  - patched ion-dist.asar (usage panel)       │
│  - profile/ (isolated user data)             │
│  - dead local gateway 127.0.0.1:1            │
└──────────────────┬───────────────────────────┘
                   │ SSH (stdio bridge)
                   ▼
Linux server
┌──────────────────────────────────────────────┐
│ Claude Code / Desktop companion engine       │
│  - uses ~/.claude login (own subscription)   │
│  - file and shell operations on server       │
│  - server HOME and command environment       │
└──────────────────────────────────────────────┘
```

## Data flow

1. Desktop starts the patched app from `trial/app/claude.exe`.
2. The app resolves its user data to `trial/profile` (patched `i0()`).
3. When creating an SSH session, the app checks the target host. For the
   configured host, the localhost-gateway precondition is skipped.
4. The remote spawn path filters `ANTHROPIC_*`, OAuth/token, proxy, HOME, and
   host-managed credential variables; it sets `CLAUDE_CODE_ENTRYPOINT` to
   `claude-desktop`.
5. Desktop connects over SSH and starts the remote companion engine with the
   server's own HOME and login state.
6. The remote engine authenticates with the server-side Claude Code
   subscription and performs model requests, file edits, and commands.
7. The Desktop model menu is generated from the remote initialization catalog
   (`inferenceModels`) rather than from the local official catalog, because 3P
   mode intentionally does not use the official model catalog.
8. Optional usage panel: the app asks its local HTTP handler
   `/api/oracle-trial/usage`; the handler reads the selected session's SSH
   target and runs a read-only Python query over SSH. Only whitelisted usage
   fields are returned.

## What the patch changes

| Area | Change |
|---|---|
| Data directory | Forces the copy to use `trial/profile` |
| SSH precondition | Skips the local gateway check only for the configured host |
| Credential environment | Removes local model/auth/provider/proxy variables for that host |
| Auth ownership | Prevents the client from injecting/refreshing local credentials into the remote session |
| Managed settings | Removes gateway-only sandbox/model allow-list for that host; server settings decide |
| Model menu | Writes `inferenceModels` from the remote initialization catalog |
| Usage panel | Adds a read-only remote usage route and UI component |

## What the patch does not do

- It does not modify the original official installation.
- It does not copy or store the remote subscription token on Windows.
- It does not create a public gateway or open a port.
- It does not change the server kernel, Claude Code binary, or global auth.
- It does not disable Electron ASAR integrity validation.
- It does not support arbitrary newer Desktop versions without new anchors.

## Integrity model

`app.asar` and `ion-dist.asar` contain integrity metadata. After repacking,
`build.mjs` writes the new header hashes into the copy's `claude.exe` at the
single matching positions. If a hash is not unique or a file changed
unexpectedly, the build aborts. This keeps Electron's integrity checks enabled.

## Host matching

The SSH host is not hardcoded in the repository. `config.json` supplies it:

- `build.mjs` injects the host into the spawn-check anchor and into
  `oracle-policy.cjs`;
- `oracle-usage.cjs` receives the host list at build time;
- the resulting app copy contains only the user's configured host string.

## Trust boundaries

- The Windows host is trusted for the UI and SSH key.
- The Linux server is trusted for the subscription and project files.
- The repository is untrusted input after cloning: review `build.mjs` before
  running it against your official app.
- The remote usage panel treats server output as untrusted and whitelists fields.
