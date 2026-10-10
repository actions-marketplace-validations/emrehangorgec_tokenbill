import { describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { calculate } from "../src/cost/calculator.js";
import { setColorEnabled } from "../src/report/theme.js";
import { renderStatusline, runStatusline } from "../src/statusline.js";

setColorEnabled(false);

// basic.jsonl and subagent-session.jsonl both ran on 2026-07-11 (UTC, pinned
// in vitest.config.ts); every other fixture is from another day, and so is
// subagent-session's sub-agent log (2026-01-24), which must not be counted.
const FIXTURE_DAY_END = new Date("2026-07-11T23:59:59Z");

describe("statusline", () => {
  it("shows session cost, today's project spend, cache rate and prefix breaks", () => {
    expect(renderStatusline({ transcript_path: "fixtures/basic.jsonl" }, FIXTURE_DAY_END)).toMatchInlineSnapshot(
      `"tokenbill $1.66 · today $3.32 · cache 87% · ⚠ 1 prefix break ($0.47)"`,
    );
  });

  it("today sums only the requests made on that day", () => {
    const expected = ["fixtures/basic.jsonl", "fixtures/subagent-session.jsonl"]
      .map((f) => {
        const cost = calculate(claudeCodeAdapter.parse(f));
        return cost.totalUSD - cost.subagentUSD;
      })
      .reduce((a, b) => a + b, 0);
    const line = renderStatusline({ transcript_path: "fixtures/basic.jsonl" }, FIXTURE_DAY_END);
    expect(line).toContain(`today $${expected.toFixed(2)}`);
  });

  it("degrades to a dash on bad input instead of throwing", () => {
    expect(runStatusline("{not json")).toBe("tokenbill -");
    expect(runStatusline("")).toBe("tokenbill -");
    expect(runStatusline(JSON.stringify({ transcript_path: "fixtures/missing.jsonl" }))).toBe("tokenbill -");
  });
});
