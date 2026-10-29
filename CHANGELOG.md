# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-28

### Changed
- **Reports are in tokens by default.** A dollar figure is an API price a
  subscriber never pays, so terminal, Markdown, HTML, JSON, the card and the
  status line now show the tokens each part of the context took. `--cost`
  brings back the API-equivalent dollar report unchanged, and `--budget`
  implies it.
- In tokens, cache writes are part of the context they wrote rather than a
  category of their own, and no savings estimate is shown: a saving is a
  price question.
- `--json` is `schemaVersion: 3` with a `unit` field. In token mode the
  amount fields are named `...Tokens` (`totalTokens`, `costTokens`) and the
  dollar-only fields (`savedUSD`, `wastedUSD`, savings) are left out.
- The share card leads with the token total and, in place of the savings
  panel, the average request size: the whole context, re-sent once per
  request.

### Added
- `--until` ends the report at the end of a UTC day, with the same date forms
  as `--since` (`2026-09-30`, `7d`, `2w`).
  Thanks @snehaapratap ([#12](https://github.com/emrehangorgec/tokenbill/pull/12)).
- The status line shows real plan usage (`5h 64% · week 38%`) from the
  `rate_limits` Claude Code sends Pro and Max subscribers, and leaves it out
  when absent. `tokenbill statusline --cost` keeps dollars.

### Removed
- `tokenbill card --plan`: comparing an API-equivalent figure with a
  subscription fee said more than the numbers support.

### Fixed
- Image tool results (screenshots read back by the agent) were sized by
  their base64 payload, about a hundred times their real token cost. They
  are now sized from their pixel dimensions.

## [0.7.3] - 2026-10-25

### Added
- Project and `--all` reports have a Sub-agents section: their share of the
  total and the costliest runs, each with its session and the task it was
  given (hidden by `--redact`). Also in `--md`, `--html` and `--json`
  (`subagentUSD`, `subagents`).

## [0.7.2] - 2026-10-24

### Added
- `--since` accepts a relative duration (`7d`, `2w`) in addition to an
  absolute `YYYY-MM-DD` date, counting back from today (UTC), inclusive.
  Thanks @tokentimerch ([#8](https://github.com/emrehangorgec/tokenbill/pull/8)).

## [0.7.1] - 2026-10-23

### Changed
- With `--redact`, the share card leads with its costliest finding and the
  change that helps, instead of a list of tool calls.
- The card's plan comparison says how many days of use it covers when that
  is less than the month.
- The card's day strip is labeled with the day it ends on instead of
  "last 30 days".
- Long card labels are cut at a word boundary.
- `tokenbill card` suggests `--plan` when it was not given, and the caption
  includes the costliest finding.

## [0.7.0] - 2026-10-23

### Added
- `tokenbill card`: a share image of a project's spend (1200×630 layout, PNG
  rendered at 2×), made locally without a browser, with a ready-to-paste caption and an optional
  `--plan` comparison against a Claude subscription's price.
- Expensive turns are labeled with the prompt that started them.
- `--redact` hides prompt text in every report; the GitHub Action uses it for
  job summaries.
- `--all`: one report across every project under `~/.claude/projects`.
- `--since <date>`: include only sessions starting on or after a date.
- README now opens with a share card generated from a real project with
  prompts hidden.
- CI installs the packed tarball into an empty project on Linux, Windows and
  macOS and renders a card from it.

### Changed
- Cost categories use plain-language names, and the terminal report explains
  the biggest one.
- Project reports are titled with the project folder name instead of the log
  directory path.
- MCP tools appear under their tool name (`update_plan`) instead of the full
  `mcp__server__tool` identifier.
- `@resvg/resvg-js` added as an optional dependency, and the published package
  now includes the card fonts.
- Price table refreshed from the upstream feed.

### Fixed
- The weekly pricing workflow opens a new pull request after the previous one
  was merged.

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

