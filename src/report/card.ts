/**
 * Share card: one 1200x630 SVG (the Open Graph size X, Reddit and LinkedIn
 * preview at) that tells the story of a project's spend at a glance:
 * the total, a single spectrum band of where it went, the largest prompt
 * and, with --cost, the estimated room to save the recommendations point to.
 * In tokens that last panel shows the average request size instead: a saving
 * has no honest token equivalent.
 *
 * Pure string rendering - rasterizing to PNG lives in card-png.ts.
 */
import { advise, type Finding } from "../advise.js";
import type { AggregateResult } from "../aggregate.js";
import { categoryRows, type CategoryKey } from "../categories.js";
import { turnPrompt } from "../privacy.js";
import { dailyTrend } from "../trends.js";
import { amount, costShown } from "../unit.js";

export const CARD_W = 1200;
export const CARD_H = 630;

export interface CardData {
  project: string;
  periodLabel: string;
  sessionCount: number;
  requestCount: number;
  totalUSD: number;
  segments: { key: CategoryKey; label: string; amountUSD: number }[];
  topMoment?: { costUSD: number; label: string; quoted: boolean };
  /** the costliest flagged pattern, stated so a stranger understands it */
  topFinding?: { title: string; fix: string; costUSD: number };
  /** the report's "potential savings" estimate, with the event counts behind it */
  savings: { estimateUSD: number; breaks: number; compactions: number };
  cacheHitRate: number;
  days: { date: string; costUSD: number }[];
}

const FONT_SANS = "Space Grotesk, Segoe UI, Helvetica, Arial, sans-serif";
const FONT_MONO = "JetBrains Mono, Consolas, Menlo, monospace";

const K = {
  bg0: "#07090f",
  bg1: "#0f1424",
  grid: "#1a2033",
  fg: "#eef2f8",
  dim: "#7c869c",
  faint: "#3a4258",
  brand: "#3ee6ff",
  accent: "#ffd166",
};

