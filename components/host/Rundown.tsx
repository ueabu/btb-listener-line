"use client";

import { useState } from "react";
import { dur, tc } from "@/lib/format";
import { budgetPct, showNotes, type Slot } from "@/lib/rundown";
import { KINDS, type SegmentState } from "@/lib/types";
import s from "./host.module.css";

interface Props {
  title: string;
  seg: SegmentState;
  slots: Slot[];
  total: number;
  onChange: (fn: (seg: SegmentState) => SegmentState) => void;
}

const TARGETS = [4, 5, 6, 8, 10, 12, 15];
const DISCUSSION = [0, 30, 60, 90, 120, 180, 240, 300];

function move(order: string[], from: number, to: number) {
  const next = order.slice();
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export default function Rundown({ title, seg, slots, total, onChange }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const pct = budgetPct(total, seg.targetSec);
  const over = total > seg.targetSec;

  // Reorder by position among visible slots, mapped back onto seg.order ids.
  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= slots.length) return;
    const ids = slots.map((sl) => sl.clip.id);
    const moved = move(ids, from, to);
    onChange((sg) => ({ ...sg, order: [...moved, ...sg.order.filter((id) => !ids.includes(id))] }));
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(showNotes(title, slots, total));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert("Couldn't copy. Your browser blocked clipboard access.");
    }
  }

  return (
    <aside className={s.rundown} aria-label="Segment rundown">
      <div className={s.rdHead}>
        <span className="eyebrow">Segment rundown</span>
        <h3>{title}</h3>
        <div className={s.budget}>
          <div className={`${s.budgetBar} ${over ? s.over : ""}`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className={s.budgetRow}>
            <span className="mono">
              {tc(total)} of{" "}
              <select
                aria-label="Target length"
                value={seg.targetSec}
                onChange={(e) => onChange((sg) => ({ ...sg, targetSec: +e.target.value }))}
              >
                {[...new Set([...TARGETS.map((m) => m * 60), seg.targetSec])].sort((a, b) => a - b).map((sec) => (
                  <option key={sec} value={sec}>{tc(sec)}</option>
                ))}
              </select>{" "}
              target
            </span>
            <span>{slots.length} clip{slots.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>

      {slots.length === 0 ? (
        <p className={s.slotNote}>Shortlist clips from the inbox and they&apos;ll line up here.</p>
      ) : (
        <ol className={s.slots}>
          {slots.map((sl, i) => (
            <li
              key={sl.clip.id}
              className={`${s.slot} ${dragIdx === i ? s.dragging : ""} ${overIdx === i && dragIdx !== i ? s.over : ""}`}
              draggable
              onDragStart={(e) => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null) reorder(dragIdx, i);
                setDragIdx(null);
                setOverIdx(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setOverIdx(null);
              }}
            >
              <span className={s.grip} aria-hidden="true" />
              <span className={`${s.tc} mono`}>{tc(sl.start)}</span>
              <span className={s.slotT}>
                <b>
                  {sl.clip.name}
                  {sl.clip.summary ? ` · ${sl.clip.summary}` : ""}
                </b>
                <span>
                  {dur(sl.clip.durationSec)} clip{sl.discussion ? ` + ${dur(sl.discussion)} talk` : ""}
                </span>
              </span>
              <span className="chip kind">{KINDS.find((k) => k.id === sl.clip.kind)?.label}</span>
              <span className={s.slotCtl}>
                <label>
                  Talk after{" "}
                  <select
                    value={sl.discussion}
                    onChange={(e) =>
                      onChange((sg) => ({ ...sg, discussion: { ...sg.discussion, [sl.clip.id]: +e.target.value } }))
                    }
                  >
                    {[...new Set([...DISCUSSION, sl.discussion])].sort((a, b) => a - b).map((sec) => (
                      <option key={sec} value={sec}>{sec ? dur(sec) : "none"}</option>
                    ))}
                  </select>
                </label>
                <span className={s.spacer} />
                <button type="button" aria-label={`Move ${sl.clip.name} up`} disabled={i === 0} onClick={() => reorder(i, i - 1)}>↑</button>
                <button type="button" aria-label={`Move ${sl.clip.name} down`} disabled={i === slots.length - 1} onClick={() => reorder(i, i + 1)}>↓</button>
                <button
                  type="button"
                  aria-label={`Remove ${sl.clip.name} from rundown`}
                  onClick={() => onChange((sg) => ({ ...sg, order: sg.order.filter((id) => id !== sl.clip.id) }))}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className={s.slotNote}>Timecodes add each clip plus the talk time after it. Intros default to no talk, everything else to a minute.</p>
      <button type="button" className={s.export} onClick={copy} disabled={!slots.length}>
        {copied ? "Copied" : "Copy rundown for show notes"}
      </button>
    </aside>
  );
}
