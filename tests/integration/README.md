# Integration tests

These tests require a real official Claude Desktop 4.4212.0 installation and a
filled `config.json`. They are intentionally not run by `npm test`.

Suggested manual checks:

1. `pwsh scripts/install.ps1 -Check`
2. Build into a disposable `trialRoot`.
3. Verify the patched app starts and reads `trial/profile`.
4. Verify the configured SSH host works and the original profile is unchanged.
5. Run `refresh-remote-models.ps1` and check both engines return models.
6. Create a new session and verify the selected model/context.
7. Test the usage panel if enabled.
8. Roll back with `restore-model-menu.ps1` and verify the previous menu.

Do not commit generated `trial/`, logs, config, or model catalog files.
