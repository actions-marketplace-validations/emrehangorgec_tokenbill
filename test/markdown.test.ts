import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { aggregate } from "../src/aggregate.js";
import { attribute } from "../src/attribute.js";
import { analyzeCache } from "../src/cost/cache.js";
import { calculate } from "../src/cost/calculator.js";
import { renderAggregateMarkdown, renderMarkdown } from "../src/report/markdown.js";
import { topTurns } from "../src/turns.js";
import { stablePricingDate } from "./stable.js";

function singleMd(fixture: string): string {
  const session = claudeCodeAdapter.parse(fixture);
  return renderMarkdown(
    session,
    calculate(session),
    attribute(session),
    topTurns(session, 5),
    analyzeCache(session),
  );
}

function aggregateMd(): string {
  const files = fs
    .readdirSync("fixtures")
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join("fixtures", f));
  return renderAggregateMarkdown(aggregate(files.map((f) => claudeCodeAdapter.parse(f)), 5), "fixtures");
}

describe("markdown report", () => {
  it("has no ANSI escapes", () => {
    expect(singleMd("fixtures/basic.jsonl")).not.toMatch(/\x1b\[/);
  });

  it("keeps every table row at its header's column count", () => {
    for (const md of [singleMd("fixtures/compaction.jsonl"), aggregateMd()]) {
      let cols = 0;
      for (const line of md.split("\n")) {
        if (!line.startsWith("|")) {
          cols = 0;
          continue;
        }
        const n = line.replace(/\\|/g, "").split("|").length;
        if (cols === 0) cols = n;
        expect(n).toBe(cols);
      }
    }
  });

  for (const f of ["fixtures/basic.jsonl", "fixtures/compaction.jsonl", "fixtures/server-tools.jsonl"]) {
    it(`snapshot: ${f}`, () => {
      expect(stablePricingDate(singleMd(f))).toMatchSnapshot();
    });
  }

  it("snapshot: aggregate", () => {
    expect(stablePricingDate(aggregateMd())).toMatchSnapshot();
  });
});
