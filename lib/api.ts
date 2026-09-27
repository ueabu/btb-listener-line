import type { BoardState, Clip, Episode, Submission } from "./types";

const URL_ = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ?? "";
/** With no Apps Script configured, a local in-browser mock stands in so the UI can be developed. */
export const isMock = !URL_;

export class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

type Res<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (isMock) return mock(action, payload) as Promise<T>;
  let res: Response;
  try {
    // text/plain keeps this a "simple" request, so the browser skips the CORS preflight Apps Script can't answer.
    res = await fetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
      redirect: "follow",
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", "network");
  }
  let body: Res<T>;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("The server sent back something unexpected. Try again in a minute.", "bad_response");
  }
  if (!body.ok) throw new ApiError(body.error, body.code);
  return body.data;
}

export interface HostData {
  clips: Clip[];
  board: BoardState;
  episodes: Episode[];
}

export const api = {
  getEpisodes: () => call<Episode[]>("getEpisodes"),
  /** Hosts pass their key so the script skips the listener spam checks. */
  submit: (s: Submission, key?: string) => call<{ id: string }>("submit", { submission: s, key }),
  list: (key: string) => call<HostData>("list", { key }),
  clip: (key: string, id: string) => call<{ audio: string }>("clip", { key, id }),
  /** Saves unless the stored board is newer than `base`; then returns the stored one with conflict=true. */
  saveBoard: (key: string, board: BoardState, base: string) =>
    call<{ board: BoardState; conflict: boolean }>("saveBoard", { key, board, base }),
  saveEpisodes: (key: string, episodes: Episode[]) => call<Episode[]>("saveEpisodes", { key, episodes }),
};

// ---------------------------------------------------------------------------
// Local mock (dev only). Mirrors apps-script/Code.gs closely enough to click through.

const MOCK_KEY = "ll-mock";
interface MockDb {
  clips: (Clip & { audio: string })[];
  board: BoardState;
  episodes: Episode[];
}

function load(): MockDb {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    clips: [],
    board: { updatedAt: new Date(0).toISOString(), segments: {} },
    episodes: [
      {
        id: "sdlc",
        title: "The software development life cycle",
        note: "Recording soon",
        description: "How teams really ship software, from planning to release, and which steps are worth keeping.",
        active: true,
      },
    ],
  };
}

let memo: MockDb | null = null;
function db(): MockDb {
  return (memo ??= load());
}
function persist() {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(memo));
  } catch {
    // Audio can overflow localStorage; the in-memory copy still works for this session.
  }
}

async function mock(action: string, p: Record<string, unknown>): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 250));
  const d = db();
  const hostKey = (p.key as string) ?? "";
  const needKey = ["list", "clip", "saveBoard", "saveEpisodes"].includes(action);
  if (needKey && !hostKey) throw new ApiError("Wrong password.", "unauthorized");

  switch (action) {
    case "getEpisodes":
      return d.episodes.filter((e) => e.active);
    case "submit": {
      const s = p.submission as Submission;
      if (s.website) throw new ApiError("Rejected.", "spam");
      if (!hostKey && s.elapsedMs < 3000) throw new ApiError("That was quick. Give it another go.", "spam");
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      d.clips.unshift({
        id, name: s.name, email: s.email, summary: s.summary, kind: s.kind, dest: s.dest, episodeId: s.episodeId,
        fromVideo: s.fromVideo, durationSec: s.durationSec, source: s.source, createdAt: new Date().toISOString(),
        size: Math.round((s.audio.length * 3) / 4), audio: s.audio,
      });
      persist();
      return { id };
    }
    case "list":
      return {
        clips: d.clips.map((c) => {
          const { audio, ...meta } = c;
          void audio;
          return meta;
        }),
        board: d.board,
        episodes: d.episodes,
      };
    case "clip": {
      const c = d.clips.find((x) => x.id === p.id);
      if (!c) throw new ApiError("Clip not found.", "not_found");
      return { audio: c.audio };
    }
    case "saveBoard": {
      if ((p.base as string) < d.board.updatedAt) return { board: d.board, conflict: true };
      d.board = { ...(p.board as BoardState), updatedAt: new Date().toISOString() };
      persist();
      return { board: d.board, conflict: false };
    }
    case "saveEpisodes":
      d.episodes = p.episodes as Episode[];
      persist();
      return d.episodes;
  }
  throw new ApiError(`Unknown action ${action}`);
}
