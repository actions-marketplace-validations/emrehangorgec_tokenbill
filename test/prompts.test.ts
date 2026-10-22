import { afterEach, describe, expect, it } from "vitest";
import { claudeCodeAdapter, promptPreview } from "../src/adapters/claude-code.js";
import { setShowPrompts, turnLabel } from "../src/privacy.js";
import { projectName } from "../src/project-dir.js";
import { segmentTurns } from "../src/turns.js";

afterEach(() => setShowPrompts(true));

describe("prompt previews", () => {
  it("collapses whitespace and truncates long prompts", () => {
    expect(promptPreview("  fix   the\nlogin  bug ")).toBe("fix the login bug");
    const long = promptPreview("x".repeat(500))!;
    expect(long.length).toBe(160);
    expect(long.endsWith("…")).toBe(true);
  });

  it("drops harness-injected messages", () => {
    expect(promptPreview("[Request interrupted by user for tool use]")).toBeUndefined();
    expect(
      promptPreview("This session is being continued from a previous conversation that ran out"),
    ).toBeUndefined();
    expect(promptPreview("<local-command-stdout>Enabled plan mode</local-command-stdout>")).toBeUndefined();
  });

  it("keeps slash commands as /name args", () => {
    const raw =
      "<command-name>/plan</command-name>\n<command-message>plan</command-message>\n" +
      "<command-args>review the parser</command-args>";
    expect(promptPreview(raw)).toBe("/plan review the parser");
  });

  it("replaces pasted blocks with a marker", () => {
    expect(promptPreview('see this <pasted_content id="a1">lots\nof text</pasted_content id="a1"> ok')).toBe(
      "see this [pasted text] ok",
    );
  });

  it("labels turns with the prompt, and --redact hides it", () => {
    const session = claudeCodeAdapter.parse("fixtures/basic.jsonl");
    const turn = segmentTurns(session).find((t) => t.prompt)!;
    expect(turnLabel(turn)).toContain(`· ${turn.description}`);
    setShowPrompts(false);
    expect(turnLabel(turn)).toBe(turn.description);
  });
});

describe("project names", () => {
  it("uses the shared folder name, or nothing when sessions disagree", () => {
    expect(projectName(["/home/a/code/tokenbill", "/home/a/code/tokenbill/"])).toBe("tokenbill");
    expect(projectName(["C:\\Users\\a\\Desktop\\tokenbill"])).toBe("tokenbill");
    expect(projectName(["/x/one", "/x/two"])).toBeUndefined();
    expect(projectName([undefined])).toBeUndefined();
  });
});