const SEGMENT: Record<CategoryKey, string> = {
  overhead: "#8d97ad",
  generation: "#e36bf0",
  toolResults: "#5aa9ff",
  fileReads: "#3fe0c8",
  cacheWrites: "#ffc857",
  compaction: "#ff6b6b",
  serverTools: "#8be38b",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "$1,234" or "1.2 M" (`long` adds "tokens"). */
function money(n: number, long = false): string {
  return amount(n, !long);
}

/**
 * Cut text to roughly fit `width` px at `size` px (em-width estimate),
 * at a word boundary when one is close enough.
 */
function fit(text: string, width: number, size: number, em = 0.56): string {
  const max = Math.floor(width / (size * em));
  if (text.length <= max) return text;
  let cut = text.slice(0, Math.max(1, max - 1));
  const space = cut.lastIndexOf(" ");
  if (space >= max / 2) cut = cut.slice(0, space);
  return `${cut.replace(/[\s,;:+·-]+$/, "")}…`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Card wording for an advisor finding: what it cost, and the one change that helps. */
function describeFinding(
  f: Finding,
  totalUSD: number,
  compactions: number,
  breaks: number,
): CardData["topFinding"] {
  const cost = f.costUSD ?? 0;
  switch (f.kind) {
    case "compaction":
      return {
        title: `${plural(compactions, "compaction")} cost ${money(cost, true)}`,
        fix: "start a fresh session per task",
        costUSD: cost,
      };
    case "cacheBreaks":
      return {
        title: `${plural(breaks, "cache break")} cost ${money(cost, true)}`,
        fix: "keep settings and prompts stable mid-session",
        costUSD: cost,
      };
    case "fileReads":
      return {
        title: `file reads cost ${money(cost, true)} (${Math.round((cost / totalUSD) * 100)}%)`,
        fix: "read ranges or grep instead of whole files",
        costUSD: cost,
      };
    default:
      return undefined;
  }
}

function shortDate(ts: string | undefined): string | undefined {
  if (!ts) return undefined;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function cardData(result: AggregateResult, project: string): CardData {
  const oldest = result.sessions[result.sessions.length - 1]?.startTime;
  const newest = result.sessions[0]?.startTime;
  const a = shortDate(oldest);
  const b = shortDate(newest);
  const periodLabel = a && b ? (a === b ? a : `${a} – ${b}`) : "";

  const top = result.topTurns[0];
  const prompt = top ? turnPrompt(top) : undefined;
  const advice = advise({
    totalUSD: result.totalUSD,
    categories: result.categories,
    cache: result.cache,
    compactionEventCount: result.compactionEventCount,
  });
  const costliest = advice.findings
    .filter((f) => f.severity === "warn" && (f.costUSD ?? 0) > 0)
    .sort((x, y) => (y.costUSD ?? 0) - (x.costUSD ?? 0))[0];
  return {
    project,
    periodLabel,
    sessionCount: result.sessionCount,
    requestCount: result.requestCount,
    totalUSD: result.totalUSD,
    segments: categoryRows(result.categories)
      .filter((r) => r.amountUSD > 0)
      .map(({ key, label, amountUSD }) => ({ key, label, amountUSD })),
    topMoment: top
      ? { costUSD: top.costUSD, label: prompt ?? top.description, quoted: !!prompt }
      : undefined,
    topFinding: costliest
      ? describeFinding(costliest, result.totalUSD, result.compactionEventCount, result.cache.invalidations)
      : undefined,
    // Same number the terminal report calls "potential savings", so the card
    // never claims more than the recommendations it summarizes.
    savings: {
      estimateUSD: advice.potentialSavingsUSD,
      breaks: result.cache.invalidations,
      compactions: result.compactionEventCount,
    },
    cacheHitRate: result.cache.hitRate,
    days: dailyTrend(result.sessions, 30).map((d) => ({ date: d.date, costUSD: d.costUSD })),
  };
}

function background(): string {
  const lines: string[] = [];
  for (let x = 0; x <= CARD_W; x += 40) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${CARD_H}"/>`);
  }
  for (let y = 0; y <= CARD_H; y += 40) {
    lines.push(`<line x1="0" y1="${y}" x2="${CARD_W}" y2="${y}"/>`);
  }
  return (
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${K.bg1}"/><stop offset="1" stop-color="${K.bg0}"/></linearGradient>` +
    `<radialGradient id="glow" cx="0.12" cy="0.1" r="0.7">` +
    `<stop offset="0" stop-color="${K.brand}" stop-opacity="0.16"/>` +
    `<stop offset="1" stop-color="${K.brand}" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="band"><rect x="64" y="318" width="1072" height="56" rx="14"/></clipPath>` +
    `</defs>` +
    `<rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)"/>` +
    `<g stroke="${K.grid}" stroke-width="1" opacity="0.55">${lines.join("")}</g>` +
    `<rect width="${CARD_W}" height="${CARD_H}" fill="url(#glow)"/>`
  );
}

function header(d: CardData): string {
  const meta = [d.periodLabel, `${d.sessionCount} session${d.sessionCount === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join("  ·  ");
  return (
    `<text x="64" y="84" font-family="${FONT_MONO}" font-weight="700" font-size="22" fill="${K.brand}">tokenbill</text>` +
    `<rect x="190" y="66" width="12" height="22" fill="${K.brand}" opacity="0.85"/>` +
    `<text x="1136" y="84" text-anchor="end" font-family="${FONT_SANS}" font-weight="500" font-size="22" fill="${K.dim}">` +
    `${esc(fit(d.project, 560, 22))}</text>` +
    `<text x="1136" y="114" text-anchor="end" font-family="${FONT_MONO}" font-size="16" fill="${K.dim}">${esc(meta)}</text>`
  );
}

function hero(d: CardData): string {
  const total = money(d.totalUSD);
  const title = costShown() ? "MY CLAUDE CODE BILL" : "TOKENS MY CLAUDE CODE SENT";
  // The number's width sets where the cache figure goes beside it.
  const x = 64 + total.length * 112 * 0.54 + 48;
  return (
    `<text x="64" y="150" font-family="${FONT_SANS}" font-weight="500" font-size="20" fill="${K.dim}" letter-spacing="2">${title}</text>` +
    `<text x="60" y="262" font-family="${FONT_SANS}" font-weight="700" font-size="112" fill="${K.fg}" letter-spacing="-3">${esc(total)}</text>` +
    `<text x="${x}" y="214" font-family="${FONT_SANS}" font-weight="700" font-size="44" fill="${K.brand}">${Math.round(d.cacheHitRate * 100)}%</text>` +
    `<text x="${x}" y="250" font-family="${FONT_SANS}" font-weight="500" font-size="20" fill="${K.dim}">served from cache</text>` +
    `<text x="64" y="298" font-family="${FONT_MONO}" font-size="15" fill="${K.dim}">` +
    `${costShown() ? "at API list prices · where it went:" : "where the context went:"}</text>`
  );
}

/** The signature element: one band, every dollar in it, sized by share. */
function spectrum(d: CardData): string {
  const x0 = 64;
  const w = 1072;
  const total = d.segments.reduce((s, r) => s + r.amountUSD, 0);
  if (total <= 0) {
    return `<rect x="${x0}" y="318" width="${w}" height="56" rx="14" fill="${K.faint}"/>`;
  }
  let x = x0;
  const rects: string[] = [];
  const legend: string[] = [];
  let lx = x0;
  for (const s of d.segments) {
    const sw = (s.amountUSD / total) * w;
    rects.push(`<rect x="${x.toFixed(1)}" y="318" width="${(sw + 0.5).toFixed(1)}" height="56" fill="${SEGMENT[s.key]}"/>`);
    // Percent inside wide segments; tiny ones stay silent in the band.
    if (sw >= 70) {
      rects.push(
        `<text x="${(x + 14).toFixed(1)}" y="354" font-family="${FONT_MONO}" font-weight="700" font-size="20" fill="${K.bg0}" opacity="0.85">` +
          `${Math.round((s.amountUSD / total) * 100)}%</text>`,
      );
    }
    x += sw;
    // Legend: as many segments as fit on one line, largest first.
    const label = `${s.label} ${money(s.amountUSD)}`;
    const lw = 20 + label.length * 16 * 0.56;
    if (lx + lw <= x0 + w) {
      legend.push(
        `<rect x="${lx}" y="396" width="12" height="12" rx="3" fill="${SEGMENT[s.key]}"/>` +
          `<text x="${lx + 20}" y="407" font-family="${FONT_SANS}" font-weight="500" font-size="16" fill="${K.dim}">${esc(label)}</text>`,
      );
    }
    lx += lw + 28;
  }
  return `<g clip-path="url(#band)">${rects.join("")}</g>${legend.join("")}`;
}

function panel(x: number, w: number, title: string, color: string, body: string): string {
  return (
    `<rect x="${x}" y="440" width="${w}" height="126" rx="16" fill="${K.bg1}" stroke="${K.grid}" stroke-width="1.5"/>` +
    `<rect x="${x}" y="456" width="4" height="94" rx="2" fill="${color}"/>` +
    `<text x="${x + 24}" y="474" font-family="${FONT_MONO}" font-size="14" fill="${color}" letter-spacing="1.5">${esc(title)}</text>` +
    body
  );
}

function moments(d: CardData): string {
  let left = "";
  if (d.topFinding && !d.topMoment?.quoted) {
    // Without a prompt to quote, a tool list says nothing to a stranger;
    // the costliest pattern and its fix do.
    const f = d.topFinding;
    left = panel(
      64,
      628,
      "TOP FINDING",
      K.brand,
      `<text x="88" y="514" font-family="${FONT_SANS}" font-weight="500" font-size="24" fill="${K.fg}">${esc(fit(f.title, 590, 24, 0.5))}</text>` +
        `<text x="88" y="548" font-family="${FONT_MONO}" font-size="18" fill="${K.dim}">${esc(`→ ${fit(f.fix, 560, 18, 0.6)}`)}</text>`,
    );
  } else if (d.topMoment) {
    const m = d.topMoment;
    const text = m.quoted ? `“${fit(m.label, 590, 24, 0.5)}”` : fit(m.label, 590, 22, 0.6);
    left = panel(
      64,
      628,
      `${costShown() ? "PRICIEST" : "LARGEST"} ${m.quoted ? "PROMPT" : "TURN"}`,
      K.brand,
      `<text x="88" y="514" font-family="${FONT_SANS}" font-weight="500" font-size="24" fill="${K.fg}">${esc(text)}</text>` +
        `<text x="88" y="548" font-family="${FONT_MONO}" font-size="18" fill="${K.dim}">${esc(`${money(m.costUSD, true)} in one turn`)}</text>`,
    );
  }
  return left + (costShown() ? savingsPanel(d) : requestPanel(d));
}

/** Token mode: what one request re-sends on average, the number behind long sessions. */
function requestPanel(d: CardData): string {
  const avg = d.requestCount > 0 ? d.totalUSD / d.requestCount : 0;
  return panel(
    716,
    420,
    "AVERAGE REQUEST",
    K.accent,
    `<text x="740" y="522" font-family="${FONT_SANS}" font-weight="700" font-size="40" fill="${K.accent}">${esc(`≈ ${money(avg, true)}`)}</text>` +
      `<text x="740" y="552" font-family="${FONT_MONO}" font-size="16" fill="${K.dim}">${esc(`the whole context, re-sent ${d.requestCount} times`)}</text>`,
  );
}

function savingsPanel(d: CardData): string {
  const est = d.savings.estimateUSD;
  const parts: string[] = [];
  if (d.savings.breaks > 0) parts.push(`${d.savings.breaks} cache break${d.savings.breaks === 1 ? "" : "s"}`);
  if (d.savings.compactions > 0) {
    parts.push(`${d.savings.compactions} compaction${d.savings.compactions === 1 ? "" : "s"}`);
  }
  return panel(
    716,
    420,
    "ROOM TO SAVE (ESTIMATE)",
    est > 0 ? K.accent : K.brand,
    `<text x="740" y="522" font-family="${FONT_SANS}" font-weight="700" font-size="40" fill="${est > 0 ? K.accent : K.fg}">${esc(est > 0 ? `≈ ${money(est)}` : money(0))}</text>` +
      `<text x="740" y="552" font-family="${FONT_MONO}" font-size="16" fill="${K.dim}">${esc(est > 0 ? fit(parts.join(" · ") || "see the report", 370, 16, 0.6) : "nothing obvious to trim")}</text>`,
  );
}

/** The strip ends on the last session's day, which is not always today. */
function stripLabel(d: CardData): string {
  const end = d.days[d.days.length - 1]?.date;
  if (!end) return "daily spend";
  const [y, m, day] = end.split("-").map(Number);
  const label = new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${d.days.length} days to ${label}`;
}

/** 30 small day cells along the bottom: a quiet activity strip. */
function strip(d: CardData): string {
  const max = Math.max(...d.days.map((x) => x.costUSD), 0);
  const cells = d.days.map((day, i) => {
    const t = max > 0 ? day.costUSD / max : 0;
    const op = day.costUSD > 0 ? (0.25 + 0.75 * t).toFixed(2) : "1";
    const fill = day.costUSD > 0 ? K.brand : K.grid;
    return `<rect x="${64 + i * 14}" y="590" width="10" height="10" rx="2" fill="${fill}" opacity="${op}"/>`;
  });
  return (
    cells.join("") +
    `<text x="490" y="600" font-family="${FONT_MONO}" font-size="13" fill="${K.dim}">${esc(stripLabel(d))}</text>` +
    `<text x="1136" y="601" text-anchor="end" font-family="${FONT_MONO}" font-size="16" fill="${K.dim}">npx tokenbill card</text>`
  );
}

export function renderCardSvg(d: CardData): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">` +
    background() +
    header(d) +
    hero(d) +
    spectrum(d) +
    moments(d) +
    strip(d) +
    `</svg>\n`
  );
}

/** Ready-to-paste post text for wherever the card is shared. */
export function cardCaption(d: CardData): string {
  const lead = d.segments[0];
  const share = lead && d.totalUSD > 0 ? Math.round((lead.amountUSD / d.totalUSD) * 100) : 0;
  const parts = [
    `${money(d.totalUSD, true)} of Claude Code ${costShown() ? "" : "context "}on ${d.project}` +
      (d.sessionCount > 1 ? ` across ${d.sessionCount} sessions` : "") +
      ".",
  ];
  if (lead) parts.push(`${share}% of it was ${lead.label.toLowerCase()}.`);
  if (d.topFinding) parts.push(`${d.topFinding.title[0].toUpperCase()}${d.topFinding.title.slice(1)}.`);
  parts.push("Itemize yours: npx tokenbill card");
  return parts.join(" ");
}
