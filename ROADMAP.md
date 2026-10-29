# Roadmap

tokenbill is feature complete at 1.0. It is maintained for fixes (log format
changes, pricing updates for `--cost`) but no new features are planned. This
page records what was built, what was measured, and what was left out on
purpose.

## Who it is for

Developers who use Claude Code every day, mostly on a Pro or Max
subscription, who want to know what their context is made of. Teams on API
keys get the same report in dollars with `--cost`, and a CI budget guard.

## Principles

- **Explain, don't just count.** Every number says what it was made of.
- **Zero setup.** `npx tokenbill` works in any project with no config.
- **Local analysis, opt-in sharing.** No network calls. Anything that leaves
  the machine (an image, an HTML file, a job summary) is created only when the
  user asks, and `--redact` hides prompt text.
- **Honest numbers.** Tokens by default, because a dollar figure is a price a
  subscriber never pays. Plan usage only as Claude Code reports it, never
  derived from tokens. Heuristics are called heuristics.

## What shipped

- **0.1 to 0.6: the report.** Per-request deduplication, attribution of the
  context to the conversation, tool output, files, replies and compaction,
  cache analysis, largest turns with their prompts, sub-agents, Markdown,
  HTML and JSON output, `--all`, `--since`, a GitHub Action and budget guard.
- **0.7: the share card.** One 1200×630 image rendered locally with bundled
  fonts, byte identical on Windows, macOS and Linux.
- **1.0: tokens first.** Every report in tokens, dollars behind `--cost`, real
  plan usage in the status line, and a fix for screenshots that were counted
  about a hundred times too large.

## What was measured before 1.0

The plan for 1.0 was a per-turn waste detector: a Claude Code hook that
would flag large tool outputs, repeated file reads and failed commands run
again unchanged. It was measured first, on 22 real sessions (3,098 requests,
840 M tokens of context):

| Signal | Result |
|---|---|
| Large tool output kept in context | 1.1% of context sent |
| Same file range read again, unchanged | 1 of 141 reads |
| Failed command run again, unchanged | 0 of 57 failures |
| Conversation re-sent with each request | 82.7% of context sent |

Claude Code already trims large output and avoids redundant reads. What fills
the context is session length, which Claude Code's own context indicator,
`/compact` and `/clear` already address. The detector was dropped; the
measurement became the README's headline instead.

## Left out on purpose

- **Per-turn hooks and a Claude Code plugin.** See above: the signals were
  not there, and a notice after every turn would mostly say nothing.
- **A Codex adapter.** ccusage and others already report Codex usage. The
  adapter interface in `src/adapters/` stays open for contributions.
- **Cost comments on pull requests.** Linking sessions to PRs (branches,
  squash merges, sessions spanning PRs) cannot be done reliably from logs.
- **Comparing usage with a plan's price.** Removed in 1.0: an API-equivalent
  figure divided by a subscription fee says more than the numbers support.
- **Cost per commit or per line, time tracking, personas.** These read as
  productivity scores, which token logs cannot support.
- **A hosted dashboard, accounts or any upload of user data.**
