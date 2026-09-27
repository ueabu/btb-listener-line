"use client";

import { useEffect, useRef, useState } from "react";
import { api, isMock } from "@/lib/api";
import { blobToBase64 } from "@/lib/audio/process";
import type { Dest, Episode, Kind } from "@/lib/types";
import DestinationPicker from "./DestinationPicker";
import KindPicker from "./KindPicker";
import Recorder, { type Take } from "./Recorder";
import s from "./listener.module.css";

const EPISODES_TIMEOUT_MS = 8000;

type SendState = { phase: "idle" } | { phase: "sending" } | { phase: "sent"; name: string } | { phase: "error"; message: string };

export default function ListenerPage() {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [dest, setDest] = useState<Dest>("lwit");
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("question");
  const [take, setTake] = useState<Take | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [send, setSend] = useState<SendState>({ phase: "idle" });
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    // Hold the form until episodes arrive so the upcoming-episode card doesn't pop in late.
    // If the script is slow or down, show the form anyway with just Last Week in Tech.
    let done = false;
    const finish = (eps: Episode[]) => {
      if (done) return;
      done = true;
      setEpisodes(eps);
    };
    const timer = window.setTimeout(() => finish([]), EPISODES_TIMEOUT_MS);
    api.getEpisodes().then(finish, () => finish([]));
    return () => window.clearTimeout(timer);
  }, []);

  const episode = episodes?.find((e) => e.id === episodeId);
  const missing = !take ? "Record or add a clip first." : !name.trim() ? "Add a name to credit." : !consent ? "Tick the box to say we can play it." : null;
  const sending = send.phase === "sending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing || !take || sending) return;
    setSend({ phase: "sending" });
    try {
      await api.submit({
        name: name.trim(),
        email: email.trim() || undefined,
        summary: summary.trim() || undefined,
        kind,
        dest,
        episodeId: dest === "upcoming" ? episodeId ?? undefined : undefined,
        fromVideo: take.fromVideo,
        durationSec: Math.round(take.durationSec * 10) / 10,
        consent,
        source: "listener",
        elapsedMs: Date.now() - startedAt.current,
        website,
        audio: await blobToBase64(take.mp3),
      });
      setSend({ phase: "sent", name: name.trim().split(/\s+/)[0] });
    } catch (err) {
      setSend({ phase: "error", message: err instanceof Error ? err.message : "Something went wrong. Try again." });
    }
  }

  function another() {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setSummary("");
    setKind("question");
    setSend({ phase: "idle" });
  }

  return (
    <main className={s.page}>
      <div className={s.phone}>
        <header className={s.top}>
          <span className="wordmark">
            Beyond the <i>Build</i>
          </span>
        </header>

        {send.phase === "sent" ? (
          <section className={s.sent} aria-live="polite">
            <span className="eyebrow">Sent</span>
            <h1>Got it, {send.name}.</h1>
            <p>
              We go through clips before each recording. If yours makes the listener segment, you&apos;ll hear it in the episode.
            </p>
            <button type="button" className="btn btn-ghost" onClick={another}>Send another</button>
          </section>
        ) : episodes === null ? (
          <div className={s.loading} role="status">
            <span className="spinner" aria-hidden="true" />
            <span>Loading…</span>
          </div>
        ) : (
          <form className={s.body} onSubmit={submit} noValidate>
            <div className={s.hero}>
              <h1>Be part of the show.</h1>
              <p>
                We&apos;d love to hear from you. Ask Uma &amp; Ope anything, share a thought, or tell us something interesting. We
                play the best ones in the listener segment of the next episode.
              </p>
            </div>

            <DestinationPicker
              dest={dest}
              episodeId={episodeId}
              episodes={episodes}
              onChange={(d, id) => {
                setDest(d);
                setEpisodeId(id);
              }}
            />

            <KindPicker kind={kind} onChange={setKind} name={name} dest={dest} episodeTitle={episode?.title} />

            <Recorder take={take} onTake={setTake} disabled={sending} />

            <div className={s.two}>
              <div className={s.field}>
                <label className={s.label} htmlFor="nm">
                  Name to credit <span className="hint">(required)</span>
                </label>
                <input id="nm" type="text" required aria-required="true" autoComplete="name" placeholder="Tobi from London" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="em">
                  Email <span className="hint">(optional)</span>
                </label>
                <input id="em" type="email" autoComplete="email" placeholder="myemail@gmail.com" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div className={s.field}>
              <label className={s.label} htmlFor="sm">
                In a sentence, what&apos;s it about? <span className="hint">(optional)</span>
              </label>
              <input id="sm" type="text" placeholder="e.g. How do you set token budgets per team?" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} />
            </div>

            <div className={s.honeypot} aria-hidden="true">
              <label>
                Website
                <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>

            <label className={s.check}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Beyond the Build can play my recording on the podcast and in clips. <b className={s.req}>Required</b>
              </span>
            </label>

            {send.phase === "error" && <div className="error" role="alert">{send.message}</div>}

            <button type="submit" className={`btn btn-primary ${s.send}`} disabled={!!missing || sending}>
              {sending ? "Sending…" : "Send to the show"}
            </button>
            {missing && !sending && <p className={s.sendHint}>{missing}</p>}
          </form>
        )}
      </div>
      {isMock && <p className={s.footer}>Dev mode: no Apps Script URL set, so clips are saved in this browser only.</p>}
    </main>
  );
}
