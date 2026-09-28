import { describe, expect, it } from "vitest";
import { mondayOf, weekLabel } from "./format";

describe("mondayOf", () => {
  it("finds the Monday of the week", () => {
    expect(mondayOf(new Date(2026, 8, 26)).getDate()).toBe(21); // Sat Sep 26 → Mon Sep 21
    expect(mondayOf(new Date(2026, 8, 27)).getDate()).toBe(21); // Sun → same week
    expect(mondayOf(new Date(2026, 8, 21)).getDate()).toBe(21); // Monday itself
  });
});

describe("weekLabel", () => {
  it("uses the day the week was started, even on a weekend", () => {
    // Pressed on Sunday Sep 27: the label moves to Sep 27, not back to Monday Sep 21.
    expect(weekLabel(new Date(2026, 8, 27, 10).toISOString(), undefined, "en-US")).toBe("Week of Sep 27");
  });

  it("falls back to this week's Monday before a week has been started", () => {
    expect(weekLabel(undefined, new Date(2026, 8, 26), "en-US")).toBe("Week of Sep 21");
  });
});
