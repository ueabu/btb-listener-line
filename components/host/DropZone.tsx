"use client";

import { useState } from "react";
import { toMp3 } from "@/lib/audio/process";
import { mb } from "@/lib/format";
import { sendTake, type Take } from "@/lib/send";
import { LWIT, type Kind } from "@/lib/types";
import { inspectVideo, isVideoFile } from "@/lib/video";
import s from "./host.module.css";

interface Props {
  hostKey: string;
  segKey: string;
  onAdded: () => void;
}

/** Guess the clip type from a file name like "amara-intro.m4a". */
function guessKind(name: string): Kind {
  const n = name.toLowerCase();
  if (n.includes("intro")) return "intro";
  if (n.includes("thought")) return "thought";
  return "question";
}

export default function DropZone({ hostKey, segKey, onAdded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    for (const [i, file] of list.entries()) {
      const prefix = list.length > 1 ? `${i + 1}/${list.length} · ` : "";
      const isVideo = isVideoFile(file);
      let url: string | null = null;
      try {
        let take: Take;
        if (isVideo) {
          // Videos are kept as video and go straight to Drive.
          setStatus(`${prefix}Checking ${file.name}…`);
          url = URL.createObjectURL(file);
          take = { kind: "video", file, fileName: file.name, durationSec: await inspectVideo(file, url), url };
        } else {
          setStatus(`${prefix}Converting ${file.name}…`);
          const out = await toMp3(file);
          take = { kind: "audio", ...out, fileName: file.name, url: "" };
        }
        await sendTake(
          take,
          {
            name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Listener",
            kind: guessKind(file.name),
            dest: segKey === LWIT ? "lwit" : "upcoming",
            episodeId: segKey === LWIT ? undefined : segKey,
            consent: true,
            source: "host",
            elapsedMs: 0,
          },
          {
            key: hostKey,
            onStage: (st) => st === "finishing" && setStatus(`${prefix}Finishing ${file.name}…`),
            onProgress: ({ loaded, total }) =>
              setStatus(
                isVideo
                  ? `${prefix}Uploading ${file.name}… ${total ? Math.floor((loaded / total) * 100) : 0}% · ${mb(loaded)} of ${mb(total)}`
                  : `${prefix}Uploading ${file.name}…`,
              ),
          },
        );
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
      } finally {
        if (url) URL.revokeObjectURL(url);
      }
    }
    setStatus(null);
    onAdded();
  }


  return (
    <>
      <label
        className={`${s.drop} ${dragging ? s.dragging : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void add(e.dataTransfer.files);
        }}
      >
        <input type="file" multiple accept="audio/*,video/*" disabled={!!status} onChange={(e) => void add(e.target.files)} />
        <span aria-live="polite">
          {status ?? (
            <>
              <b>Drop audio or video files here</b> · videos are kept as video
            </>
          )}
        </span>
        <span className="mono">mp3 · m4a · wav · mp4 · mov</span>
      </label>
      {error && <div className="error" role="alert">{error}</div>}
    </>
  );
}
