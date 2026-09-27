"use client";

import type { Dest, Episode } from "@/lib/types";
import s from "./listener.module.css";

interface Props {
  dest: Dest;
  episodeId: string | null;
  episodes: Episode[] | null;
  onChange: (dest: Dest, episodeId: string | null) => void;
}

export default function DestinationPicker({ dest, episodeId, episodes, onChange }: Props) {
  const hasUpcoming = !!episodes?.length;
  return (
    <fieldset className={s.field}>
      <legend className={s.label}>Where should it go?</legend>
      <div className={`${s.dest} ${hasUpcoming ? "" : s.single}`}>
        <button type="button" className={s.destOpt} aria-pressed={dest === "lwit"} onClick={() => onChange("lwit", null)}>
          <span className={s.destTop}>
            <b>Last Week in Tech</b>
            <span className={s.tag}>Weekly</span>
          </span>
          <span>Our weekly segment. Any question or thought about this week in tech.</span>
        </button>
        {hasUpcoming && (
          <button
            type="button"
            className={s.destOpt}
            aria-pressed={dest === "upcoming"}
            onClick={() => onChange("upcoming", episodeId ?? episodes![0].id)}
          >
            <span className={s.destTop}>
              <b>An upcoming episode</b>
              <span className={s.tag}>Planned</span>
            </span>
            <span>Pick a topic we&apos;re recording soon and we&apos;ll play it in that episode.</span>
          </button>
        )}
        {dest === "upcoming" && hasUpcoming && <EpisodeDropdown episodes={episodes!} episodeId={episodeId} onPick={(id) => onChange("upcoming", id)} />}
      </div>
    </fieldset>
  );
}

interface PickerProps {
  episodes: Episode[];
  episodeId: string | null;
  onPick: (id: string) => void;
}

/** Titles in a dropdown; the chosen episode's details in a card below. */
function EpisodeDropdown({ episodes, episodeId, onPick }: PickerProps) {
  const ep = episodes.find((e) => e.id === episodeId) ?? episodes[0];
  return (
    <div className={s.episodePick}>
      <label className={s.pickLabel} htmlFor="episode">
        <span className="eyebrow">Recording for</span>
        <select id="episode" value={ep.id} onChange={(e) => onPick(e.target.value)}>
          {episodes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </label>
      {(ep.description || ep.note) && (
        <div className={s.episodeCard} aria-live="polite">
          {ep.note && <span className={s.tag} style={{ justifySelf: "start" }}>{ep.note}</span>}
          {ep.description && <p className={s.episodeDesc}>{ep.description}</p>}
        </div>
      )}
    </div>
  );
}
