"use client";

import { KINDS, type Dest, type Kind } from "@/lib/types";
import s from "./listener.module.css";

interface Props {
  kind: Kind;
  onChange: (k: Kind) => void;
  name: string;
  dest: Dest;
  episodeTitle?: string;
}

/** "Tobi from London" / "Tobi in London" → { who: "Tobi", where: "London" }. */
export function splitName(name: string): { who: string; where: string } {
  const [who, where] = name.trim().split(/\s+(?:from|in)\s+/i, 2);
  return { who: who || "[your name]", where: where?.trim() || "[where you are]" };
}

export default function KindPicker({ kind, onChange, name, dest, episodeTitle }: Props) {
  const { who, where } = splitName(name);
  const welcome =
    dest === "lwit"
      ? "welcome to Last Week in Tech, a series in the Beyond the Build episode"
      : `welcome to Beyond the Build${episodeTitle ? `, where we're talking about ${episodeTitle.toLowerCase()}` : ""}`;
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
            &ldquo;Hello, my name is {who} and I am recording from {where}, and {welcome}.&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
