/**
 * Report unit. Tokens by default: a subscriber's dollar figure would be an
 * API price they never pay. `--cost` switches to API-equivalent USD.
 *
 * The pipeline is unit-agnostic: in token mode lookupPrice() prices every
 * token class at 1, so the `*USD` fields of costs, categories, turns and
 * sessions hold token counts. Renderers format them with amount().
 */
export type Unit = "tokens" | "usd";

let current: Unit = "tokens";

export function setUnit(u: Unit): void {
  current = u;
}

export function costShown(): boolean {
  return current === "usd";
}

export function tokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} K`;
  return String(Math.round(n));
}

/** An amount in the current unit: "$1.23" or "1.2 M tokens" (`short` drops the word). */
export function amount(n: number, short = false): string {
  if (current === "usd") {
    if (n >= 10000) return `$${Math.round(n).toLocaleString("en-US")}`;
    return `$${n.toFixed(n >= 100 ? 0 : 2)}`;
  }
  return short ? tokens(n) : `${tokens(n)} tokens`;
}

/** Below this an amount is noise: 5 cents, or 10 K tokens. */
export function materialAmount(): number {
  return current === "usd" ? 0.05 : 10_000;
}
