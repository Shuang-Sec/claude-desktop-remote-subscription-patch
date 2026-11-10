# Contributing

Thanks for helping improve this compatibility patch.

## Before you start

- This project does not distribute Anthropic binaries or source. Do not add
  `app.asar`, `claude.exe`, `ion-dist.asar`, extracted app code, or screenshots
  containing personal data.
- Keep compatibility changes version-specific. The default target is Claude
  Desktop 4.4212.0; a different version needs new anchors and tests.
- Never include real server addresses, usernames, SSH aliases, keys, tokens,
  cookies, account UUIDs, session IDs, or paper/project contents.

## Development

```powershell
npm ci
npm test
npm run check
```

PowerShell syntax check:

```powershell
Get-ChildItem scripts\*.ps1 | ForEach-Object {
  [void][ScriptBlock]::Create((Get-Content -Raw $_.FullName))
}
```

Integration build requires your own official Desktop and `config.json`; CI does
not include proprietary files.

## Pull requests

- Keep changes focused and document user-visible behavior.
- Update `README.md`/`docs/` when configuration or limitations change.
- Add a unit test for new pure logic where possible.
- State clearly whether the change was tested with a real Desktop/remote server.
- Do not claim 1M/context/model support beyond what was actually verified.
