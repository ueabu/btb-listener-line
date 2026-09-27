import { MAX_SECONDS } from "../types";

const TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];

export class MicError extends Error {}

export interface Recording {
  /** Live level 0..1, for drawing while recording. */
  level(): number;
  elapsed(): number;
  stop(): Promise<Blob>;
  cancel(): void;
}

/** Start recording from the mic. Stops by itself at MAX_SECONDS and calls onAutoStop. */
export async function startRecording(onAutoStop: () => void): Promise<Recording> {
  // Browsers only expose the mic on https:// or localhost, e.g. not on http://192.168.x.x.
  if (!window.isSecureContext) {
    throw new MicError(
      "Recording needs a secure (https://) link. Open this page over https, or upload an audio or video file instead.",
    );
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new MicError("This browser can't record. Try uploading an audio or video file instead.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    throw new MicError("We couldn't use your microphone. Check the permission in your browser, or upload a file instead.");
  }

  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  const started = performance.now();
  const timer = window.setTimeout(onAutoStop, MAX_SECONDS * 1000);
  rec.start(250);

  const cleanup = () => {
    window.clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    level() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      return Math.min(1, Math.sqrt(sum / buf.length) * 4);
    },
    elapsed: () => Math.min(MAX_SECONDS, (performance.now() - started) / 1000),
    stop() {
      return new Promise((resolve) => {
        rec.onstop = () => {
          cleanup();
          resolve(new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" }));
        };
        if (rec.state === "inactive") rec.onstop(new Event("stop"));
        else rec.stop();
      });
    },
    cancel() {
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
      cleanup();
    },
  };
}
