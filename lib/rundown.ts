import type { Clip, SegmentState } from "./types";
import { dur, tc } from "./format";

export interface Slot {
  clip: Clip;
  start: number;
  discussion: number;
}

export function defaultDiscussion(clip: Clip): number {
  return clip.kind === "intro" ? 0 : 60;
}

export function discussionFor(clip: Clip, seg: SegmentState): number {
  return seg.discussion[clip.id] ?? defaultDiscussion(clip);
}

/** Lay out shortlisted clips back to back, each followed by its discussion time. */
export function buildSlots(clips: Clip[], seg: SegmentState): { slots: Slot[]; total: number } {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const slots: Slot[] = [];
  let t = 0;
  for (const id of seg.order) {
    const clip = byId.get(id);
    if (!clip) continue;
    const discussion = discussionFor(clip, seg);
    slots.push({ clip, start: t, discussion });
    t += clip.durationSec + discussion;
  }
  return { slots, total: t };
}

export function budgetPct(total: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((total / target) * 100));
}

const KIND_LABEL = { question: "Question", thought: "Thought", intro: "Intro" } as const;

export function showNotes(title: string, slots: Slot[], total: number): string {
  const lines = slots.map(
    (s) =>
      `${tc(s.start)}  ${s.clip.name} · ${KIND_LABEL[s.clip.kind]} (${dur(s.clip.durationSec)})${s.clip.summary ? ` · ${s.clip.summary}` : ""}`,
  );
  return [`${title} · listener segment (${tc(total)})`, "", ...lines].join("\n");
}
