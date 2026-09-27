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

/** What the listener page sends. Audio is base64 MP3. */
export interface Submission {
  name: string;
  email?: string;
  summary?: string;
  kind: Kind;
  dest: Dest;
  episodeId?: string;
  fromVideo: boolean;
  durationSec: number;
  consent: boolean;
  source: "listener" | "host";
  /** How long the form was open before sending, for the bot check. */
  elapsedMs: number;
  website?: string; // honeypot, must stay empty
  audio: string;
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
  fromVideo: boolean;
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
