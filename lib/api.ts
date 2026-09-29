import type { BoardState, Clip, Episode, Submission, SubmissionMeta, VideoSubmission } from "./types";

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
  /** Video step 1: checks, then a one-off Drive upload URL for the browser to PUT the file to. */
  startVideo: (v: VideoSubmission, key?: string) => call<{ ticket: string; uploadUrl: string }>("startVideo", { submission: v, key }),
  /** Video step 3: the file is in Drive; label it and notify the hosts. */
  finishVideo: (ticket: string, fileId: string) => call<{ id: string }>("finishVideo", { ticket, fileId }),
};

export interface UploadProgress {
  loaded: number;
  total: number;
}

/**
 * Video step 2: send the file straight to Drive. XHR rather than fetch, because fetch can't
 * report upload progress. Resolves with Drive's file id; rejects with ApiError("aborted") on cancel.
 */
export function uploadVideo(uploadUrl: string, file: File, onProgress: (p: UploadProgress) => void, signal?: AbortSignal): Promise<{ id: string }> {
  if (uploadUrl.startsWith("mock:")) return mockUpload(uploadUrl.slice(5), file, onProgress, signal);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.upload.onprogress = (e) => onProgress({ loaded: e.loaded, total: e.lengthComputable ? e.total : file.size });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const id = JSON.parse(xhr.responseText).id as string;
          if (id) return resolve({ id });
        } catch {}
      }
      reject(new ApiError("The upload didn't finish. Please try again.", "upload_failed"));
    };
    xhr.onerror = () => reject(new ApiError("Upload interrupted. Check your connection and try again.", "network"));
    xhr.onabort = () => reject(new ApiError("Upload cancelled.", "aborted"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

// ---------------------------------------------------------------------------
// Local mock (dev only). Mirrors apps-script/Code.gs closely enough to click through.

const MOCK_KEY = "ll-mock";
/** How long the mock pretends a video upload takes, so the progress UI can be seen in dev. */
const MOCK_UPLOAD_MS = 2500;
const mockTickets = new Map<string, { meta: SubmissionMeta; mimeType: string; size: number; file?: File }>();

function mockUpload(ticket: string, file: File, onProgress: (p: UploadProgress) => void, signal?: AbortSignal): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const timer = setInterval(() => {
      const f = Math.min(1, (performance.now() - started) / MOCK_UPLOAD_MS);
      onProgress({ loaded: Math.round(file.size * f), total: file.size });
      if (f < 1) return;
      clearInterval(timer);
      const t = mockTickets.get(ticket);
      if (t) t.file = file;
      resolve({ id: ticket });
    }, 100);
    signal?.addEventListener("abort", () => {
      clearInterval(timer);
      reject(new ApiError("Upload cancelled.", "aborted"));
    });
  });
}
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
        media: "audio", fromVideo: s.fromVideo, durationSec: s.durationSec, source: s.source, createdAt: new Date().toISOString(),
        size: Math.round((s.audio.length * 3) / 4), audio: s.audio,
      });
      persist();
      return { id };
    }
    case "startVideo": {
      const v = p.submission as VideoSubmission;
      if (v.website) throw new ApiError("Rejected.", "spam");
      if (!hostKey && v.elapsedMs < 3000) throw new ApiError("That was quick. Give it another go.", "spam");
      const ticket = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const { mimeType, size, fileName, origin, ...meta } = v;
      void fileName;
      void origin;
      mockTickets.set(ticket, { meta, mimeType, size });
      return { ticket, uploadUrl: `mock:${ticket}` };
    }
    case "finishVideo": {
      const t = mockTickets.get(p.ticket as string);
      if (!t?.file) throw new ApiError("That upload expired. Please send it again.", "expired");
      mockTickets.delete(p.ticket as string);
      const m = t.meta;
      d.clips.unshift({
        id: p.ticket as string, name: m.name, email: m.email, summary: m.summary, kind: m.kind, dest: m.dest, episodeId: m.episodeId,
        media: "video", mimeType: t.mimeType, durationSec: m.durationSec, source: m.source, createdAt: new Date().toISOString(),
        size: t.size, url: URL.createObjectURL(t.file), audio: "",
      });
      persist();
      return { id: p.ticket };
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
