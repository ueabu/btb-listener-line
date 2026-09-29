import { dur } from "./format";
import { MAX_SECONDS } from "./types";

export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

export class VideoError extends Error {}

/** Why a video can't be sent, or null if it's fine. Pure, so it can be unit tested. */
export function videoProblem(durationSec: number, size: number): string | null {
  if (size > MAX_VIDEO_BYTES) return "That video is over 1 GB. Please send a shorter or smaller one.";
  if (!(durationSec > 0)) return "We couldn't read how long that video is. Try a different file.";
  // A little slack for rounding in phone recordings.
  if (durationSec > MAX_SECONDS + 0.5) {
    return `That video is ${dur(durationSec)}. Please trim it to ${dur(MAX_SECONDS)} or less and try again.`;
  }
  return null;
}

/** File types sometimes come through empty (e.g. .mov on some systems); fall back to the extension. */
export function videoMime(file: Pick<File, "type" | "name">): string {
  if (file.type.startsWith("video/")) return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  return { mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v", "3gp": "video/3gpp" }[ext ?? ""] ?? "video/mp4";
}

/** Read a video's duration from its metadata without loading the whole file. */
export function readDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (d: number) => {
      v.removeAttribute("src");
      v.load();
      resolve(d);
    };
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return done(v.duration);
      // Browser-recorded WebM often reports Infinity until you seek past the end.
      v.ondurationchange = () => Number.isFinite(v.duration) && done(v.duration);
      v.currentTime = 1e101;
    };
    v.onerror = () => reject(new VideoError("We couldn't open that video. Try a different file, or record audio instead."));
    v.src = url;
  });
}

/** Check a picked video. Returns its duration, or throws a VideoError with a message for the listener. */
export async function inspectVideo(file: File, url: string): Promise<number> {
  if (file.size > MAX_VIDEO_BYTES) throw new VideoError(videoProblem(0, file.size)!);
  const durationSec = await readDuration(url);
  const problem = videoProblem(durationSec, file.size);
  if (problem) throw new VideoError(problem);
  return durationSec;
}

/** True for video files, even when the browser leaves the type blank. Audio-typed files never count. */
export function isVideoFile(file: Pick<File, "type" | "name">): boolean {
  if (file.type.startsWith("video/")) return true;
  if (file.type) return false;
  return /\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(file.name);
}
