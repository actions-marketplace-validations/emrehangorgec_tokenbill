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

/** A subagent's task as its parent wrote it, if shown and known. */
export function subagentTask(s: { task?: string }): string | undefined {
  return showPrompts ? s.task : undefined;
}

/** Single-line label for a subagent run: its quoted task, or its log id. */
export function subagentLabel(s: { id: string; task?: string }, maxTask = 60): string {
  const t = subagentTask(s);
  if (!t) return s.id;
  return `"${t.length > maxTask ? `${t.slice(0, maxTask - 1)}…` : t}"`;
}

/** Single-line label: quoted prompt plus what the agent did, or just the latter. */
export function turnLabel(t: Turn, maxPrompt = 60): string {
  const p = turnPrompt(t);
  if (!p) return t.description;
  const short = p.length > maxPrompt ? `${p.slice(0, maxPrompt - 1)}…` : p;
  return `"${short}" · ${t.description}`;
}
