# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

Please use GitHub Security Advisories for this repository. Do not open a public
issue containing server addresses, usernames, session IDs, tokens, cookies,
API keys, SSH keys, or personal file paths.

Include:

- affected version/commit;
- a minimal reproduction that does not contain credentials;
- impact and suggested fix, if known.

## Secret-handling rules for contributors

- Never commit `config.json`, `.env`, logs, screenshots, cookies, tokens, keys,
  `app.asar`, `claude.exe`, or `profile/` data.
- Use placeholders such as `YOUR_SERVER_HOST`, `<you>`, and
  `/home/user/project` in examples.
- Run `npm test`, `npm run check`, and the repository secret scan before
  opening a pull request.
- If a secret is accidentally committed, revoke it first, then rewrite the
  history; deleting the file in a later commit is not enough.

## Scope

This project is an unofficial compatibility patch. It does not provide
Anthropic credentials, subscription access, or official support. Users are
responsible for complying with Anthropic's terms and for securing their own
machine, SSH keys, server, and subscription.
