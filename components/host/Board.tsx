"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, isMock } from "@/lib/api";
import { base64ToBlob, decode } from "@/lib/audio/process";
import { peaks } from "@/lib/audio/samples";
import { tc, weekLabel } from "@/lib/format";
import { buildSlots } from "@/lib/rundown";
import { emptySegment, LWIT, segmentKey, type BoardState, type Clip, type Episode, type SegmentState } from "@/lib/types";
import { usePlayer } from "@/components/usePlayer";
import EpisodeManager from "./EpisodeManager";
import Inbox from "./Inbox";
import Rundown from "./Rundown";
import s from "./host.module.css";

export interface Loaded {
  url: string;
  peaks: number[];
}

interface Props {
  hostKey: string;
  onLogout: () => void;
}

const SAVE_DELAY = 800;

export default function Board({ hostKey, onLogout }: Props) {
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [board, setBoard] = useState<BoardState>({ updatedAt: new Date(0).toISOString(), segments: {} });
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [segKey, setSegKey] = useState(LWIT);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "pending" | "saving" | "saved">("idle");
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  /** The video clip whose inline player is open (one at a time). */
  const [videoId, setVideoId] = useState<string | null>(null);

  // Saves run one at a time. `base` is the server's updatedAt for the board we last saw; a save
  // made from an older base is a real conflict (another tab or person). Edits made while a save
  // is in flight are queued and sent after it, from the new base, and are never overwritten.
  const base = useRef(board.updatedAt);
  const latest = useRef(board);
  const saveTimer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);
  const queued = useRef(false);

  const player = usePlayer(currentId ? loaded[currentId]?.url ?? null : null, true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.list(hostKey);
      setClips(data.clips);
      setEpisodes(data.episodes);
      // Don't clobber edits that are waiting to save or saving.
      if (saveTimer.current === undefined && !inFlight.current && !queued.current) {
        setBoard(data.board);
        latest.current = data.board;
        base.current = data.board.updatedAt;
      }
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === "unauthorized") return onLogout();
      setError(e instanceof Error ? e.message : "Couldn't load clips.");
    }
  }, [hostKey, onLogout]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void refresh();
    const onFocus = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [refresh]);

  const flush = useCallback(async () => {
    saveTimer.current = undefined;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setSaving("saving");
    let ok = true;
    // Keep saving until what's on the server matches what's on screen.
    for (;;) {
      queued.current = false;
      const sent = latest.current;
      try {
        const res = await api.saveBoard(hostKey, sent, base.current);
        base.current = res.board.updatedAt;
        if (res.conflict) {
          setNotice("The board was changed somewhere else (another tab or device), so it's been reloaded with that version.");
          latest.current = res.board;
          setBoard(res.board);
          break;
        }
        if (latest.current !== sent) {
          // Newer edits are on screen: keep them and send them next, from the new base.
          continue;
        }
        // Nothing changed while saving; pick up the server's updatedAt.
        latest.current = res.board;
        setBoard(res.board);
      } catch (e) {
        ok = false;
        setError(e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save the board.");
        break;
      }
      if (!queued.current) break;
    }
    inFlight.current = false;
    setSaving(!ok ? "idle" : saveTimer.current !== undefined ? "pending" : "saved");
  }, [hostKey]);

  const updateSeg = useCallback(
    (key: string, fn: (seg: SegmentState) => SegmentState) => {
      const b = latest.current;
      const next = { ...b, segments: { ...b.segments, [key]: fn(b.segments[key] ?? emptySegment()) } };
      latest.current = next;
      setBoard(next);
      setSaving("pending");
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void flush(), SAVE_DELAY);
    },
    [flush],
  );

  const seg = board.segments[segKey] ?? emptySegment();
  const segClips = useMemo(
    () =>
      (clips ?? []).filter(
        (c) => segmentKey(c) === segKey && (segKey !== LWIT || !seg.since || c.createdAt >= seg.since),
      ),
    [clips, segKey, seg.since],
  );
  const { slots, total } = buildSlots(segClips, seg);
  const newCount = segClips.filter((c) => !seg.order.includes(c.id) && !seg.passed.includes(c.id)).length;

  const lwitWeek = weekLabel(board.segments[LWIT]?.since);
  const title = segKey === LWIT ? "Last Week in Tech" : episodes.find((e) => e.id === segKey)?.title ?? "Episode";

  async function playClip(id: string) {
    // Videos play in Drive's player inside the row; nothing to download first.
    if (clips?.find((c) => c.id === id)?.media === "video") {
      setCurrentId(null);
      setVideoId((v) => (v === id ? null : id));
      return;
    }
    setVideoId(null);
    if (currentId === id && loaded[id]) return player.toggle();
    if (!loaded[id]) {
      setLoadingId(id);
      try {
        const { audio } = await api.clip(hostKey, id);
        const blob = base64ToBlob(audio);
        const buf = await decode(blob);
        const entry = { url: URL.createObjectURL(blob), peaks: peaks(buf.getChannelData(0), 160) };
        setLoaded((l) => ({ ...l, [id]: entry }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load that clip.");
        setLoadingId(null);
        return;
      }
      setLoadingId(null);
    }
    setCurrentId(id);
  }

  function startNewWeek() {
    if (!confirm("Start a new week? This clears the Last Week in Tech rundown and hides older clips from this view. The clips stay in Drive.")) return;
    updateSeg(LWIT, (sg) => ({ ...emptySegment(), targetSec: sg.targetSec, since: new Date().toISOString() }));
  }

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        {error && <div className="error" role="alert">{error}</div>}
        {notice && (
          <div className={s.notice} role="status">
            {notice}{" "}
            <button type="button" className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setNotice(null)}>
              OK
            </button>
          </div>
        )}

        <div className={s.board}>
          <div className={s.top}>
            <span className={`wordmark ${s.wm}`}>
              Beyond the <i>Build</i> · Listener line
            </span>
            <div className={s.epPick}>
              <label className="eyebrow" htmlFor="bep">Building segment for</label>
              <select id="bep" value={segKey} onChange={(e) => setSegKey(e.target.value)}>
                <option value={LWIT}>Last Week in Tech · {lwitWeek}</option>
                {episodes.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.active ? "Upcoming" : "Archived"} · {ep.title}
                  </option>
                ))}
              </select>
            </div>
            <div className={s.stats}>
              <div className={s.stat}><span className="eyebrow">New</span><b>{newCount}</b></div>
              <div className={s.stat}><span className="eyebrow">Shortlisted</span><b>{slots.length}</b></div>
              <div className={s.stat}><span className="eyebrow">Segment</span><b>{tc(total)}</b></div>
            </div>
          </div>

          <div className={s.toolbar}>
            <span aria-live="polite">
              {clips === null ? "Loading…" : saving === "pending" || saving === "saving" ? "Saving…" : saving === "saved" ? "All changes saved" : isMock ? "Dev mode · local mock data" : `${clips.length} clips in Drive`}
            </span>
            <span className={s.toolbarActs}>
              <button type="button" onClick={() => void refresh()}>Refresh</button>
              {segKey === LWIT && <button type="button" onClick={startNewWeek}>Start new week</button>}
              <button type="button" onClick={onLogout}>Lock</button>
            </span>
          </div>

          <div className={s.main}>
            <Inbox
              clips={segClips}
              seg={seg}
              loading={clips === null}
              episodes={episodes}
              segKey={segKey}
              hostKey={hostKey}
              loaded={loaded}
              loadingId={loadingId}
              currentId={currentId}
              videoId={videoId}
              playing={player.playing}
              progress={player.progress}
              onPlay={playClip}
              onSeek={(id, f) => {
                if (currentId === id) player.seek(f);
                else void playClip(id);
              }}
              onToggleShortlist={(id) =>
                updateSeg(segKey, (sg) => ({
                  ...sg,
                  order: sg.order.includes(id) ? sg.order.filter((x) => x !== id) : [...sg.order, id],
                  passed: sg.passed.filter((x) => x !== id),
                }))
              }
              onTogglePass={(id) =>
                updateSeg(segKey, (sg) => ({
                  ...sg,
                  passed: sg.passed.includes(id) ? sg.passed.filter((x) => x !== id) : [...sg.passed, id],
                  order: sg.order.filter((x) => x !== id),
                }))
              }
              onAdded={refresh}
            />
            <Rundown
              title={title}
              seg={seg}
              slots={slots}
              total={total}
              onChange={(fn) => updateSeg(segKey, fn)}
            />
          </div>
        </div>

        <EpisodeManager hostKey={hostKey} episodes={episodes} clips={clips ?? []} onSaved={setEpisodes} />
      </div>
    </main>
  );
}
