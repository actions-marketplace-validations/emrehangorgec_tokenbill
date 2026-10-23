# Contributing

## Setup

```
npm install
npm test          # vitest: unit + golden-file snapshot tests
npx tsc --noEmit  # type check
npm run dev       # tsx src/cli.ts (run the CLI against your own logs)
```

## Adding an adapter

`tokenbill` supports multiple AI coding agents through an adapter interface
(`src/adapters/types.ts`). An adapter turns an agent's raw log format into a
`NormalizedSession`:

```ts
export interface Adapter {
  name: string;
  detect(path: string): boolean;
  parse(path: string): NormalizedSession;
}
```

`src/adapters/claude-code.ts` is the reference implementation - read it first.
A new adapter (Codex CLI, Gemini CLI, etc.) needs its own file under
`src/adapters/`, a `detect`/`parse` pair, and test fixtures under `fixtures/`
covering a normal session plus edge cases (corrupt lines, missing fields).

That is not yet enough to ship a new agent. Today the CLI calls
`claudeCodeAdapter.parse` directly and only discovers logs under
`~/.claude/projects`, and the price table only covers Anthropic models. A
second agent also needs log discovery for its own directory, adapter selection
in `src/cli.ts`, and prices for its models. Open an issue to agree on that
design before starting.

## Updating pricing

**The price table is generated, not hand-edited.** Three files, one of which you
never touch:

| File | Edited by | Holds |
|---|---|---|
| [`src/cost/prices.generated.ts`](src/cost/prices.generated.ts) | the sync script | the shipped rates. **Do not edit.** |
| [`src/cost/pricing.overrides.json`](src/cost/pricing.overrides.json) | you | facts the feed can't express |
| [`src/cost/pricing.ts`](src/cost/pricing.ts) | you | the lookup logic, effective-date resolution |

```bash
npm run pricing:sync    # refresh the generated table from upstream
npm run pricing:audit   # validate it offline (also runs in CI and on publish)
```

`npm run pricing:sync` is the only thing in this project that touches the
network, and it never ships - `files` publishes `dist` and `fonts` only. tokenbill itself
still makes zero network calls; see [Privacy](README.md#privacy). Run it
manually whenever upstream rates need refreshing.

### When to edit the overrides file

The machine feed reports one undated price per model. Anything it can't express
belongs in `pricing.overrides.json`:

- **A promotional rate started or ended.** Declare both windows under
  `windows`, with `effectiveFrom` / `effectiveTo`. Without them the feed's
  single number gets applied to sessions on both sides of the boundary, and one
  of those answers is wrong. Requests are priced against their own timestamp,
  so old sessions keep the rate they were actually billed at.
- **Fast mode.** `usage.speed === "fast"` runs the same model at a premium
  (Opus 5: $10/$50, double standard). Listed under `fast`.
- **A retired model.** Its rate is frozen forever, so pin it under `models`
  rather than depending on the feed to keep carrying it.
- **A generic prefix that would mis-price siblings.** `claude-opus-4` as a
  prefix matches both Opus 4.1 ($15/$75) and Opus 4.5 ($5/$25) - one of them
  has to be wrong. Such keys go in `drop.keys`, and every version gets its own
  explicit row. An unmatched model must fall through to the flagged fallback,
  never to a wrong sibling's rate.

Set `"verify": true` on a hand-entered rate and the sync script will cross-check
it against the feed and report a mismatch instead of trusting either blindly.

### Reviewing sync output

The feed is a third-party aggregation and it is sometimes wrong: some older
entries carry cache costs on a different scale to their base rate, which derive
to impossible multipliers (a 24× one-hour cache write). The script clamps
anything outside a plausible band and reports it, but read the notes in the run
log. Sanity anchors: cache read `0.1×`, 5-minute write `1.25×`, 1-hour write
`2×`.

### Overriding prices without a release

Users can replace either table at runtime. `--pricing` accepts the bare model
array, or an object with the parts you want to replace:

```json
{
  "models": [{ "match": "claude-opus-5", "inputPerMTok": 5, "outputPerMTok": 25,
               "cacheReadMult": 0.1, "cacheWrite5mMult": 1.25, "cacheWrite1hMult": 2 }],
  "serverTools": { "webSearchPerRequest": 0.01, "webFetchPerRequest": 0 }
}
```

## Report wording

Cost category names and their one-line explanations live in one place,
[`src/categories.ts`](src/categories.ts). The terminal, HTML, Markdown and card
renderers all read from it, so a wording change there shows up everywhere.
Keep labels plain: a reader who has never heard of prompt caching should still
understand what the money paid for.

## Prompt text and privacy

Expensive turns are labeled with the prompt the user typed
([`promptPreview`](src/adapters/claude-code.ts) cleans it into one line, and
[`src/privacy.ts`](src/privacy.ts) decides whether it is shown). Any output
that can leave the user's machine without them reading it first must respect
`--redact`; the GitHub Action passes it for job summaries. If you add a new
report or output path, render turn labels through `turnLabel` / `turnPrompt`,
never through `turn.prompt` directly.

## Share card

`tokenbill card` is split in two:

| File | Holds |
|---|---|
| [`src/report/card.ts`](src/report/card.ts) | the card as a pure SVG string, plus the caption and plan prices |
| [`src/card-png.ts`](src/card-png.ts) | SVG to PNG through `@resvg/resvg-js`, with the bundled fonts |

`@resvg/resvg-js` is an **optional** dependency: when it has no prebuilt binary
for a platform the card is written as SVG instead, so it must never become a
hard requirement. The fonts under [`fonts/`](fonts) (Space Grotesk and
JetBrains Mono) are SIL OFL licensed; their licenses sit next to them and
must ship with them.

Monthly plan prices for `--plan` are in `PLANS` in `card.ts`. They are list
prices in USD; check Anthropic's pricing page when changing them.

The README card ([`assets/card.png`](assets/card.png)) is generated from a real
project with prompts hidden. Regenerate it with `--redact`, always:

```
npx tsx src/cli.ts card <project-dir> --redact --plan max5 --since <first-session-date> --out assets/card.png
```

## Test fixtures

Fixtures under `fixtures/` are anonymized real session logs (same-length
placeholder text; structure, token counts, and tool names preserved). Use
[`scripts/anonymize.ts`](scripts/anonymize.ts) to prepare a new fixture from a
real log before committing it - never commit raw, unanonymized logs.

If your change affects report output, regenerate golden snapshots and review
the diff by eye before committing:

```
npx vitest run -u
```

## Before opening a PR

- `npm test` and `npx tsc --noEmit` pass.
- If you changed the card, attach a before/after PNG to the PR.
- Keep the change focused - avoid bundling unrelated edits.
