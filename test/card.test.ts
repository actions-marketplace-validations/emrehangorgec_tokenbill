import { afterEach, describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { aggregate } from "../src/aggregate.js";
import { svgToPng } from "../src/card-png.js";
import { setShowPrompts } from "../src/privacy.js";
import { cardCaption, cardData, renderCardSvg } from "../src/report/card.js";

afterEach(() => setShowPrompts(true));

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function data() {
  const sessions = ["fixtures/basic.jsonl", "fixtures/compaction.jsonl"].map((f) =>
    claudeCodeAdapter.parse(f),
  );
  return cardData(aggregate(sessions, 5), "demo");
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

  it("redacted cards lead with the costliest finding and its fix", () => {
    setShowPrompts(false);
    const d = data();
    expect(d.topFinding).toBeDefined();
    const svg = renderCardSvg(d);
    expect(svg).toContain("TOP FINDING");
    expect(svg).not.toContain("PRICIEST TURN");
    expect(svg).toContain(esc(d.topFinding!.title));
    expect(svg).toContain(`→ ${d.topFinding!.fix}`);
    expect(cardCaption(d)).toContain(d.topFinding!.title.slice(1));
  });

  it("keeps the quoted prompt when prompts are shown", () => {
    const svg = renderCardSvg(data());
    expect(svg).toContain("PRICIEST PROMPT");
    expect(svg).not.toContain("TOP FINDING");
  });

  it("cuts long labels at a word boundary", () => {
    setShowPrompts(false);
    const base = data();
    const d = {
      ...base,
      topFinding: undefined,
      topMoment: { costUSD: 1, label: "Bash ×30 + Write ×11 + Read ×6 + Edit ×4, +1 more tool and then some", quoted: false },
    };
    const svg = renderCardSvg(d);
    expect(svg).toContain(">Bash ×30 + Write ×11 + Read ×6 + Edit ×4…<");
  });

  it("labels the day strip with the day it ends on", () => {
    const d = data();
    expect(renderCardSvg(d)).not.toContain("last 30 days");
    expect(renderCardSvg(d)).toMatch(/30 days to [A-Z][a-z]{2} \d{1,2}</);
  });

  it("rasterizes to PNG when the optional renderer is installed", () => {
    const png = svgToPng(renderCardSvg(data()));
    if (!png) return; // optional dependency missing on this platform
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });
});
