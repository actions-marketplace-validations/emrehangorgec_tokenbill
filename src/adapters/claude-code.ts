import fs from "node:fs";
import path from "node:path";
import { CHARS_PER_TOKEN } from "../attribute.js";
import type {
  Adapter,
  NormalizedRequest,
  NormalizedSession,
  Stream,
  TimelineEvent,
  ToolCall,
  ToolInput,
  Usage,
} from "./types.js";

const IGNORED_TYPES = new Set([
  "ai-title",
  "queue-operation",
  "attachment",
  "last-prompt",
  "progress",
]);

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function toUsage(raw: any): Usage {
  return {
    input_tokens: num(raw.input_tokens),
    output_tokens: num(raw.output_tokens),
    cache_read_input_tokens: num(raw.cache_read_input_tokens),
    cache_creation_input_tokens: num(raw.cache_creation_input_tokens),
    cache_creation: raw.cache_creation
      ? {
          ephemeral_5m_input_tokens: num(raw.cache_creation.ephemeral_5m_input_tokens),
          ephemeral_1h_input_tokens: num(raw.cache_creation.ephemeral_1h_input_tokens),
        }
      : undefined,
    server_tool_use: raw.server_tool_use
      ? {
          web_search_requests: num(raw.server_tool_use.web_search_requests),
          web_fetch_requests: num(raw.server_tool_use.web_fetch_requests),
        }
      : undefined,
    // Both change what the request cost: fast mode is a premium rate, batch a
    // discount. Absent on most records, which means standard speed and tier.
    speed: typeof raw.speed === "string" ? raw.speed : undefined,
    service_tier: typeof raw.service_tier === "string" ? raw.service_tier : undefined,
  };
}

/** iterations are informational - top-level usage is already the total. Warn if that invariant breaks. */
function checkIterations(rawUsage: any, warnings: string[], requestId: string): void {
  const iters = rawUsage.iterations;
  if (!Array.isArray(iters) || iters.length === 0) return;
  const sum = (field: string) => iters.reduce((a: number, it: any) => a + num(it?.[field]), 0);
  if (
    sum("output_tokens") !== num(rawUsage.output_tokens) ||
    sum("input_tokens") !== num(rawUsage.input_tokens)
  ) {
    warnings.push(
      `usage.iterations sum != top-level usage for request ${requestId} - using top-level (never summing iterations)`,
    );
  }
}

/** Vision input is billed by area: about width x height / 750 tokens. */
const IMAGE_PIXELS_PER_TOKEN = 750;
/** Used when the log has no dimensions: roughly the largest image sent unscaled. */
const DEFAULT_IMAGE_TOKENS = 1600;

/**
 * An image block's size in the same character units as text, so callers can
 * keep dividing by CHARS_PER_TOKEN. Its base64 payload is not what the model
 * reads and would overstate a screenshot about a hundredfold.
 */
function imageChars(rec: any): number {
  const d = rec.toolUseResult?.file?.dimensions;
  const w = num(d?.displayWidth) || num(d?.originalWidth);
  const h = num(d?.displayHeight) || num(d?.originalHeight);
  const tokens = w > 0 && h > 0 ? (w * h) / IMAGE_PIXELS_PER_TOKEN : DEFAULT_IMAGE_TOKENS;
  return Math.round(tokens * CHARS_PER_TOKEN);
}

