# Model Menu

## Why the menu is generated

The Desktop copy runs in 3P/gateway mode. In this mode the desktop app's model
picker uses the administrator list (`inferenceModels`) and intentionally ignores
the official model catalog. The list must be generated from the remote engine's
initialization response so it only offers models the remote engine accepts.

## Refresh flow

```powershell
pwsh scripts/refresh-remote-models.ps1
```

The script:

1. reads `config.json`;
2. SSHes to the configured host;
3. runs `read-remote-models.py` with `python3 -`;
4. sends only official `initialize` control requests to:
   - the remote `claude` CLI (`claude-vscode`);
   - the newest `~/.claude/remote/ccd-cli/*` (`claude-desktop`);
5. validates both responses;
6. writes `remote-models.json` and `.previous`;
7. calls `apply-model-menu.mjs` to update the provider config's
   `inferenceModels`.

It does not send a model prompt, does not read the subscription token, and does
not copy credentials.

## Fable 5.2 1M

`remote-model-menu.mjs` adds:

```json
{"supports1m": true, "prefer1m": true}
```

for `claude-fable-5-2`. Desktop uses these flags to offer/force the 1M variant.

Verified behavior on 2026-11-10:

- new Desktop session with Fable 5.2 shows 1M context;
- existing sessions may keep the old 200k context because the context window is
  fixed when the session/engine starts;
- the fix is to create a new session (or reload the remote engine), not just
  switch the model in an old session.

## Why a new session is sometimes required

Switching a model in an existing conversation may preserve the existing context
window and token accounting. The model menu change alone does not rebuild the
remote engine. After a menu refresh/restart, create a new session to ensure the
1M variant is used.

## Default entry

The remote `default` entry is kept in the config but is filtered by Desktop's
3P validation (it is not an Anthropic model ID). The visible menu therefore has
one fewer concrete row than the raw `inferenceModels` array.

## Troubleshooting

- Menu missing after refresh: restart the copy; the menu is read at startup.
- Model missing: both remote engines must expose it; check the refresh output.
- Fable 5.2 still 200k: create a new session; then check the remote engine
  version and account entitlement.
- Do not hand-edit the menu for production; rerun the refresh.
