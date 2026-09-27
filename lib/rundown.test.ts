import { describe, expect, it } from "vitest";
import { budgetPct, buildSlots, showNotes } from "./rundown";
import { emptySegment, type Clip } from "./types";

const clip = (id: string, kind: Clip["kind"], durationSec: number): Clip => ({
  id, name: id, kind, durationSec, dest: "lwit", fromVideo: false, source: "listener", createdAt: "", size: 0,
});

describe("buildSlots", () => {
  const clips = [clip("amara", "intro", 9), clip("priya", "question", 72), clip("marcus", "question", 48)];

  it("matches the design's timecodes (intro 0s, others 60s discussion)", () => {
    const seg = { ...emptySegment(), order: ["amara", "priya", "marcus"] };
    const { slots, total } = buildSlots(clips, seg);
    expect(slots.map((s) => s.start)).toEqual([0, 9, 141]);
    expect(total).toBe(141 + 48 + 60);
  });

  it("uses per-slot discussion overrides and skips missing clips", () => {
    const seg = { ...emptySegment(), order: ["gone", "priya", "marcus"], discussion: { priya: 30 } };
    const { slots } = buildSlots(clips, seg);
    expect(slots.map((s) => [s.clip.id, s.start])).toEqual([["priya", 0], ["marcus", 102]]);
  });

  it("formats show notes", () => {
    const seg = { ...emptySegment(), order: ["amara"] };
    const { slots, total } = buildSlots(clips, seg);
    expect(showNotes("LWIT", slots, total)).toBe("LWIT · listener segment (00:09)\n\n00:00  amara · Intro (0:09)");
  });
});

describe("budgetPct", () => {
  it("caps at 100", () => {
    expect(budgetPct(240, 480)).toBe(50);
    expect(budgetPct(600, 480)).toBe(100);
  });
});
