"use client";

import { parseSpeaker } from "@/lib/intro";
import { KINDS, type Dest, type Kind } from "@/lib/types";
import s from "./listener.module.css";

interface Props {
  kind: Kind;
  onChange: (k: Kind) => void;
  name: string;
  dest: Dest;
  episodeTitle?: string;
}

export default function KindPicker({ kind, onChange, name, dest, episodeTitle }: Props) {
  const { name: who, city, country } = parseSpeaker(name);
  const welcome =
    dest === "lwit"
      ? "Welcome to Last Week in Tech, a series in the Beyond the Build Podcast"
      : `Welcome to the Beyond the Build Podcast${episodeTitle ? `, where we're talking about ${episodeTitle.toLowerCase()}` : ""}`;
  return (
    <div className={s.field}>
      <span className={s.label} id="kind-label">What are you sending?</span>
      <div className={s.kinds} role="radiogroup" aria-labelledby="kind-label">
        {KINDS.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => onChange(k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      {kind === "intro" && (
        <div className={s.script}>
          <span className="eyebrow">Read this line to open the segment:</span>
          <p>
            &ldquo;Hello everyone, this is {who} and I am recording from {city} in {country}. {welcome}.&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
