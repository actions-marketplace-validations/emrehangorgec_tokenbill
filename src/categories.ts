/**
 * Plain-language names for the attribution categories, shared by every
 * report so the terminal, HTML, Markdown and card all say the same thing.
 */
import type { Categories } from "./attribute.js";

export type CategoryKey =
  | "generation"
  | "toolResults"
  | "fileReads"
  | "overhead"
  | "cacheWrites"
  | "compaction"
  | "serverTools";

export interface CategoryRow {
  key: CategoryKey;
  label: string;
  /** one short sentence on what this money paid for */
  hint: string;
  amountUSD: number;
}

const META: Record<CategoryKey, { label: string; hint: string }> = {
  overhead: {
    label: "Re-sending the conversation",
    hint: "system prompt, instructions and your messages go out again with every request",
  },
  generation: {
    label: "Writing replies & code",
    hint: "the tokens the model wrote back",
  },
  toolResults: {
    label: "Command & tool output",
    hint: "results of shell commands, searches and other tools, kept in context",
  },
  fileReads: {
    label: "Files it read",
    hint: "file contents pulled into the conversation",
  },
  cacheWrites: {
    label: "Caching the context",
    hint: "a one-time premium that makes later re-reads 10x cheaper",
  },
  compaction: {
    label: "Summarizing long chats",
    hint: "the context filled up and was rewritten as a summary",
  },
  serverTools: {
    label: "Web searches",
    hint: "billed per search, not per token",
  },
};

/** Rows sorted by cost; compaction and web searches only appear when nonzero. */
export function categoryRows(c: Categories): CategoryRow[] {
  const amounts: [CategoryKey, number][] = [
    ["generation", c.generationUSD],
    ["toolResults", c.toolResultsUSD],
    ["fileReads", c.fileReadsUSD],
    ["overhead", c.overheadUSD],
    ["cacheWrites", c.cacheWritesUSD],
  ];
  if (c.compactionUSD > 0) amounts.push(["compaction", c.compactionUSD]);
  if (c.serverToolsUSD > 0) amounts.push(["serverTools", c.serverToolsUSD]);
  return amounts
    .map(([key, amountUSD]) => ({ key, ...META[key], amountUSD }))
    .sort((a, b) => b.amountUSD - a.amountUSD);
}
