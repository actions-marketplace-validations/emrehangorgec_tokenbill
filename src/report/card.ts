/**
 * Share card: one 1200x630 SVG (the Open Graph size X, Reddit and LinkedIn
 * preview at) that tells the story of a project's spend at a glance:
 * the total, a single spectrum band of where it went, the priciest prompt
 * and the estimated room to save that the recommendations point to.
 *
 * Pure string rendering - rasterizing to PNG lives in card-png.ts.
 */
import { advise } from "../advise.js";
import type { AggregateResult } from "../aggregate.js";
import { categoryRows, type CategoryKey } from "../categories.js";
import { turnPrompt } from "../privacy.js";
import { dailyTrend } from "../trends.js";

export const CARD_W = 1200;
export const CARD_H = 630;

/** Monthly list prices of Claude subscription plans, USD. */
export const PLANS: Record<string, { name: string; monthlyUSD: number }> = {
  pro: { name: "Pro", monthlyUSD: 20 },
  max5: { name: "Max 5x", monthlyUSD: 100 },
  max20: { name: "Max 20x", monthlyUSD: 200 },
};

export interface PlanInfo {
  name: string;
  /** what the plan cost over the card's window */
  feeUSD: number;
}

export interface CardData {
  project: string;
  periodLabel: string;
  sessionCount: number;
  totalUSD: number;
  segments: { key: CategoryKey; label: string; amountUSD: number }[];
  topMoment?: { costUSD: number; label: string; quoted: boolean };
  /** the report's "potential savings" estimate, with the event counts behind it */
  savings: { estimateUSD: number; breaks: number; compactions: number };
  cacheHitRate: number;
  days: { date: string; costUSD: number }[];
  plan?: PlanInfo;
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

function money(n: number): string {
  if (n >= 10000) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (n >= 100) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

/** Cut text to roughly fit `width` px at `size` px (em-width estimate). */
function fit(text: string, width: number, size: number, em = 0.56): string {
  const max = Math.floor(width / (size * em));
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

function shortDate(ts: string | undefined): string | undefined {
  if (!ts) return undefined;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function cardData(result: AggregateResult, project: string, plan?: PlanInfo): CardData {
  const oldest = result.sessions[result.sessions.length - 1]?.startTime;
  const newest = result.sessions[0]?.startTime;
  const a = shortDate(oldest);
  const b = shortDate(newest);
  const periodLabel = a && b ? (a === b ? a : `${a} – ${b}`) : "";

  const top = result.topTurns[0];
  const prompt = top ? turnPrompt(top) : undefined;
  return {
    project,
    periodLabel,
    sessionCount: result.sessionCount,
    totalUSD: result.totalUSD,
    segments: categoryRows(result.categories)
      .filter((r) => r.amountUSD > 0)
      .map(({ key, label, amountUSD }) => ({ key, label, amountUSD })),
    topMoment: top
      ? { costUSD: top.costUSD, label: prompt ?? top.description, quoted: !!prompt }
      : undefined,
    // Same number the terminal report calls "potential savings", so the card
    // never claims more than the recommendations it summarizes.
    savings: {
      estimateUSD: advise({
        totalUSD: result.totalUSD,
        categories: result.categories,
        cache: result.cache,
        compactionEventCount: result.compactionEventCount,
      }).potentialSavingsUSD,
      breaks: result.cache.invalidations,
      compactions: result.compactionEventCount,
    },
    cacheHitRate: result.cache.hitRate,
    days: dailyTrend(result.sessions, 30).map((d) => ({ date: d.date, costUSD: d.costUSD })),
    plan,
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
  let out =
    `<text x="64" y="150" font-family="${FONT_SANS}" font-weight="500" font-size="20" fill="${K.dim}" letter-spacing="2">MY CLAUDE CODE BILL</text>` +
    `<text x="60" y="262" font-family="${FONT_SANS}" font-weight="700" font-size="112" fill="${K.fg}" letter-spacing="-3">${esc(total)}</text>`;
  // Right of the total: the plan multiplier when known, else cache savings.
  const x = 64 + total.length * 112 * 0.54 + 48;
  if (d.plan && d.plan.feeUSD > 0) {
    // Below 1x a multiplier reads like a typo; say how much of the plan it used.
    const mult = d.totalUSD / d.plan.feeUSD;
    const big = mult >= 1 ? `${mult.toFixed(1)}×` : `${Math.round(mult * 100)}%`;
    const sub = mult >= 1 ? `my ${d.plan.name} plan's price` : `of my ${d.plan.name} plan's price`;
    out +=
      `<text x="${x}" y="214" font-family="${FONT_SANS}" font-weight="700" font-size="56" fill="${K.accent}">${big}</text>` +
      `<text x="${x}" y="250" font-family="${FONT_SANS}" font-weight="500" font-size="20" fill="${K.dim}">` +
      `${esc(`${sub} (${money(d.plan.feeUSD)})`)}</text>`;
  } else {
    out +=
      `<text x="${x}" y="214" font-family="${FONT_SANS}" font-weight="700" font-size="44" fill="${K.brand}">${Math.round(d.cacheHitRate * 100)}%</text>` +
      `<text x="${x}" y="250" font-family="${FONT_SANS}" font-weight="500" font-size="20" fill="${K.dim}">served from cache</text>`;
  }
  out += `<text x="64" y="298" font-family="${FONT_MONO}" font-size="15" fill="${K.dim}">at API list prices · where it went:</text>`;
  return out;
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
  if (d.topMoment) {
    const m = d.topMoment;
    const text = m.quoted ? `“${fit(m.label, 590, 24, 0.5)}”` : fit(m.label, 590, 22, 0.6);
    left = panel(
      64,
      628,
      m.quoted ? "PRICIEST PROMPT" : "PRICIEST TURN",
      K.brand,
      `<text x="88" y="514" font-family="${FONT_SANS}" font-weight="500" font-size="24" fill="${K.fg}">${esc(text)}</text>` +
        `<text x="88" y="548" font-family="${FONT_MONO}" font-size="18" fill="${K.dim}">${esc(`${money(m.costUSD)} in one turn`)}</text>`,
    );
  }
  const est = d.savings.estimateUSD;
  const parts: string[] = [];
  if (d.savings.breaks > 0) parts.push(`${d.savings.breaks} cache break${d.savings.breaks === 1 ? "" : "s"}`);
  if (d.savings.compactions > 0) {
    parts.push(`${d.savings.compactions} compaction${d.savings.compactions === 1 ? "" : "s"}`);
  }
  const right = panel(
    716,
    420,
    "ROOM TO SAVE (ESTIMATE)",
    est > 0 ? K.accent : K.brand,
    `<text x="740" y="522" font-family="${FONT_SANS}" font-weight="700" font-size="40" fill="${est > 0 ? K.accent : K.fg}">${esc(est > 0 ? `≈ ${money(est)}` : money(0))}</text>` +
      `<text x="740" y="552" font-family="${FONT_MONO}" font-size="16" fill="${K.dim}">${esc(est > 0 ? fit(parts.join(" · ") || "see the report", 370, 16, 0.6) : "nothing obvious to trim")}</text>`,
  );
  return left + right;
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
    `<text x="490" y="600" font-family="${FONT_MONO}" font-size="13" fill="${K.dim}">last 30 days</text>` +
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
    `${money(d.totalUSD)} of Claude Code on ${d.project}` +
      (d.sessionCount > 1 ? ` across ${d.sessionCount} sessions` : "") +
      ".",
  ];
  if (d.plan && d.plan.feeUSD > 0) {
    const mult = d.totalUSD / d.plan.feeUSD;
    parts.push(
      mult >= 1
        ? `That's ${mult.toFixed(1)}× what my ${d.plan.name} plan costs.`
        : `That's ${Math.round(mult * 100)}% of my ${d.plan.name} plan's price.`,
    );
  }
  if (lead) parts.push(`${share}% of it was ${lead.label.toLowerCase()}.`);
  parts.push("Itemize yours: npx tokenbill card");
  return parts.join(" ");
}
