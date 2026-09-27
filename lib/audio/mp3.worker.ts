/// <reference lib="webworker" />
import { Mp3Encoder } from "@breezystack/lamejs";
import { floatTo16 } from "./samples";

export interface EncodeRequest {
  samples: Float32Array;
  sampleRate: number;
  kbps: number;
}

export type EncodeMessage =
  | { type: "progress"; value: number }
  | { type: "done"; blob: Blob }
  | { type: "error"; message: string };

const FRAME = 1152;

self.onmessage = (e: MessageEvent<EncodeRequest>) => {
  try {
    const { samples, sampleRate, kbps } = e.data;
    const pcm = floatTo16(samples);
    const enc = new Mp3Encoder(1, sampleRate, kbps);
    const parts: Uint8Array[] = [];
    const every = FRAME * 200;
    for (let i = 0; i < pcm.length; i += FRAME) {
      const out = enc.encodeBuffer(pcm.subarray(i, i + FRAME));
      if (out.length) parts.push(new Uint8Array(out));
      if (i % every === 0) post({ type: "progress", value: i / pcm.length });
    }
    const tail = enc.flush();
    if (tail.length) parts.push(new Uint8Array(tail));
    post({ type: "done", blob: new Blob(parts as BlobPart[], { type: "audio/mpeg" }) });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

function post(m: EncodeMessage) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);
}
