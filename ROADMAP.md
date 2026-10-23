# Roadmap

## Who it is for

Developers who use AI coding agents every day, on a subscription or on API
keys, and the team leads who pay for them.

## The problem

Agents report a token count or a dollar total, but not why a session cost what
it did or what to change. tokenbill explains where the money went and what to
do about it, in words a non-expert understands and in a form people want to
share.

## Principles

- **Explain, don't just count.** Every number comes with what it paid for.
- **Zero setup.** `npx tokenbill` works in any project with no config.
- **Local analysis, opt-in sharing.** Analysis runs on the user's machine with
  no network calls. Anything that leaves the machine (an image, an HTML file, a
  GitHub comment) is created only when the user asks for it, and prompt text is
  hidden by default in automatic shares.
- **Honest numbers.** API-equivalent estimates are labeled as estimates;
  heuristics are called heuristics.
- **Solve our users' problem.** A feature is added because it helps people
  understand or reduce their spend, not because another tool has it.

## Phase 1: Readable reports (done)

- Expensive turns are labeled with the prompt that started them.
- `--redact` hides prompt text everywhere; the Action uses it.
- Plain-language category names, shared by every report.
- Reports are titled with the project name, not the log path.

## Phase 2: Share card (done)

- `tokenbill card`: one image with the total, the spend spectrum, the priciest
  prompt and the estimated room to save.
- PNG rendered locally without a browser, with bundled fonts.
- `--plan` compares spend against a Claude subscription's price.
- A ready-to-paste caption for posting.

## Phase 3: Release 0.7.0

Phases 1 and 2 are on `main` but not on npm, while the README already
documents `npx tokenbill card`. Nothing gets promoted until they ship.

- CI installs the packed tarball into an empty project on Windows, macOS and
  Linux and renders a card from it with the bundled fonts.
- Publish 0.7.0 to npm and move the Action tag in the README.
- Repository topics and a social preview image, so links to the repo look
  like the card.

## Phase 4: A card worth posting

People share their own number, not a tool. The card has to say something a
stranger understands at a glance, even with `--redact`.

- With `--redact`, the priciest turn box shows the largest finding in one
  sentence (for example "13 compactions cost $31") instead of a list of tool
  calls cut off mid-word.
- The plan comparison only uses days that have data, or says how many days it
  covers, so "1.6× my plan" from two days of use is never read as a month.
- The day strip matches the window the card actually covers.
- The caption suggests `--plan` when it was not given, and always ends with
  the command that made the card.

## Phase 5: Small launch

- Lead with a finding, not the tool: "half of my bill was re-sending the
  conversation, here is what changed it", with the card attached.
- r/ClaudeAI and r/ClaudeCode first, Show HN on a different day, then curated
  lists of Claude Code tools.
- Every question that comes back becomes an issue; those issues order Phase 6.
- Baseline before launch: 11 stars, about 20 npm downloads a week.

## Phase 6: Chosen by feedback

Candidates, in the order we currently expect. Each needs its own design note
before work starts.

- **Codex adapter.** Roughly doubles who can use tokenbill, and a Claude Code
  vs Codex comparison is itself something people share. Needs log discovery,
  adapter selection in the CLI and OpenAI model prices (see
  [CONTRIBUTING](CONTRIBUTING.md#adding-an-adapter)).
- **Claude Code plugin.** The status line and a `/tokenbill` command in one
  install, inside the tool people already have open.
- **Cost comment on pull requests.** Open questions to settle first:
  - How sessions are linked to a PR (branch, commit trailers, time window), so
    a project total is never shown as a PR cost.
  - What happens when one session touches several PRs, or one PR spans several
    sessions.
  - How re-runs update a single comment instead of adding new ones.
  - Posting to GitHub is a network call: it stays opt-in, runs only in CI, and
    always uses `--redact`.

## Later, if at all

- **Cost per commit or per line.** Squash merges, rewritten code and deleted
  lines distort it heavily. If added, it is shown as a plainly defined ratio,
  never as a productivity score.

## Out of scope

- Time tracking or "hours worked" estimates.
- Receipt-style output and Wrapped-style personas.
- Security scanning of agents, MCP servers or repositories.
- A hosted dashboard, accounts or any upload of user data.
- Report translations, until there is demand from users.
