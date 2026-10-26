import { afterEach, describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { aggregate } from "../src/aggregate.js";
import { calculate } from "../src/cost/calculator.js";
import { setShowPrompts } from "../src/privacy.js";
import { renderAggregateHtml } from "../src/report/html.js";
import { renderAggregateJson } from "../src/report/json.js";
import { renderAggregateMarkdown } from "../src/report/markdown.js";
import { renderAggregateReport } from "../src/report/terminal.js";

afterEach(() => setShowPrompts(true));

function result() {
  const sessions = ["fixtures/subagent-session.jsonl", "fixtures/basic.jsonl"].map((f) =>
    claudeCodeAdapter.parse(f),
  );
  return aggregate(sessions, 5);
}

describe("sub-agent breakdown", () => {
  it("splits each session's sub-agent cost into runs that add up", () => {
    const session = claudeCodeAdapter.parse("fixtures/subagent-session.jsonl");
    const cost = calculate(session);
    expect(cost.perSubagent.map((s) => s.id)).toEqual(["agent-a5a949b"]);
    expect(cost.perSubagent.reduce((s, x) => s + x.costUSD, 0)).toBeCloseTo(cost.subagentUSD, 9);
  });

  it("collects runs across sessions with their session and task", () => {
    const r = result();
    expect(r.subagents).toHaveLength(1);
    const [s] = r.subagents;
    expect(s.sessionId).toBe(claudeCodeAdapter.parse("fixtures/subagent-session.jsonl").sessionId);
    expect(s.task).toBeTruthy();
    expect(r.subagentUSD).toBeCloseTo(s.costUSD, 9);
  });

  it("shows a Sub-agents section in every project report format", () => {
    const r = result();
    expect(renderAggregateReport(r, "demo", 5)).toContain("Sub-agents");
    expect(renderAggregateMarkdown(r, "demo")).toContain("### Sub-agents");
    expect(renderAggregateHtml(r, "demo")).toContain("Sub-agents (");
    const json = JSON.parse(renderAggregateJson(r, "demo"));
    expect(json.subagents[0].id).toBe("agent-a5a949b");
    expect(json.subagentUSD).toBeGreaterThan(0);
  });

  it("hides the task under --redact and falls back to the log id", () => {
    setShowPrompts(false);
    const r = result();
    const task = r.subagents[0].task!;
    const md = renderAggregateMarkdown(r, "demo");
    expect(md).toContain("| agent-a5a949b |");
    expect(md).not.toContain(task.slice(0, 20));
    expect(JSON.parse(renderAggregateJson(r, "demo")).subagents[0].task).toBeUndefined();
  });

  it("leaves the section out when no sub-agents ran", () => {
    const r = aggregate([claudeCodeAdapter.parse("fixtures/basic.jsonl")], 5);
    expect(r.subagents).toEqual([]);
    expect(renderAggregateMarkdown(r, "demo")).not.toContain("Sub-agents");
  });
});
