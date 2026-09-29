import { api, uploadVideo, type UploadProgress } from "./api";
import { blobToBase64, type Processed } from "./audio/process";
import type { SubmissionMeta } from "./types";
import { videoMime } from "./video";

/** A clip ready to send. `url` is an object URL for previewing it; whoever drops the take revokes it. */
export type AudioTake = Processed & { kind: "audio"; fileName?: string; url: string };
export type VideoTake = { kind: "video"; file: File; fileName: string; durationSec: number; url: string };
export type Take = AudioTake | VideoTake;

/** Checking → Uploading (video) or Sending (audio) → Finishing (video only) → Done. */
export type Stage = "checking" | "uploading" | "finishing" | "done";

interface SendOptions {
  key?: string;
  signal?: AbortSignal;
  onStage?: (stage: Stage) => void;
  onProgress?: (p: UploadProgress) => void;
}

export async function sendTake(take: Take, meta: Omit<SubmissionMeta, "durationSec">, opts: SendOptions = {}): Promise<void> {
  const { key, signal, onStage, onProgress } = opts;
  const durationSec = Math.round(take.durationSec * 10) / 10;

  if (take.kind === "audio") {
    onStage?.("checking");
    const audio = await blobToBase64(take.mp3);
    onStage?.("uploading");
    onProgress?.({ loaded: 0, total: take.mp3.size });
    await api.submit({ ...meta, durationSec, fromVideo: false, audio }, key);
    onProgress?.({ loaded: take.mp3.size, total: take.mp3.size });
    onStage?.("done");
    return;
  }

  onStage?.("checking");
  const { ticket, uploadUrl } = await api.startVideo(
    {
      ...meta,
      durationSec,
      mimeType: videoMime(take.file),
      size: take.file.size,
      fileName: take.file.name,
      origin: window.location.origin,
    },
    key,
  );
  onStage?.("uploading");
  onProgress?.({ loaded: 0, total: take.file.size });
  const { id } = await uploadVideo(uploadUrl, take.file, (p) => onProgress?.(p), signal);
  onStage?.("finishing");
  await api.finishVideo(ticket, id);
  onStage?.("done");
}