/** Size of a tool result in characters, preferring the content actually fed back to the model. */
function toolResultChars(rec: any, block: any): number {
  if (typeof block?.content === "string") return block.content.length;
  if (Array.isArray(block?.content)) {
    let n = 0;
    for (const b of block.content) {
      if (typeof b?.text === "string") n += b.text.length;
      else if (b?.type === "image") n += imageChars(rec);
    }
    if (n > 0) return n;
  }
  const tur = rec.toolUseResult;
  if (typeof tur === "string") return tur.length;
  if (tur && typeof tur === "object") {
    try {
      return JSON.stringify(tur).length;
    } catch {
      return 0;
    }
  }
  return 0;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function int(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Keep only the input fields the audit reads; drop file contents and the rest. */
export function toolInput(raw: unknown): ToolInput | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const input: ToolInput = {
    filePath: str(r.file_path) ?? str(r.notebook_path),
    offset: int(r.offset),
    limit: int(r.limit),
    command: str(r.command),
  };
  for (const k of Object.keys(input) as (keyof ToolInput)[]) {
    if (input[k] === undefined) delete input[k];
  }
  return Object.keys(input).length > 0 ? input : undefined;
}

const PREVIEW_CHARS = 160;

/**
 * One-line preview of a typed prompt. Harness-injected messages (slash command
 * wrappers, interrupt markers, continuation summaries) get no preview, and
 * pasted blocks collapse to a marker so long pastes don't drown the line.
 */
export function promptPreview(raw: string): string | undefined {
  if (raw.startsWith("[Request interrupted")) return undefined;
  if (raw.startsWith("This session is being continued from a previous conversation")) {
    return undefined;
  }
  // Slash commands arrive wrapped in tags; keep "/name args" as the prompt.
  const cmd = /<command-name>([^<]*)<\/command-name>/.exec(raw)?.[1]?.trim();
  const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(raw)?.[1]?.trim();
  const text = (cmd ? `${cmd.startsWith("/") ? cmd : `/${cmd}`} ${args ?? ""}` : raw)
    .replace(/<pasted_content[^>]*>[\s\S]*?<\/pasted_content[^>]*>/g, " [pasted text] ")
    .replace(/<(command-[a-z-]+|local-command-[a-z-]+|system-reminder)>[\s\S]*?<\/\1>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 1)}…` : text;
}

interface ParseResult {
  stream: Stream;
  requests: NormalizedRequest[];
  sessionId?: string;
  skipped: number;
  warnings: string[];
  firstTs?: string;
  lastTs?: string;
  cwd?: string;
}

function parseFile(file: string, subagent?: string): ParseResult {
  const events: TimelineEvent[] = [];
  const res: ParseResult = {
    stream: { subagent, events },
    requests: [],
    skipped: 0,
    warnings: [],
  };
  const byRequestId = new Map<string, NormalizedRequest>();
  const toolNameById = new Map<string, string>();
  const lines = fs.readFileSync(file, "utf8").split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    let rec: any;
    try {
      rec = JSON.parse(line);
    } catch {
      res.skipped++;
      continue;
    }
    if (typeof rec !== "object" || rec === null) {
      res.skipped++;
      continue;
    }
    if (rec.sessionId && !res.sessionId) res.sessionId = rec.sessionId;
    if (typeof rec.cwd === "string" && !res.cwd) res.cwd = rec.cwd;
    if (rec.timestamp) {
      if (!res.firstTs || rec.timestamp < res.firstTs) res.firstTs = rec.timestamp;
      if (!res.lastTs || rec.timestamp > res.lastTs) res.lastTs = rec.timestamp;
    }
    if (IGNORED_TYPES.has(rec.type)) continue;

    if (rec.type === "assistant") {
      const usage = rec.message?.usage;
      const requestId = rec.requestId;
      if (!usage || !requestId) continue;

      // Register tool_use blocks regardless of dedupe - content blocks of one
      // request are spread across multiple records sharing the requestId.
      const newToolCalls: ToolCall[] = [];
      const content = rec.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "tool_use" && typeof block.name === "string") {
            toolNameById.set(block.id, block.name);
            const input = toolInput(block.input);
            const call: ToolCall = { id: block.id, name: block.name };
            if (input) call.input = input;
            newToolCalls.push(call);
          }
        }
      }

      const existing = byRequestId.get(requestId);
      if (existing) {
        existing.toolCalls.push(...newToolCalls);
        continue; // usage already counted - core dedupe invariant
      }
      // Synthetic/internal records (e.g. model "<synthetic>") with zero usage
      // are harness bookkeeping, not billable API calls - skip them.
      const model: string = rec.message.model ?? "unknown";
      const zeroUsage =
        num(usage.input_tokens) +
          num(usage.output_tokens) +
          num(usage.cache_read_input_tokens) +
          num(usage.cache_creation_input_tokens) ===
        0;
      if (zeroUsage && model.startsWith("<")) continue;
      checkIterations(usage, res.warnings, requestId);
      const req: NormalizedRequest = {
        requestId,
        model,
        timestamp: rec.timestamp ?? "",
        usage: toUsage(usage),
        toolCalls: newToolCalls,
        subagent,
      };
      byRequestId.set(requestId, req);
      res.requests.push(req);
      events.push({ kind: "request", request: req });
      continue;
    }

    if (rec.type === "user") {
      const content = rec.message?.content;
      if (typeof content === "string") {
        events.push({
          kind: "userPrompt",
          chars: content.length,
          timestamp: rec.timestamp ?? "",
          text: rec.isMeta ? undefined : promptPreview(content),
        });
      } else if (Array.isArray(content)) {
        let sawToolResult = false;
        for (const block of content) {
          if (block?.type === "tool_result") {
            sawToolResult = true;
            events.push({
              kind: "toolResult",
              toolName: toolNameById.get(block.tool_use_id) ?? "unknown",
              chars: toolResultChars(rec, block),
              timestamp: rec.timestamp ?? "",
              toolUseId: str(block.tool_use_id) ?? "",
              isError: block.is_error === true,
            });
          }
        }
        if (!sawToolResult) {
          const parts: string[] = content
            .map((b: any) => (typeof b?.text === "string" ? b.text : ""))
            .filter(Boolean);
          const chars = parts.reduce((a, t) => a + t.length, 0);
          if (chars > 0) {
            events.push({
              kind: "userPrompt",
              chars,
              timestamp: rec.timestamp ?? "",
              text: rec.isMeta ? undefined : promptPreview(parts.join("\n")),
            });
          }
        }
      }
    }
  }
  return res;
}

function subagentFiles(sessionFile: string): string[] {
  const dir = path.join(
    path.dirname(sessionFile),
    path.basename(sessionFile, ".jsonl"),
    "subagents",
  );
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(dir, f));
}

export const claudeCodeAdapter: Adapter = {
  name: "claude-code",

  detect(p: string): boolean {
    return p.endsWith(".jsonl");
  },

  parse(sessionFile: string): NormalizedSession {
    const main = parseFile(sessionFile);
    let skipped = main.skipped;
    const warnings = [...main.warnings];
    const requests = [...main.requests];
    const streams: Stream[] = [main.stream];
    let firstTs = main.firstTs;
    let lastTs = main.lastTs;

    for (const sf of subagentFiles(sessionFile)) {
      const sub = parseFile(sf, path.basename(sf, ".jsonl"));
      requests.push(...sub.requests);
      streams.push(sub.stream);
      skipped += sub.skipped;
      warnings.push(...sub.warnings);
      if (sub.firstTs && (!firstTs || sub.firstTs < firstTs)) firstTs = sub.firstTs;
      if (sub.lastTs && (!lastTs || sub.lastTs > lastTs)) lastTs = sub.lastTs;
    }

    return {
      sessionId: main.sessionId ?? path.basename(sessionFile, ".jsonl"),
      sourcePath: sessionFile,
      requests,
      streams,
      models: [...new Set(requests.map((r) => r.model))],
      startTime: firstTs,
      endTime: lastTs,
      cwd: main.cwd,
      skippedLines: skipped,
      warnings,
    };
  },
};
