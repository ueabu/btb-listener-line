"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Clip, Episode } from "@/lib/types";
import s from "./host.module.css";

interface Props {
  hostKey: string;
  episodes: Episode[];
  clips: Clip[];
  onSaved: (eps: Episode[]) => void;
}

function slug(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "episode";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function EpisodeManager({ hostKey, episodes, clips, onSaved }: Props) {
  const [draft, setDraft] = useState<Episode[]>(episodes);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Take server updates while there are no unsaved edits.
  // Unsaved edits = the draft differs from the last list we loaded (not from the incoming one).
  const [lastSeen, setLastSeen] = useState(episodes);
  const dirty = JSON.stringify(draft) !== JSON.stringify(lastSeen);
  if (lastSeen !== episodes && !dirty) {
    setLastSeen(episodes);
    setDraft(episodes);
  }
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(t);
  }, [status]);

  const set = (i: number, patch: Partial<Episode>) => setDraft((d) => d.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const swap = (i: number, j: number) =>
    setDraft((d) => {
      if (j < 0 || j >= d.length) return d;
      const n = d.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const clipCount = (id: string) => clips.filter((c) => c.episodeId === id).length;

  async function save() {
    const clean = draft
      .map((e) => ({ ...e, title: e.title.trim(), note: e.note?.trim() || undefined, description: e.description?.trim() || undefined }))
      .filter((e) => e.title);
    setError(null);
    setStatus("Saving…");
    try {
      const saved = await api.saveEpisodes(hostKey, clean);
      // An outdated Apps Script deployment drops fields it doesn't know. Keep the draft so nothing typed is lost.
      const dropped = clean.some((e) => e.description && !saved.find((x) => x.id === e.id)?.description);
      if (dropped) {
        setStatus(null);
        setError(
          "Saved, but the server didn't keep the descriptions. The deployed Apps Script is out of date: paste the latest Code.gs, then Deploy → Manage deployments → edit → New version → Deploy. Then save again.",
        );
        return;
      }
      setDraft(saved);
      setLastSeen(saved);
      onSaved(saved);
      setStatus("Saved. The listener page shows active episodes.");
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Couldn't save episodes.");
    }
  }

  return (
    <details className={s.episodes}>
      <summary>Upcoming episodes</summary>
      {/* <details> doesn't lay its children out as grid items, so the spacing lives on this wrapper. */}
      <div className={s.epBody}>
        <p className="hint" style={{ margin: 0 }}>
          Active episodes show up under &ldquo;An upcoming episode&rdquo; on the listener page, in this order. Archive one once it&apos;s recorded.
        </p>
        <div className={s.epList}>
          {draft.map((ep, i) => (
            <div key={ep.id} className={s.epCard}>
              <div className={s.epHead}>
                <label className={s.epField}>
                  <span className="eyebrow">Episode topic</span>
                  <input type="text" placeholder="e.g. The software development life cycle" value={ep.title} maxLength={120} onChange={(e) => set(i, { title: e.target.value })} />
                </label>
                <label className={s.epField}>
                  <span className="eyebrow">Status note</span>
                  <input type="text" placeholder="e.g. Recording soon" value={ep.note ?? ""} maxLength={80} onChange={(e) => set(i, { note: e.target.value })} />
                </label>
              </div>
              <label className={s.epField}>
                <span className="eyebrow">Description · shown to listeners</span>
                <textarea
                  rows={3}
                  placeholder="What we'll talk about, so listeners know what to ask. e.g. How teams really ship software, from planning to release, and which steps are worth keeping."
                  value={ep.description ?? ""}
                  maxLength={500}
                  onChange={(e) => set(i, { description: e.target.value })}
                />
              </label>
              <div className={s.epFoot}>
                <label className={s.epActive}>
                  <input type="checkbox" checked={ep.active} onChange={(e) => set(i, { active: e.target.checked })} /> Active
                </label>
                <span className={s.epBtns}>
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
                  <button type="button" aria-label="Move down" disabled={i === draft.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
                  <button
                    type="button"
                    aria-label={`Delete ${ep.title || "episode"}`}
                    disabled={clipCount(ep.id) > 0}
                    title={clipCount(ep.id) ? "Has clips. Archive it instead." : "Delete"}
                    onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                  >
                    Delete
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className={s.epActs}>
          <button type="button" className="btn btn-ghost" onClick={() => setDraft((d) => [...d, { id: slug("new"), title: "", note: "Recording soon", active: true }])}>
            Add episode
          </button>
          <button type="button" className="btn btn-ink" disabled={!dirty || status === "Saving…"} onClick={save}>
            Save episodes
          </button>
          {status && <span className={s.status} aria-live="polite">{status}</span>}
        </div>
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </details>
  );
}
