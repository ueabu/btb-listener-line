"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, isMock, type UploadProgress as Progress } from "@/lib/api";
import { sendTake, type Stage, type Take } from "@/lib/send";
import type { Dest, Episode, Kind } from "@/lib/types";
import DestinationPicker from "./DestinationPicker";
import KindPicker from "./KindPicker";
import Recorder from "./Recorder";
import UploadProgress from "./UploadProgress";
import s from "./listener.module.css";

const EPISODES_TIMEOUT_MS = 8000;

type SendState =
  | { phase: "idle" }
  | { phase: "sending"; stage: Stage; progress: Progress | null; uploadStart: number | null }
  | { phase: "failed"; stage: Stage; progress: Progress | null; message: string }
  | { phase: "sent"; name: string; video: boolean };

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
  const abort = useRef<AbortController | null>(null);

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
  const missing = !take ? "Record or add a clip first." : !name.trim() ? "Add a name to credit." : !consent ? "Tick the box to say we can use it." : null;
  const sending = send.phase === "sending";
  const busy = sending || send.phase === "failed";

  // Leaving mid-upload would lose the video, so ask first.
  useEffect(() => {
    if (!sending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Your video is still uploading. Leave anyway?";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sending]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (missing || !take || sending) return;
    const controller = new AbortController();
    abort.current = controller;
    let stage: Stage = "checking";
    let progress: Progress | null = null;
    setSend({ phase: "sending", stage, progress, uploadStart: null });
    try {
      await sendTake(
        take,
        {
          name: name.trim(),
          email: email.trim() || undefined,
          summary: summary.trim() || undefined,
          kind,
          dest,
          episodeId: dest === "upcoming" ? episodeId ?? undefined : undefined,
          consent,
          source: "listener",
          elapsedMs: Date.now() - startedAt.current,
          website,
        },
        {
          signal: controller.signal,
          onStage: (st) => {
            stage = st;
            setSend((prev) =>
              prev.phase === "sending" ? { ...prev, stage: st, uploadStart: st === "uploading" ? Date.now() : prev.uploadStart } : prev,
            );
          },
          onProgress: (p) => {
            progress = p;
            setSend((prev) => (prev.phase === "sending" ? { ...prev, progress: p } : prev));
          },
        },
      );
      setSend({ phase: "sent", name: name.trim().split(/\s+/)[0], video: take.kind === "video" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "aborted") return setSend({ phase: "idle" });
      setSend({ phase: "failed", stage, progress, message: err instanceof Error ? err.message : "Something went wrong. Try again." });
    } finally {
      abort.current = null;
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
            <p className={s.sentLead}>{send.video ? "Your video is uploaded." : "Your clip is in."}</p>
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
                Send us a question, hot take, story, or something interesting you think belongs on the show. You can even
                record the intro for an upcoming LWIT episode. Send it as a voice note or video, and we play the best ones in
                the listener segment of the next episode.
              </p>
            </div>

            <fieldset className={s.formFields} disabled={busy}>
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

              <Recorder take={take} onTake={setTake} disabled={busy} />

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
                  Beyond the Build can use my recording or video on the podcast, YouTube, and social media clips.{" "}
                  <b className={s.req}>Required</b>
                </span>
              </label>
            </fieldset>

            {send.phase === "sending" || send.phase === "failed" ? (
              <UploadProgress
                video={take?.kind === "video"}
                stage={send.stage}
                progress={send.progress}
                uploadStart={send.phase === "sending" ? send.uploadStart : null}
                error={send.phase === "failed" ? send.message : undefined}
                onCancel={() => abort.current?.abort()}
                onRetry={() => void submit()}
                onBack={() => setSend({ phase: "idle" })}
              />
            ) : (
              <>
                <button type="submit" className={`btn btn-primary ${s.send}`} disabled={!!missing}>
                  Send to the show
                </button>
                {missing && <p className={s.sendHint}>{missing}</p>}
              </>
            )}
          </form>
        )}
      </div>
      {isMock && <p className={s.footer}>Dev mode: no Apps Script URL set, so clips are saved in this browser only.</p>}
    </main>
  );
}
