import { describe, expect, it } from "vitest";
import { parseSpeaker } from "./intro";

describe("parseSpeaker", () => {
  it("reads name, city and country", () => {
    expect(parseSpeaker("Tobi from London, UK")).toEqual({ name: "Tobi", city: "London", country: "UK" });
    expect(parseSpeaker("Tobi in London in the UK")).toEqual({ name: "Tobi", city: "London", country: "the UK" });
    expect(parseSpeaker("Mary Jane from Lagos, Nigeria")).toEqual({ name: "Mary Jane", city: "Lagos", country: "Nigeria" });
  });

  it("leaves prompts for what's missing", () => {
    expect(parseSpeaker("Tobi from London")).toEqual({ name: "Tobi", city: "London", country: "[your country]" });
    expect(parseSpeaker("Tobi")).toEqual({ name: "Tobi", city: "[your city]", country: "[your country]" });
    expect(parseSpeaker("  ")).toEqual({ name: "[your name]", city: "[your city]", country: "[your country]" });
  });
});
