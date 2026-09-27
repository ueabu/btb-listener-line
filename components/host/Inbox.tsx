"use client";

import { useState } from "react";
import { KINDS, type Clip, type Episode, type Kind, type SegmentState } from "@/lib/types";
import type { Loaded } from "./Board";
import ClipRow from "./ClipRow";
import DropZone from "./DropZone";
import s from "./host.module.css";

type Filter = "all" | Kind | "shortlisted";

interface Props {
  clips: Clip[];
  seg: SegmentState;
  loading: boolean;
  episodes: Episode[];
  segKey: string;
  hostKey: string;
  loaded: Record<string, Loaded>;
  loadingId: string | null;
  currentId: string | null;
  playing: boolean;
  progress: number;
  onPlay: (id: string) => void;
  onSeek: (id: string, frac: number) => void;
  onToggleShortlist: (id: string) => void;
  onTogglePass: (id: string) => void;
  onAdded: () => void;
}

export default function Inbox(p: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = p.clips
    .filter((c) => (filter === "all" ? true : filter === "shortlisted" ? p.seg.order.includes(c.id) : c.kind === filter))
    // Passed clips sink to the bottom; otherwise newest first.
    .sort((a, b) => Number(p.seg.passed.includes(a.id)) - Number(p.seg.passed.includes(b.id)) || b.createdAt.localeCompare(a.createdAt));

  const filters: [Filter, string][] = [["all", "All"], ...KINDS.map((k) => [k.id, k.plural] as [Filter, string]), ["shortlisted", "Shortlisted"]];

  return (
    <section className={s.inbox} aria-label="Inbox">
      <div className={s.filters} role="group" aria-label="Filter clips">
        {filters.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <DropZone hostKey={p.hostKey} segKey={p.segKey} onAdded={p.onAdded} />

      <div>
        {p.loading ? (
          <p className={s.empty}>Loading…</p>
        ) : shown.length === 0 ? (
          <p className={s.empty}>{p.clips.length ? "Nothing matches this filter." : "No clips for this segment yet."}</p>
        ) : (
          shown.map((c) => (
            <ClipRow
              key={c.id}
              clip={c}
              episodes={p.episodes}
              shortlisted={p.seg.order.includes(c.id)}
              passed={p.seg.passed.includes(c.id)}
              loaded={p.loaded[c.id]}
              loading={p.loadingId === c.id}
              playing={p.currentId === c.id && p.playing}
              progress={p.currentId === c.id ? p.progress : 0}
              onPlay={() => p.onPlay(c.id)}
              onSeek={(f) => p.onSeek(c.id, f)}
              onToggleShortlist={() => p.onToggleShortlist(c.id)}
              onTogglePass={() => p.onTogglePass(c.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
