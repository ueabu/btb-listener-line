import { describe, expect, it } from "vitest";
import { mondayOf } from "./format";

describe("mondayOf", () => {
  it("finds the Monday of the week", () => {
    expect(mondayOf(new Date(2026, 8, 26)).getDate()).toBe(21); // Sat Sep 26 → Mon Sep 21
    expect(mondayOf(new Date(2026, 8, 27)).getDate()).toBe(21); // Sun → same week
    expect(mondayOf(new Date(2026, 8, 21)).getDate()).toBe(21); // Monday itself
  });
});
