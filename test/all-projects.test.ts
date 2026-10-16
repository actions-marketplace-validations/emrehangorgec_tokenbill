import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { allProjectSessionFiles } from "../src/project-dir.js";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { calculate } from "../src/cost/calculator.js";

const require_ = createRequire(import.meta.url);
const TSX_CLI = path.join(path.dirname(require_.resolve("tsx/package.json")), "dist/cli.mjs");
const homes: string[] = [];

afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

function setup() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "tokenbill-all-"));
  homes.push(home);
  const root = path.join(home, ".claude", "projects");
  fs.mkdirSync(root, { recursive: true });
  return { home, root };
}

function run(home: string, args: string[]) {
  return spawnSync(process.execPath, [TSX_CLI, "src/cli.ts", ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

describe("all project sessions", () => {
  it("discovers only session files, excluding nested subagents and non-project entries", () => {
    const { root } = setup();
    const project = path.join(root, "project-a");
    fs.mkdirSync(path.join(project, "session", "subagents"), { recursive: true });
    fs.mkdirSync(path.join(project, "not-a-file.jsonl"));
    fs.writeFileSync(path.join(root, "metadata.jsonl"), "{}");
    fs.writeFileSync(path.join(project, "notes.txt"), "notes");
    fs.writeFileSync(path.join(project, "session", "subagents", "agent.jsonl"), "{}");
    fs.writeFileSync(path.join(project, "session.jsonl"), "{}");
    expect(allProjectSessionFiles(root)).toEqual([path.join(project, "session.jsonl")]);
    expect(allProjectSessionFiles(path.join(root, "missing"))).toEqual([]);
  });

  it("combines projects and applies the budget to their total", () => {
    const { home, root } = setup();
    for (const project of ["project-a", "project-b"]) {
      const dir = path.join(root, project);
      fs.mkdirSync(dir);
      const content = fs.readFileSync("fixtures/basic.jsonl", "utf8")
        .replaceAll("434bccac-30fc-4b1c-bf3f-477c103af21a", project);
      fs.writeFileSync(path.join(dir, "session.jsonl"), content);
    }
    const singleCost = calculate(claudeCodeAdapter.parse("fixtures/basic.jsonl")).totalUSD;
    const result = run(home, ["--all", "--json", "--budget", String(singleCost * 1.5)]);
    expect(result.status).toBe(2);
    const report = JSON.parse(result.stdout);
    expect(report.projectLabel).toBe("All projects");
    expect(report.sessionCount).toBe(2);
    expect(report.totalUSD).toBeCloseTo(singleCost * 2, 6);
    expect(report.sessions.map((s: { sessionId: string }) => s.sessionId).sort())
      .toEqual(["project-a", "project-b"]);
    expect(result.stderr).toContain("exceeds budget");

    const html = path.join(home, "report.html");
    const htmlResult = run(home, ["--all", "--html", html]);
    expect(htmlResult.status).toBe(0);
    expect(fs.readFileSync(html, "utf8")).toContain("All projects");
    const markdown = run(home, ["--all", "--md"]);
    expect(markdown.status).toBe(0);
    expect(markdown.stdout).toContain("All projects");
  });

  it("reports empty history and rejects a path instead of silently ignoring it", () => {
    const { home } = setup();
    const empty = run(home, ["--all"]);
    expect(empty.status).toBe(1);
    expect(empty.stderr).toContain("No Claude Code sessions found");
    const conflict = run(home, ["fixtures/basic.jsonl", "--all"]);
    expect(conflict.status).toBe(1);
    expect(conflict.stderr).toContain("--all cannot be combined");
  });
}, 60_000);
