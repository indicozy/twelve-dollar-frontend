import React, { useMemo } from "react";
import rough from "roughjs";
import { c } from "../theme";

const gen = rough.generator();
type PathInfo = { d: string; stroke: string; strokeWidth: number; fill?: string };

type Common = { seed?: number; stroke?: string; fill?: string; strokeWidth?: number; roughness?: number; draw?: number; fillOpacity?: number };

/** Renders rough.js paths; `draw` (0..1) draws the outline in and fades the fill in after it. */
function Paths({ paths, draw = 1, fillOpacity = 1 }: { paths: PathInfo[]; draw?: number; fillOpacity?: number }) {
  return (
    <>
      {paths.map((p, i) =>
        p.fill && p.fill !== "none" && p.stroke === "none" ? (
          <path key={i} d={p.d} fill={p.fill} stroke="none" opacity={Math.max(0, (draw - 0.35) / 0.65) * fillOpacity} />
        ) : (
          <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round"
            strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, draw * 1.25)} />
        ),
      )}
    </>
  );
}

const opts = (o: Common) => ({
  seed: o.seed ?? 7, roughness: o.roughness ?? 1.1, bowing: 1.2, stroke: o.stroke ?? c.ink, strokeWidth: o.strokeWidth ?? 2.4,
  fill: o.fill, fillStyle: "solid" as const, preserveVertices: true,
});

export function RoughRect({ x, y, w, h, ...o }: Common & { x: number; y: number; w: number; h: number }) {
  const paths = useMemo(() => gen.toPaths(gen.rectangle(x, y, w, h, opts(o))) as PathInfo[], [x, y, w, h, o.seed, o.stroke, o.fill, o.strokeWidth, o.roughness]);
  return <Paths paths={paths} draw={o.draw} fillOpacity={o.fillOpacity} />;
}

export function RoughEllipse({ cx, cy, w, h, ...o }: Common & { cx: number; cy: number; w: number; h: number }) {
  const paths = useMemo(() => gen.toPaths(gen.ellipse(cx, cy, w, h, opts(o))) as PathInfo[], [cx, cy, w, h, o.seed, o.stroke, o.fill]);
  return <Paths paths={paths} draw={o.draw} fillOpacity={o.fillOpacity} />;
}

/** A hand-drawn arrow from (x1,y1) to (x2,y2). */
export function RoughArrow({ x1, y1, x2, y2, head = 14, ...o }: Common & { x1: number; y1: number; x2: number; y2: number; head?: number }) {
  const paths = useMemo(() => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const line = gen.line(x1, y1, x2, y2, opts(o));
    const h1 = gen.line(x2, y2, x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45), opts({ ...o, seed: (o.seed ?? 7) + 1 }));
    const h2 = gen.line(x2, y2, x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45), opts({ ...o, seed: (o.seed ?? 7) + 2 }));
    return [line, h1, h2].flatMap((d) => gen.toPaths(d)) as PathInfo[];
  }, [x1, y1, x2, y2, head, o.seed, o.stroke]);
  return <Paths paths={paths} draw={o.draw} />;
}

export function RoughLine({ x1, y1, x2, y2, ...o }: Common & { x1: number; y1: number; x2: number; y2: number }) {
  const paths = useMemo(() => gen.toPaths(gen.line(x1, y1, x2, y2, opts(o))) as PathInfo[], [x1, y1, x2, y2, o.seed, o.stroke]);
  return <Paths paths={paths} draw={o.draw} />;
}
