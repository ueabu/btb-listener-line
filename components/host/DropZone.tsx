"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { blobToBase64, toMp3 } from "@/lib/audio/process";
import { LWIT, type Kind } from "@/lib/types";
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
      try {
        setStatus(`${prefix}Converting ${file.name}…`);
        const out = await toMp3(file);
        setStatus(`${prefix}Uploading ${file.name}…`);
        await api.submit(
          {
            name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Listener",
            kind: guessKind(file.name),
            dest: segKey === LWIT ? "lwit" : "upcoming",
            episodeId: segKey === LWIT ? undefined : segKey,
            fromVideo: file.type.startsWith("video/"),
            durationSec: Math.round(out.durationSec * 10) / 10,
            consent: true,
            source: "host",
            elapsedMs: 0,
            audio: await blobToBase64(out.mp3),
          },
          hostKey,
        );
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
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
              <b>Drop audio or video files here</b> · video is converted to audio
            </>
          )}
        </span>
        <span className="mono">mp3 · m4a · wav · mp4 · mov</span>
      </label>
      {error && <div className="error" role="alert">{error}</div>}
    </>
  );
}
