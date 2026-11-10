# Changelog

## Unreleased

- Documentation: explain why the stock Desktop SSH path does not delegate a
  remote VPS subscription, and why a fixed VPS authentication environment is
  used (with explicit no-guarantee/compliance caveats).

## 0.1.0 — 2026-11-10

Initial public release.

- Independent Claude Desktop copy built from a user-supplied official
  installation.
- SSH remote subscription branch that withholds local credentials and lets the
  remote Claude Code use its own login.
- Dedicated host matching/allow-list handling without hardcoded server data.
- ASAR/EXE integrity-hash synchronization.
- Remote model catalog refresh and model-menu generation.
- Fable 5.2 `supports1m` / `prefer1m` menu metadata (new session required for
  existing sessions to pick up 1M).
- Optional remote subscription usage panel.
- Unit tests that do not require the proprietary app or network.
- Chinese installation, configuration, security, model, usage, troubleshooting,
  FAQ, and legal documentation.
