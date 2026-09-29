"use client";

import { useEffect, useState } from "react";
import type { UploadProgress as Progress } from "@/lib/api";
import { mb, timeLeft } from "@/lib/format";
import type { Stage } from "@/lib/send";
import s from "./listener.module.css";

interface Props {
  video: boolean;
  stage: Stage;
  progress: Progress | null;
  /** When the upload step began, for the time-left estimate. */
  uploadStart: number | null;
  /** Set when sending failed; the bar turns red and Try again appears. */
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
}

const STEPS: Record<"video" | "audio", { id: Stage; label: string }[]> = {
  video: [
    { id: "checking", label: "Checking" },
    { id: "uploading", label: "Uploading" },
    { id: "finishing", label: "Finishing" },
    { id: "done", label: "Done" },
  ],
  audio: [
    { id: "checking", label: "Checking" },
    { id: "uploading", label: "Sending" },
    { id: "done", label: "Done" },
  ],
};

export default function UploadProgress({ video, stage, progress, uploadStart, error, onCancel, onRetry, onBack }: Props) {
  const steps = STEPS[video ? "video" : "audio"];
  const current = steps.findIndex((st) => st.id === stage);
  const pct = progress && progress.total ? Math.min(100, Math.floor((progress.loaded / progress.total) * 100)) : 0;
  const showBar = video && stage === "uploading"; // also shown (red) when the upload step failed

  // Re-render once a second so the time-left estimate keeps moving between progress events.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!showBar || error) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [showBar, error]);
  const eta = progress && uploadStart && !error ? timeLeft(progress.loaded, progress.total, (now - uploadStart) / 1000) : null;

  // Screen readers hear the step and every 10%, not every progress event.
  const spoken = error
    ? `Upload failed. ${error}`
    : `${steps[current]?.label ?? ""}${showBar ? ` ${Math.floor(pct / 10) * 10}%` : ""}`;

  return (
    <div className={`${s.upload} ${error ? s.uploadFailed : ""}`}>
      <ol className={s.steps}>
        {steps.map((st, i) => {
          const state = i < current ? "done" : i === current ? (error ? "failed" : "current") : "todo";
          return (
            <li key={st.id} className={s[`step_${state}`]} aria-current={state === "current" ? "step" : undefined}>
              <span className={s.stepDot} aria-hidden="true">
                {state === "done" ? "✓" : state === "failed" ? "✕" : i + 1}
              </span>
              {st.label}
            </li>
          );
        })}
      </ol>

      {showBar && (
        <>
          <div className={s.bar} role="progressbar" aria-label="Upload progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className={s.barMeta}>
            <span className="mono">
              {pct}% · {mb(progress?.loaded ?? 0)} of {mb(progress?.total ?? 0)}
            </span>
            {eta && <span>{eta}</span>}
          </div>
        </>
      )}

      {error ? (
        <p className={s.uploadError}>{error}</p>
      ) : stage !== "done" ? (
        <p className={s.note}>{video ? "Keep this page open until it's done." : "Sending your clip…"}</p>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {spoken}
      </span>

      <div className={s.ctrl}>
        {error ? (
          <>
            <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>
            <button type="button" className="btn btn-ghost" onClick={onBack}>Back to the form</button>
          </>
        ) : (
          onCancel && stage !== "done" && stage !== "finishing" && (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>{video ? "Cancel upload" : "Cancel"}</button>
          )
        )}
      </div>
    </div>
  );
}
