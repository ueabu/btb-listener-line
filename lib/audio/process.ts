import { MAX_SECONDS } from "../types";
import { downmix, normalize, peaks } from "./samples";
import type { EncodeMessage } from "./mp3.worker";

export const SAMPLE_RATE = 44100;
const KBPS = 64;
/** Refuse files bigger than this before trying to decode them in memory. */
export const MAX_INPUT_BYTES = 400 * 1024 * 1024;

export interface Processed {
  mp3: Blob;
  durationSec: number;
  originalSec: number;
  trimmed: boolean;
  peaks: number[];
}

export class AudioError extends Error {}

export async function decode(blob: Blob): Promise<AudioBuffer> {
  if (blob.size > MAX_INPUT_BYTES) {
    throw new AudioError("That file is too big to handle in the browser. Try a shorter clip, or record right here instead.");
  }
  const data = await blob.arrayBuffer();
  // A context at 44.1 kHz makes decodeAudioData resample for us, which lame can encode directly.
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    return await ctx.decodeAudioData(data);
  } catch {
    throw new AudioError(
      "We couldn't read the audio in that file. Try a different file, or record it right here instead.",
    );
  } finally {
    void ctx.close();
  }
}

function encode(samples: Float32Array, onProgress?: (p: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./mp3.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<EncodeMessage>) => {
      const m = e.data;
      if (m.type === "progress") onProgress?.(m.value);
      else {
        worker.terminate();
        if (m.type === "done") resolve(m.blob);
        else reject(new AudioError(`Couldn't convert the audio: ${m.message}`));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new AudioError(`Couldn't convert the audio: ${e.message}`));
    };
    worker.postMessage({ samples, sampleRate: SAMPLE_RATE, kbps: KBPS }, [samples.buffer]);
  });
}

/**
 * A recording or audio file → mono MP3 capped at MAX_SECONDS. (Videos are sent as they are; see lib/video.ts.)
 * Progress runs 0..1: decoding takes the first 30%, encoding the rest.
 */
export async function toMp3(blob: Blob, onProgress?: (p: number) => void): Promise<Processed> {
  onProgress?.(0.02);
  const buf = await decode(blob);
  onProgress?.(0.3);
  const channels = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
  const mono = normalize(downmix(channels, MAX_SECONDS * buf.sampleRate));
  if (mono.length < buf.sampleRate * 0.5) {
    throw new AudioError("That clip is too short. Give us at least a second or two.");
  }
  const shape = peaks(mono, 120);
  const durationSec = mono.length / buf.sampleRate;
  const mp3 = await encode(mono.slice(), (p) => onProgress?.(0.3 + p * 0.7));
  onProgress?.(1);
  return {
    mp3,
    durationSec,
    originalSec: buf.duration,
    trimmed: buf.duration > MAX_SECONDS + 0.5,
    peaks: shape,
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function base64ToBlob(b64: string, type = "audio/mpeg"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
