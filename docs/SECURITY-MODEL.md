# Security Model

## Assets

- Windows machine and SSH private key;
- remote Linux server and its Claude Code subscription login;
- project files on the server;
- local Desktop profile (sessions, cookies, config, sealed key).

## Goals

1. The Windows host does not need to log in to Anthropic.
2. The remote subscription token never moves to Windows.
3. The remote engine authenticates with the server's own login.
4. The local gateway API key and proxy settings are not sent to the remote.
5. The original official installation remains untouched.
6. No credentials are stored in the repository.

## Controls

- `cleanEnv()` removes `ANTHROPIC_*`, `CLAUDE_CODE_OAUTH_*`,
  `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST`, host-auth variables, proxy variables,
  and local HOME.
- `credentialWithheld` is set for the configured SSH target so the client does
  not inject local auth on refreshes.
- The local gateway points at `http://127.0.0.1:1`; it is not a working model
  route.
- `hostSettings()` removes the gateway-only sandbox and model allow-list for the
  configured host; the server's own settings apply.
- The remote engine keeps the server HOME and reads
  `~/.claude/.credentials.json` itself.
- The usage query returns only whitelisted fields; tokens and raw responses are
  not returned.

## Non-goals / residual risks

- This is not a sandbox. The remote engine can run commands with the server
  user's privileges, as normal Claude Code.
- The server subscription is shared with normal Claude Code usage; quota is
  consumed by both.
- A compromised Windows host can use the SSH key to access the server.
- A compromised server can return malicious file contents to the model/UI.
- Fable/other model availability and 1M context depend on the account and remote
  engine version; the patch does not grant entitlements.
- The project may conflict with Anthropic's terms. Users must decide whether to
  use it.

## What to review before running

1. `scripts/build.mjs` patch anchors and integrity updates.
2. `scripts/oracle-policy.cjs` environment cleaning.
3. `scripts/prepare.mjs` file copies.
4. `scripts/refresh-remote-models.ps1` SSH target and arguments.
5. `scripts/oracle-usage-query.py` fields sent to the local UI.

Run the build against a copy you own; keep a backup of the original profile.
