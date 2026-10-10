import { Easing, interpolate } from "remotion";

/** 0 → 1 between `start` and `start + dur` frames, eased. */
export const prog = (frame: number, start: number, dur = 20, ease = Easing.out(Easing.cubic)) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** Fade + small rise, for text and cards appearing. */
export const appear = (frame: number, start: number, dur = 14) => {
  const p = prog(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * 14}px)` };
};

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
