# Remote Usage Panel

## What it shows

- 5-hour subscription utilization and reset time;
- weekly utilization and reset time;
- Pro/Max/Team/Enterprise label when the server returns it;
- extra-usage enabled flag, when available;
- a refresh button and a five-minute auto-refresh while open.

Times are displayed in Asia/Shanghai; other users can change the Intl formatter
in `scripts/oracle-usage-ui.mjs`.

## Data path

```text
Usage panel (renderer)
  GET /api/oracle-trial/usage?session_id=...
    -> main process route
    -> oracle-usage.cjs
    -> selected session's SSH target
    -> ssh user@host python3 -
    -> oracle-usage-query.py on the server
    -> https://api.anthropic.com/api/oauth/usage
    -> whitelisted JSON fields
    -> renderer
```

## Credentials

- The query reads the server's `~/.claude/.credentials.json`.
- The token is used only on the server, only for the official usage endpoint.
- No token, refresh token, account email, or raw response is sent to Windows.
- The local route returns only:
  `status`, `subscription`, `queried_at`, `windows.five_hour`,
  `windows.seven_day`, `extra_usage_enabled`.

## Caching and errors

- Cache: one minute per SSH target.
- Concurrent requests for the same target share one query.
- Auto-refresh: five minutes while the panel is open.
- Errors: `ssh_failed`, `remote_auth`, `network`, `rate_limited`,
  `invalid_response`, `missing_credentials`.
- A failed query does not reuse an old value as if it were current.

## Compatibility

This uses an official internal usage endpoint. Anthropic may change it. If the
endpoint changes, the panel should show an error, not crash the app.

## Disable

Set `"usagePanel": false` in `config.json` before building. `build.mjs` then
skips the usage route/UI patch and copies the original `ion-dist.asar`, leaving
the stock usage UI in place. The provided default is enabled.
