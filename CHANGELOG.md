# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-10-10

0.5.0 was versioned in the repo but never published to npm, so its changes ship
here for the first time.

### Added
- `tokenbill statusline`: live session cost, today's project spend, cache hit
  rate and prefix break warnings in Claude Code's status line.
- `--md [file]`: GitHub Markdown report for PR comments and job summaries.
- GitHub Action (`action.yml`): Markdown report in the job summary plus an
  optional budget guard.
- `--budget <usd>`: exits 2 when the total exceeds the budget (from 0.5.0).
- Server tool pricing: web search billed per request (from 0.5.0).
- Date effective pricing, fast mode and batch tier rates, weekly pricing sync
  workflow (from 0.5.0).
- Release workflow publishing to npm with provenance on version tags.

### Changed
- CI runs on Linux, Windows and macOS, and on Node 18, 20 and 24.

## [0.4.0] - 2026-07-19

### Added
- Waste advisor with dollar quantified recommendations.
- Daily spend trend for project reports.
- `--html [file]`: self contained shareable HTML report.

## [0.3.0] - 2026-07-15

### Added
- Colored terminal report, theme module, SVG demo asset and `--no-color`.

## [0.1.0] - 2026-07-11

### Added
- Initial release.

