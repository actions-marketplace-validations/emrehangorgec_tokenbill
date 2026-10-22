/**
 * Prompt visibility. Turn labels quote what the user typed so a report reads
 * like their own history; --redact falls back to the tool summary for reports
 * that leave the machine.
 */
import type { Turn } from "./turns.js";

let showPrompts = true;

export function setShowPrompts(on: boolean): void {
  showPrompts = on;
}

export function promptsShown(): boolean {
  return showPrompts;
}

/** The user's prompt if shown and known, else undefined. */
export function turnPrompt(t: Turn): string | undefined {
  return showPrompts ? t.prompt : undefined;
}

/** Single-line label: quoted prompt plus what the agent did, or just the latter. */
export function turnLabel(t: Turn, maxPrompt = 60): string {
  const p = turnPrompt(t);
  if (!p) return t.description;
  const short = p.length > maxPrompt ? `${p.slice(0, maxPrompt - 1)}…` : p;
  return `"${short}" · ${t.description}`;
}
