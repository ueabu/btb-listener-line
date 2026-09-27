"use client";

import { useEffect, useRef, useState } from "react";
import { drawBars, useRedraw } from "@/components/Waveform";
import Waveform from "@/components/Waveform";
import { usePlayer } from "@/components/usePlayer";
import { startRecording, type Recording } from "@/lib/audio/record";
import { toMp3, type Processed } from "@/lib/audio/process";
import { dur, kb, tc } from "@/lib/format";
import { MAX_SECONDS } from "@/lib/types";
import s from "./listener.module.css";

/** `url` is an object URL for the MP3; whoever drops the take revokes it. */
export type Take = Processed & { fromVideo: boolean; fileName?: string; url: string };
type Tab = "record" | "audio" | "video";
type Phase = "idle" | "recording" | "processing" | "ready";

const ACCEPT: Record<Exclude<Tab, "record">, string> = {
  audio: "audio/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.flac",
  video: "video/*,.mp4,.mov,.webm,.m4v",
};

interface Props {
  take: Take | null;
  onTake: (t: Take | null) => void;
  disabled?: boolean;
}

export default function Recorder({ take, onTake, disabled }: Props) {
  const [tab, setTab] = useState<Tab>("record");
  const [phase, setPhase] = useState<Phase>(take ? "ready" : "idle");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const rec = useRef<Recording | null>(null);

  useEffect(() => () => rec.current?.cancel(), []);

  async function process(blob: Blob, fromVideo: boolean, fileName?: string) {
    setPhase("processing");
    setProgress(0);
    setError(null);
    try {
      const out = await toMp3(blob, setProgress);
      onTake({ ...out, fromVideo, fileName, url: URL.createObjectURL(out.mp3) });
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong with that audio.");
      setPhase("idle");
    }
  }

  async function start() {
    setError(null);
    try {
      rec.current = await startRecording(() => void stop());
      setElapsed(0);
      setPhase("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start recording.");
    }
  }

  async function stop() {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    const blob = await r.stop();
    await process(blob, false);
  }

  function reset() {
    rec.current?.cancel();
    rec.current = null;
    if (take) URL.revokeObjectURL(take.url);
    onTake(null);
    setFileLabel(null);
    setError(null);
    setPhase("idle");
  }

  function pickFile(file: File | undefined, kind: "audio" | "video") {
    if (!file) return;
    setFileLabel(file.name);
    const isVideo = kind === "video" || file.type.startsWith("video/");
    void process(file, isVideo, file.name);
  }

  const busy = phase === "recording" || phase === "processing";

  return (
    <fieldset className={s.field} disabled={disabled}>
      <legend className={s.label}>Record it</legend>
      <div className={s.tabs} role="tablist" aria-label="How to add your clip">
        {(["record", "audio", "video"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            disabled={busy}
            onClick={() => {
              setTab(t);
              if (phase !== "ready") setError(null);
            }}
          >
            {t === "record" ? "Record" : t === "audio" ? "Audio file" : "Video file"}
          </button>
        ))}
      </div>

      {phase === "ready" && take ? (
        <Ready take={take} onReset={reset} />
      ) : phase === "processing" ? (
        <div className={s.recorder} aria-live="polite">
          {fileLabel && (
            <div className={s.filePill}>
              <span>{fileLabel}</span>
            </div>
          )}
          <p className={s.note}>
            {tab === "video" ? "Pulling the audio out of your video…" : "Getting your audio ready…"}
          </p>
          <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      ) : tab === "record" ? (
        <Live phase={phase} rec={rec} elapsed={elapsed} setElapsed={setElapsed} onStart={start} onStop={stop} onReset={reset} />
      ) : (
        <FilePick kind={tab} onFile={(f) => pickFile(f, tab)} />
      )}

      {error && <div className="error" role="alert">{error}</div>}
      {tab === "video" && phase !== "ready" && (
        <p className={s.note}>
          Sending a video? We only keep the sound. The audio is pulled out on your device before upload, so the video itself is never sent.
        </p>
      )}
    </fieldset>
  );
}

