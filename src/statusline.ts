/**
 * `tokenbill statusline`: one line for Claude Code's `statusLine` command.
 *
 * Claude Code pipes a JSON object on stdin (session_id, transcript_path, cwd,
 * model, rate_limits, ...) and shows whatever we print. This runs on every
 * refresh, so it must be fast and must never fail loudly: any error degrades
 * to a dash.
 *
 * Plan usage comes only from `rate_limits`, which Claude Code sends to Pro and
 * Max subscribers after the first response. Without it the segment is left
 * out: a percentage is never derived from token counts.
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
import { amount, costShown } from "./unit.js";

/** One rate-limit window as Claude Code reports it. */
export interface RateWindow {
  /** 0 to 100 */
  used_percentage?: number;
  /** Unix epoch seconds */
  resets_at?: number;
}

export interface StatuslineInput {
  transcript_path?: string;
  rate_limits?: { five_hour?: RateWindow; seven_day?: RateWindow };
}

function startOfLocalDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Amount timestamped today across every session in the transcript's project log dir. */
function todayAmount(transcriptPath: string, now: Date): number {
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

/** "5h 64%", colored by how close the window is to its limit; undefined when absent. */
function windowSegment(label: string, w: RateWindow | undefined, now: Date): string | undefined {
  const pct = w?.used_percentage;
  if (typeof pct !== "number" || !Number.isFinite(pct)) return undefined;
  // A window past its reset time is stale data, not current usage.
  if (typeof w?.resets_at === "number" && w.resets_at * 1000 <= now.getTime()) return undefined;
  const color = pct >= 80 ? palette.bad : pct >= 50 ? palette.warn : palette.good;
  return `${label} ${paint(color, `${Math.round(pct)}%`)}`;
}

export function renderStatusline(input: StatuslineInput, now = new Date()): string {
  const transcript = input.transcript_path;
  if (!transcript || !fs.existsSync(transcript)) return dim("tokenbill -");

  const session = claudeCodeAdapter.parse(transcript);
  const cost = calculate(session);
  const cache = analyzeCache(session);

  const parts = [`${bold(paint(palette.brand, "tokenbill"))} ${bold(amount(cost.totalUSD))}`];
  parts.push(`today ${amount(todayAmount(transcript, now), true)}`);
  for (const seg of [
    windowSegment("5h", input.rate_limits?.five_hour, now),
    windowSegment("week", input.rate_limits?.seven_day, now),
  ]) {
    if (seg) parts.push(seg);
  }
  if (cache.tokens.read + cache.tokens.write + cache.tokens.uncached > 0) {
    const rate = cache.hitRate;
    const color = rate >= 0.8 ? palette.good : rate >= 0.5 ? palette.warn : palette.bad;
    parts.push(`cache ${paint(color, `${(rate * 100).toFixed(0)}%`)}`);
  }
  if (cache.invalidations > 0) {
    const n = cache.invalidations;
    const wasted = costShown() ? ` (${amount(cache.wastedUSD)})` : "";
    parts.push(paint(palette.bad, `⚠ ${n} prefix break${n > 1 ? "s" : ""}${wasted}`));
  }
  return parts.join(dim(" · "));
}

/** Entry point: never throws, always exits 0. */
export function runStatusline(raw: string, now?: Date): string {
  try {
    return renderStatusline(JSON.parse(raw.replace(/^﻿/, "")) as StatuslineInput, now);
  } catch {
    return dim("tokenbill -");
  }
}
