export type Kind = "question" | "thought" | "intro";
export type Dest = "lwit" | "upcoming";

export const KINDS: { id: Kind; label: string; plural: string }[] = [
  { id: "question", label: "Question", plural: "Questions" },
  { id: "thought", label: "Thought", plural: "Thoughts" },
  { id: "intro", label: "Intro", plural: "Intros" },
];

export const MAX_SECONDS = 120;
export const LWIT = "lwit";

export interface Episode {
  id: string;
  title: string;
  note?: string;
  /** A sentence or two on what the episode covers, shown to listeners so they know what to ask about. */
  description?: string;
  active: boolean;
}

/** Details sent with every clip, audio or video. */
export interface SubmissionMeta {
  name: string;
  email?: string;
  summary?: string;
  kind: Kind;
  dest: Dest;
  episodeId?: string;
  durationSec: number;
  consent: boolean;
  source: "listener" | "host";
  /** How long the form was open before sending, for the bot check. */
  elapsedMs: number;
  website?: string; // honeypot, must stay empty
}

/** An audio clip: a base64 MP3 small enough to go through the Apps Script. */
export interface Submission extends SubmissionMeta {
  /** Older clips were MP3s pulled out of a video; new ones never are. */
  fromVideo: boolean;
  audio: string;
}

/** A video clip: only its details go to the Apps Script; the file goes straight to Drive. */
export interface VideoSubmission extends SubmissionMeta {
  mimeType: string;
  size: number;
  fileName: string;
  /** The page's origin, so Drive allows the browser's upload (CORS). */
  origin: string;
}

/** A stored clip, as returned by `list`. */
export interface Clip {
  id: string;
  name: string;
  email?: string;
  summary?: string;
  kind: Kind;
  dest: Dest;
  episodeId?: string;
  /** Missing on clips from before video uploads; treat as audio. */
  media?: "audio" | "video";
  mimeType?: string;
  /** Audio pulled out of a video (older clips only). */
  fromVideo?: boolean;
  durationSec: number;
  source: "listener" | "host";
  createdAt: string;
  size: number;
  url?: string;
}

export interface SegmentState {
  /** Shortlisted clip ids, in rundown order. */
  order: string[];
  passed: string[];
  /** Seconds of discussion after each clip, by clip id. */
  discussion: Record<string, number>;
  targetSec: number;
  /** LWIT only: clips before this ISO date belong to earlier weeks. */
  since?: string;
}

export interface BoardState {
  updatedAt: string;
  segments: Record<string, SegmentState>;
}

/** Board segment key: "lwit" or the upcoming episode id. */
export function segmentKey(clip: Pick<Clip, "dest" | "episodeId">): string {
  return clip.dest === "upcoming" && clip.episodeId ? clip.episodeId : LWIT;
}

export function emptySegment(): SegmentState {
  return { order: [], passed: [], discussion: {}, targetSec: 8 * 60 };
}
