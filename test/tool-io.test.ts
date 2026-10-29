import { describe, expect, it } from "vitest";
import { claudeCodeAdapter, toolInput } from "../src/adapters/claude-code.js";

describe("tool inputs and results", () => {
  const session = claudeCodeAdapter.parse("fixtures/basic.jsonl");
  const calls = session.requests.flatMap((r) => r.toolCalls);
  const results = session.streams[0].events.flatMap((e) => (e.kind === "toolResult" ? [e] : []));

  it("keeps the file path of a Read and the command of a Bash call", () => {
    expect(calls.find((c) => c.name === "Read")?.input?.filePath).toBeTruthy();
    expect(calls.find((c) => c.name === "Bash")?.input?.command).toBeTruthy();
  });

  it("never holds on to file contents from Write or Edit", () => {
    const write = calls.find((c) => c.name === "Write");
    expect(write?.input?.filePath).toBeTruthy();
    expect(Object.keys(write?.input ?? {})).toEqual(["filePath"]);
  });

  it("links each result to its call and carries the error flag", () => {
    const ids = new Set(calls.map((c) => c.id));
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(ids.has(r.toolUseId)).toBe(true);
    expect(results.filter((r) => r.isError)).toHaveLength(1);
  });

  it("reads offset and limit, and ignores fields of the wrong type", () => {
    expect(toolInput({ file_path: "a.ts", offset: 10, limit: 40 })).toEqual({
      filePath: "a.ts",
      offset: 10,
      limit: 40,
    });
    expect(toolInput({ file_path: 3, command: ["ls"] })).toBeUndefined();
    expect(toolInput(null)).toBeUndefined();
  });
});
