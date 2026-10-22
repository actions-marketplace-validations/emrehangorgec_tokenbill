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

## Phase 1: Readable reports (implemented, awaiting pre-release verification)

- Expensive turns are labeled with the prompt that started them.
- `--redact` hides prompt text everywhere; the Action uses it.
- Plain-language category names, shared by every report.
- Reports are titled with the project name, not the log path.

## Phase 2: Share card (implemented, awaiting pre-release verification)

- `tokenbill card`: one image with the total, the spend spectrum, the priciest
  prompt and the estimated room to save.
- PNG rendered locally without a browser, with bundled fonts.
- `--plan` compares spend against a Claude subscription's price.
- A ready-to-paste caption for posting.

Before release: install the packed tarball on a clean machine and check that
the card renders with the bundled fonts on Windows, macOS and Linux.

## Phase 3: Small launch

Ship what exists, learn from real users, then pick the next feature.

- README opens with a real card (generated with `--redact`).
- Posts on r/ClaudeAI, r/ClaudeCode and Show HN, led by the card.
- Collect feedback: which numbers people share, which they question, what
  they ask for.

## Phase 4: Chosen by feedback

Candidates, in the order we currently expect. Each needs its own design note
before work starts.

- **Cost comment on pull requests.** Open questions to settle first:
  - How sessions are linked to a PR (branch, commit trailers, time window), so
    a project total is never shown as a PR cost.
  - What happens when one session touches several PRs, or one PR spans several
    sessions.
  - How re-runs update a single comment instead of adding new ones.
  - Posting to GitHub is a network call: it stays opt-in, runs only in CI, and
    always uses `--redact`.
- **Codex adapter.** Needs log discovery, adapter selection in the CLI and
  OpenAI model prices (see [CONTRIBUTING](CONTRIBUTING.md#adding-an-adapter)).

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
