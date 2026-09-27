"use client";

import Waveform from "@/components/Waveform";
import { dur } from "@/lib/format";
import { KINDS, type Clip, type Episode } from "@/lib/types";
import type { Loaded } from "./Board";
import s from "./host.module.css";

interface Props {
  clip: Clip;
  episodes: Episode[];
  shortlisted: boolean;
  passed: boolean;
  loaded?: Loaded;
  loading: boolean;
  playing: boolean;
  progress: number;
  onPlay: () => void;
  onSeek: (frac: number) => void;
  onToggleShortlist: () => void;
  onTogglePass: () => void;
}

const when = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Stable placeholder bars until the real audio is loaded. */
function placeholder(id: string): number[] {
  let seed = [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return Array.from({ length: 80 }, (_, i) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return ((seed / 2 ** 32) * 0.8 + 0.2) * (Math.sin((i / 80) * Math.PI) * 0.5 + 0.5);
  });
}

export default function ClipRow({ clip, episodes, shortlisted, passed, loaded, loading, playing, progress, ...on }: Props) {
  const kind = KINDS.find((k) => k.id === clip.kind)?.label ?? clip.kind;
  const destLabel = clip.dest === "lwit" ? "Last Week in Tech" : episodes.find((e) => e.id === clip.episodeId)?.title ?? "Upcoming";
  const fileName = `${clip.name.replace(/[^\w-]+/g, "-")}-${clip.kind}.mp3`;

  return (
    <div className={`${s.clip} ${passed ? s.passed : ""}`}>
      <button
        type="button"
        className={`${s.play} ${loading ? s.loading : playing ? s.pause : ""}`}
        aria-label={`${playing ? "Pause" : "Play"} ${clip.name}`}
        onClick={on.onPlay}
      />
      <div className={s.clipMain}>
        <div className={s.clipLine}>
          <span className={s.who}>{clip.name}</span>
          <span className="chip kind">{kind}</span>
          <span className={`chip ${clip.dest === "lwit" ? "lwit" : "upc"}`}>{destLabel}</span>
          {clip.fromVideo && <span className="chip video">from video</span>}
          {clip.source === "host" && <span className="chip video">added by host</span>}
        </div>
        {clip.summary && <div className={s.clipQ}>{clip.summary}</div>}
        <button
          type="button"
          className={s.miniBtn}
          aria-label={`Seek in ${clip.name}'s clip`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            on.onSeek((e.clientX - r.left) / r.width);
          }}
        >
          <Waveform className={s.mini} peaks={loaded?.peaks ?? placeholder(clip.id)} played={progress} color="--cobalt" dim="--pass" />
        </button>
        <div className={s.meta}>
          <span>{when.format(new Date(clip.createdAt))}</span>
          {clip.email && <a href={`mailto:${clip.email}`}>{clip.email}</a>}
        </div>
      </div>
      <div className={s.clipSide}>
        <span className={`${s.dur} mono`}>{dur(clip.durationSec)}</span>
        <div className={s.acts}>
          <button type="button" className={s.shortlist} aria-pressed={shortlisted} onClick={on.onToggleShortlist}>
            {shortlisted ? "Shortlisted" : "Shortlist"}
          </button>
          <button type="button" onClick={on.onTogglePass}>{passed ? "Undo" : "Pass"}</button>
          {loaded ? (
            <a href={loaded.url} download={fileName}>MP3</a>
          ) : (
            clip.url && <a href={clip.url} target="_blank" rel="noreferrer">Drive</a>
          )}
        </div>
      </div>
    </div>
  );
}
