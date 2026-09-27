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
        {dest === "upcoming" && hasUpcoming && (
          <div className={s.upcoming} role="radiogroup" aria-label="Upcoming episodes">
            {episodes!.map((ep) => (
              <label key={ep.id} className={s.epOpt}>
                <input type="radio" name="episode" checked={episodeId === ep.id} onChange={() => onChange("upcoming", ep.id)} />
                <span>
                  <b>{ep.title}</b>
                  {ep.description && <span className={s.epDesc}>{ep.description}</span>}
                  {ep.note && <span className="hint">{ep.note}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  );
}
