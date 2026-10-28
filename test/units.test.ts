import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { aggregate } from "../src/aggregate.js";
import { attribute, attributionTotalUSD } from "../src/attribute.js";
import { analyzeCache } from "../src/cost/cache.js";
import { calculate } from "../src/cost/calculator.js";
import { categoryRows } from "../src/categories.js";
import { cardCaption, cardData, renderCardSvg } from "../src/report/card.js";
import { renderAggregateJson, renderJson } from "../src/report/json.js";
import { renderAggregateMarkdown } from "../src/report/markdown.js";
import { renderReport } from "../src/report/terminal.js";
import { setColorEnabled } from "../src/report/theme.js";
import { topTurns } from "../src/turns.js";
import { setUnit } from "../src/unit.js";

const FIXTURES = ["fixtures/basic.jsonl", "fixtures/compaction.jsonl", "fixtures/server-tools.jsonl"];

beforeEach(() => setUnit("tokens"));
afterEach(() => setUnit("usd"));

describe("token mode (the default)", () => {
  it.each(FIXTURES)("totals every token the requests sent and wrote: %s", (f) => {
    const s = claudeCodeAdapter.parse(f);
    const expected = s.requests.reduce(
      (a, r) =>
        a +
        r.usage.input_tokens +
        r.usage.output_tokens +
        r.usage.cache_read_input_tokens +
        r.usage.cache_creation_input_tokens,
      0,
    );
    expect(calculate(s).totalUSD).toBe(expected);
    // Categories still split the whole total, with cache writes folded in.
    const attr = attribute(s);
    expect(attributionTotalUSD(attr)).toBeCloseTo(expected, 3);
    expect(attr.cacheWritesUSD).toBe(0);
    expect(attr.serverToolsUSD).toBe(0);
    expect(categoryRows(attr).map((r) => r.key)).not.toContain("cacheWrites");
  });

  it("prints no dollar sign and no savings estimate", () => {
    setColorEnabled(false);
    const s = claudeCodeAdapter.parse("fixtures/compaction.jsonl");
    const out = renderReport(s, calculate(s), attribute(s), topTurns(s), analyzeCache(s));
    expect(out).toContain("TOKENS SENT AND WRITTEN");
    expect(out).toContain("--cost for API prices");
    expect(out).not.toContain("$");
    expect(out).not.toMatch(/savings/i);
    const md = renderAggregateMarkdown(aggregate([s]), "demo");
    expect(md).not.toContain("$");
    expect(md).toContain("| Tokens |");
  });

  it("names JSON fields by what they hold and drops dollar-only ones", () => {
    const s = claudeCodeAdapter.parse("fixtures/server-tools.jsonl");
    const single = JSON.parse(renderJson(s, calculate(s), attribute(s), topTurns(s), analyzeCache(s)));
    expect(single.unit).toBe("tokens");
    expect(single.totalTokens).toBe(calculate(s).totalUSD);
    expect(single.categories.fileReadsTokens).toBeTypeOf("number");
    const all = renderAggregateJson(aggregate([s]), "demo");
    expect(all).not.toMatch(/USD|savings|pricingAsOf|pricedExactly/);
  });

  it("renders the card without dollars or a savings panel", () => {
    const sessions = ["fixtures/basic.jsonl", "fixtures/compaction.jsonl"].map((f) =>
      claudeCodeAdapter.parse(f),
    );
    const d = cardData(aggregate(sessions, 5), "demo");
    const svg = renderCardSvg(d);
    expect(svg).toContain("TOKENS MY CLAUDE CODE SENT");
    expect(svg).toContain("AVERAGE REQUEST");
    expect(svg).toContain(`re-sent ${d.requestCount} times`);
    expect(svg).not.toContain("ROOM TO SAVE");
    expect(svg).not.toContain("$");
    expect(cardCaption(d)).toMatch(/^[\d.]+ [KMB] tokens of Claude Code context on demo/);
  });
});
