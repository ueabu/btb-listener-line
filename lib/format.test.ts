import { describe, expect, it } from "vitest";
import { mb, mondayOf, timeLeft, weekLabel } from "./format";

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

describe("mb", () => {
  it("shows whole MB for big files, one decimal for small", () => {
    expect(mb(87.4 * 1024 * 1024)).toBe("87 MB");
    expect(mb(0.9 * 1024 * 1024)).toBe("0.9 MB");
  });
});

describe("timeLeft", () => {
  it("waits for a few seconds of data", () => {
    expect(timeLeft(10, 100, 2)).toBeNull();
  });

  it("estimates from the average speed so far", () => {
    expect(timeLeft(50, 100, 60)).toBe("about 1 min left"); // 60 s to go
    expect(timeLeft(75, 100, 60)).toBe("about 20 sec left"); // 20 s to go
    expect(timeLeft(98, 100, 60)).toBe("a few seconds left");
  });

  it("is null once finished", () => {
    expect(timeLeft(100, 100, 60)).toBeNull();
  });
});
