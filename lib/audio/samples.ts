// Pure sample math, kept free of browser APIs so it can be unit tested.

/** Average all channels into one, keeping at most `maxSamples`. */
export function downmix(channels: Float32Array[], maxSamples: number): Float32Array {
  const len = Math.min(channels[0]?.length ?? 0, maxSamples);
  const out = new Float32Array(len);
  if (!channels.length) return out;
  for (const ch of channels) {
    for (let i = 0; i < len; i++) out[i] += ch[i];
  }
  if (channels.length > 1) {
    const k = 1 / channels.length;
    for (let i = 0; i < len; i++) out[i] *= k;
  }
  return out;
}

/** Scale so the loudest sample hits `ceiling`, never boosting more than `maxGain`. */
export function normalize(samples: Float32Array, ceiling = 0.9, maxGain = 4): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  if (peak === 0) return samples;
  const gain = Math.min(maxGain, ceiling / peak);
  if (Math.abs(gain - 1) < 0.01) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return out;
}

/** `n` peak values in 0..1 for drawing a waveform. */
export function peaks(samples: Float32Array, n: number): number[] {
  const out: number[] = [];
  if (!samples.length || n <= 0) return out;
  const step = samples.length / n;
  for (let b = 0; b < n; b++) {
    const from = Math.floor(b * step);
    const to = Math.min(samples.length, Math.floor((b + 1) * step));
    let p = 0;
    for (let i = from; i < to; i++) {
      const a = Math.abs(samples[i]);
      if (a > p) p = a;
    }
    out.push(Math.min(1, p));
  }
  return out;
}

export function floatTo16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
