import { describe, expect, it } from "vitest";
import { downmix, floatTo16, normalize, peaks } from "./samples";

describe("downmix", () => {
  it("averages channels and trims to the cap", () => {
    const l = Float32Array.from([1, 1, 1, 1]);
    const r = Float32Array.from([0, 0.5, -1, 1]);
    expect(Array.from(downmix([l, r], 3))).toEqual([0.5, 0.75, 0]);
  });

  it("passes a single channel through", () => {
    expect(Array.from(downmix([Float32Array.from([0.25, -0.25])], 10))).toEqual([0.25, -0.25]);
  });
});

describe("normalize", () => {
  it("boosts quiet audio up to the ceiling", () => {
    const out = normalize(Float32Array.from([0.3, -0.45]), 0.9);
    expect(out[1]).toBeCloseTo(-0.9);
  });

  it("caps the gain", () => {
    const out = normalize(Float32Array.from([0.01]), 0.9, 4);
    expect(out[0]).toBeCloseTo(0.04);
  });

  it("leaves silence alone", () => {
    expect(Array.from(normalize(new Float32Array(3)))).toEqual([0, 0, 0]);
  });
});

describe("peaks", () => {
  it("returns one max per bucket", () => {
    expect(peaks(Float32Array.from([0.1, -0.8, 0.3, 0.2]), 2).map((p) => +p.toFixed(2))).toEqual([0.8, 0.3]);
  });
});

describe("floatTo16", () => {
  it("clips and scales", () => {
    expect(Array.from(floatTo16(Float32Array.from([2, -2, 0])))).toEqual([32767, -32768, 0]);
  });
});
