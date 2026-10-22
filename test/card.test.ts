import { afterEach, describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { aggregate } from "../src/aggregate.js";
import { svgToPng } from "../src/card-png.js";
import { setShowPrompts } from "../src/privacy.js";
import { cardCaption, cardData, renderCardSvg } from "../src/report/card.js";

afterEach(() => setShowPrompts(true));

function data(plan?: { name: string; feeUSD: number }) {
  const sessions = ["fixtures/basic.jsonl", "fixtures/compaction.jsonl"].map((f) =>
    claudeCodeAdapter.parse(f),
  );
  return cardData(aggregate(sessions, 5), "demo", plan);
}

describe("share card", () => {
  it("renders a 1200x630 SVG with total, spectrum and top prompt", () => {
    const d = data();
    const svg = renderCardSvg(d);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain("PRICIEST PROMPT");
    expect(d.topMoment?.quoted).toBe(true);
    expect(d.segments.reduce((s, x) => s + x.amountUSD, 0)).toBeCloseTo(d.totalUSD, 6);
  });

  it("shows the same savings estimate as the report's recommendations", () => {
    const d = data();
    const svg = renderCardSvg(d);
    expect(svg).toContain("ROOM TO SAVE");
    expect(svg).not.toContain("AVOIDABLE");
    expect(d.savings.estimateUSD).toBeGreaterThanOrEqual(0);
  });

  it("escapes prompt text", () => {
    const d = { ...data(), topMoment: { costUSD: 1, label: '<b>"x" & y</b>', quoted: true } };
    expect(renderCardSvg(d)).toContain("&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;");
  });

  it("redaction swaps the prompt for the tool summary", () => {
    setShowPrompts(false);
    const d = data();
    expect(d.topMoment?.quoted).toBe(false);
  });

  it("states the plan as a multiple or a share of its price", () => {
    const big = data({ name: "Pro", feeUSD: 0.01 });
    expect(renderCardSvg(big)).toMatch(/\d+\.\d×/);
    expect(cardCaption(big)).toContain("× what my Pro plan costs");
    const small = data({ name: "Max 20x", feeUSD: 1e6 });
    expect(cardCaption(small)).toContain("% of my Max 20x plan's price");
  });

  it("rasterizes to PNG when the optional renderer is installed", () => {
    const png = svgToPng(renderCardSvg(data()));
    if (!png) return; // optional dependency missing on this platform
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });
});
