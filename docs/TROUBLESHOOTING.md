# Troubleshooting

## Build fails: anchor not unique

Cause: the official Claude Desktop version is not 4.4212.0, or its `app.asar`
changed.

Fix:

1. Confirm `config.version` matches the installed app.
2. Check `officialApp/resources/app.asar`.
3. Do not force the build by editing anchors without re-verifying the code.
4. Re-adapt anchors for the new version in a separate branch and test with a
   fresh official installation.

## Build fails: integrity hash not unique

The build searches for the old header hash in `claude.exe` and requires exactly
one match. This protects against modifying the wrong bytes. Do not bypass it.

## Copy exits immediately

- Run `pwsh scripts/start-trial.ps1` from a normal user session, not a service.
- Confirm the copy has read/write access to `trial/profile`.
- Check `trial/profile/Logs/main.log`.
- If you used a sandboxed shell that blocks profile access, launch the shortcut
  normally.

## `Can't reach 127.0.0.1:1`

Expected. The copy's local gateway is intentionally dead; the remote session
must not use it. Close the warning and choose the remote environment.

## SSH connection fails

- Test `ssh -i <key> <user>@<host>` outside the app.
- Ensure the host is in `ssh_configs.json`/config.
- Check `%USERPROFILE%\.ssh\config`, key permissions, port, and firewall.
- Do not disable host-key checking globally.

## `setgroups` / nested user namespace error

The patch removes the gateway-only sandbox policy for the configured SSH
branch. If the error persists:

- verify you selected the configured host, not another SSH host;
- check the server's user-namespace policy;
- use a server environment where Claude Code normally runs;
- do not modify the server kernel just to satisfy the client.

## Model menu is stale

1. `pwsh scripts/refresh-remote-models.ps1`
2. `pwsh scripts/stop-trial.ps1`
3. `pwsh scripts/start-trial.ps1`
4. Create a new session.

## Fable 5.2 shows 200k

- Create a new session. Existing sessions can keep the old context window.
- Confirm the provider config's Fable entry has `supports1m`/`prefer1m`.
- If a new session is still 200k, the remote engine/account has not enabled
  1M for that model; local menu changes cannot override it.
- Do not edit `app.asar` further just to force a number.

## Usage panel empty

- Check the server's `~/.claude/.credentials.json` exists and is logged in.
- Run the query manually on the server if you understand the endpoint.
- Check errors: SSH, auth, network, rate limit.
- Never copy the token to Windows for debugging.

## Original app/profile changed

The patch must never modify the official installation. Verify:

- `officialApp` points to the official path, not `trial/`;
- `prepare.mjs` copies into `trial/`;
- `build.mjs` writes only `trial/`;
- no script writes to `%LOCALAPPDATA%\Claude-3p`.

If the original changed, restore from your own backup and stop using the build
until the cause is found.