function Live({
  phase, rec, elapsed, setElapsed, onStart, onStop, onReset,
}: {
  phase: Phase;
  rec: React.RefObject<Recording | null>;
  elapsed: number;
  setElapsed: (n: number) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const levels = useRef<number[]>([]);
  const recording = phase === "recording";

  useRedraw(canvas, () => canvas.current && drawBars(canvas.current, levels.current, 1, "--cobalt", "--line"));

  useEffect(() => {
    if (!recording) return;
    levels.current = [];
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const r = rec.current;
      if (r && canvas.current) {
        if (t - last > 60) {
          last = t;
          levels.current.push(r.level());
          const max = Math.floor(canvas.current.clientWidth / 7);
          if (levels.current.length > max) levels.current.splice(0, levels.current.length - max);
          drawBars(canvas.current, padLeft(levels.current, max), 1, "--cobalt", "--line");
          setElapsed(r.elapsed());
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [recording, rec, setElapsed]);

  return (
    <div className={s.recorder}>
      <div className={s.recMeta}>
        {recording ? <span className={s.recLive}>Recording</span> : <span className={s.recIdle}>Ready when you are</span>}
        <span className={`${s.timer} mono`} aria-live="off">
          <b>{tc(elapsed)}</b> / {tc(MAX_SECONDS)}
        </span>
      </div>
      <canvas ref={canvas} className={s.wave} aria-hidden="true" />
      <div className={s.ctrl}>
        {recording ? (
          <>
            <button type="button" className={`btn btn-ink ${s.btnStop}`} onClick={onStop}>Stop</button>
            <button type="button" className="btn btn-ghost" onClick={onReset}>Start over</button>
          </>
        ) : (
          <button type="button" className={`btn btn-ink ${s.btnRec}`} onClick={onStart}>Start recording</button>
        )}
      </div>
    </div>
  );
}

function padLeft(values: number[], n: number) {
  return values.length >= n ? values : [...Array(n - values.length).fill(0), ...values];
}

function FilePick({ kind, onFile }: { kind: "audio" | "video"; onFile: (f: File | undefined) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      className={`${s.pick} ${dragging ? s.dragging : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFile(e.dataTransfer.files[0]);
      }}
    >
      <input type="file" accept={ACCEPT[kind]} onChange={(e) => onFile(e.target.files?.[0])} />
      <b>Choose {kind === "audio" ? "an audio" : "a video"} file</b>
      <span className="hint">
        {kind === "audio" ? "mp3, m4a, wav and most voice memos" : "mp4, mov or webm"} · first {tc(MAX_SECONDS)} is used
      </span>
    </label>
  );
}

function Ready({ take, onReset }: { take: Take; onReset: () => void }) {
  const player = usePlayer(take.url);

  return (
    <div className={s.recorder}>
      <div className={s.filePill}>
        <span>{take.fileName ?? "Your recording"}</span>
        <span className="mono">
          {dur(take.durationSec)} · {kb(take.mp3.size)}
        </span>
      </div>
      <button
        type="button"
        className={s.waveBtn}
        aria-label="Seek"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          player.seek((e.clientX - r.left) / r.width);
          player.play();
        }}
      >
        <Waveform className={s.wave} peaks={take.peaks} played={player.progress} dim="--pass" label="Your clip" />
      </button>
      {take.trimmed && (
        <p className={s.note}>
          That was {dur(take.originalSec)} long, so we kept the first {tc(MAX_SECONDS)}.
        </p>
      )}
      <p className={s.note}>Listen back before you send. You can redo it anytime.</p>
      <div className={s.ctrl}>
        <button type="button" className={`btn btn-ink ${s.btnPlay}`} onClick={player.toggle}>
          {player.playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onReset}>Redo</button>
      </div>
    </div>
  );
}
