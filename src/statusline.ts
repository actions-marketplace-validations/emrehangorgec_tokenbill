/**
 * `tokenbill statusline`: one line for Claude Code's `statusLine` command.
 *
 * Claude Code pipes a JSON object on stdin (session_id, transcript_path, cwd,
 * model, ...) and shows whatever we print. This runs on every refresh, so it
 * must be fast and must never fail loudly: any error degrades to a dash.
 *
 * "today" sums the requests timestamped on the local calendar day across the
 * project's sessions. Only files modified today are parsed, which keeps it
 * cheap without a cache directory.
 */
import fs from "node:fs";
import path from "node:path";
import { claudeCodeAdapter } from "./adapters/claude-code.js";
import { analyzeCache } from "./cost/cache.js";
import { calculate, requestCostUSD } from "./cost/calculator.js";
import { bold, dim, paint, palette } from "./report/theme.js";

export interface StatuslineInput {
  transcript_path?: string;
}

function usd(n: number): string {
  return `$${n.toFixed(n >= 100 ? 0 : 2)}`;
}

function startOfLocalDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Spend timestamped today across every session in the transcript's project log dir. */
function todayUSD(transcriptPath: string, now: Date): number {
  const dayStart = startOfLocalDay(now);
  const dir = path.dirname(transcriptPath);
  let total = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    const file = path.join(dir, f);
    if (fs.statSync(file).mtimeMs < dayStart) continue;
    for (const req of claudeCodeAdapter.parse(file).requests) {
      const t = Date.parse(req.timestamp);
      if (t >= dayStart && t <= now.getTime()) total += requestCostUSD(req);
    }
  }
  return total;
}

export function renderStatusline(input: StatuslineInput, now = new Date()): string {
  const transcript = input.transcript_path;
  if (!transcript || !fs.existsSync(transcript)) return dim("tokenbill -");

  const session = claudeCodeAdapter.parse(transcript);
  const cost = calculate(session);
  const cache = analyzeCache(session);

  const parts = [`${bold(paint(palette.brand, "tokenbill"))} ${bold(usd(cost.totalUSD))}`];
  parts.push(`today ${usd(todayUSD(transcript, now))}`);
  if (cache.tokens.read + cache.tokens.write + cache.tokens.uncached > 0) {
    const rate = cache.hitRate;
    const color = rate >= 0.8 ? palette.good : rate >= 0.5 ? palette.warn : palette.bad;
    parts.push(`cache ${paint(color, `${(rate * 100).toFixed(0)}%`)}`);
  }
  if (cache.invalidations > 0) {
    parts.push(
      paint(
        palette.bad,
        `⚠ ${cache.invalidations} prefix break${cache.invalidations > 1 ? "s" : ""} (${usd(cache.wastedUSD)})`,
      ),
    );
  }
  return parts.join(dim(" · "));
}

/** Entry point: never throws, always exits 0. */
export function runStatusline(raw: string): string {
  try {
    return renderStatusline(JSON.parse(raw.replace(/^﻿/, "")) as StatuslineInput);
  } catch {
    return dim("tokenbill -");
  }
}
