"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** One <audio> element per hook; `progress` is 0..1. */
export function usePlayer(src: string | null, autoPlay = false) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!src) return;
    const a = new Audio(src);
    audio.current = a;
    let raf = 0;
    const tick = () => {
      if (a.duration) setProgress(a.currentTime / a.duration);
      raf = requestAnimationFrame(tick);
    };
    a.onplay = () => {
      setPlaying(true);
      raf = requestAnimationFrame(tick);
    };
    a.onpause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
    };
    a.onended = () => {
      setPlaying(false);
      setProgress(0);
      cancelAnimationFrame(raf);
    };
    if (autoPlay) void a.play().catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      audio.current = null;
      setPlaying(false);
      setProgress(0);
    };
  }, [src, autoPlay]);

  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, []);

  const seek = useCallback((frac: number) => {
    const a = audio.current;
    if (a?.duration) {
      a.currentTime = frac * a.duration;
      setProgress(frac);
    }
  }, []);

  const play = useCallback(() => void audio.current?.play(), []);

  return { playing, progress, toggle, seek, play };
}
