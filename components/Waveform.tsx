"use client";

import { useEffect, useRef } from "react";

const BAR = 4;
const GAP = 3;

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Resample values to `n` bars. */
function fit(values: number[], n: number): number[] {
  if (!values.length) return Array(n).fill(0.08);
  return Array.from({ length: n }, (_, i) => values[Math.min(values.length - 1, Math.floor((i / n) * values.length))]);
}

export function drawBars(canvas: HTMLCanvasElement, values: number[], played: number, color: string, dim: string) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const x = canvas.getContext("2d");
  if (!x) return;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  const n = Math.max(1, Math.floor((w + GAP) / (BAR + GAP)));
  const bars = fit(values, n);
  const fg = cssVar(color);
  const bg = cssVar(dim);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0.08, Math.min(1, bars[i]));
    const bh = v * h;
    x.fillStyle = i / n < played ? fg : bg;
    x.beginPath();
    if (x.roundRect) x.roundRect(i * (BAR + GAP), (h - bh) / 2, BAR, bh, 2);
    else x.rect(i * (BAR + GAP), (h - bh) / 2, BAR, bh);
    x.fill();
  }
}

/** Redraw on resize and on light/dark switch. */
export function useRedraw(ref: React.RefObject<HTMLCanvasElement | null>, draw: () => void) {
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
    draw();
  });
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const redraw = () => drawRef.current();
    const ro = new ResizeObserver(redraw);
    ro.observe(c);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", redraw);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", redraw);
    };
  }, [ref]);
}

interface Props {
  peaks?: number[];
  played?: number;
  color?: string;
  dim?: string;
  className?: string;
  label?: string;
}

export default function Waveform({ peaks = [], played = 0, color = "--accent", dim = "--line", className, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useRedraw(ref, () => ref.current && drawBars(ref.current, peaks, played, color, dim));
  return <canvas ref={ref} className={className} role="img" aria-label={label ?? "Audio waveform"} />;
}
