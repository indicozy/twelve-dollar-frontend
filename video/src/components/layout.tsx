import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { appear, prog } from "../anim";
import { c, fonts } from "../theme";
import { RoughLine, RoughRect } from "./rough";

export const W = 1920, H = 1080;

/** Dotted whiteboard paper. Optional zoom/drift props add a slow camera move (off by default). */
export function Paper({ children, svg, zoom = 0, drift = 0 }: { children?: React.ReactNode; svg?: React.ReactNode; zoom?: number; drift?: number }) {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const scale = 1 + zoom * t, x = -drift * t, y = -drift * 0.4 * t;
  return (
    <AbsoluteFill style={{ backgroundColor: c.paper, backgroundImage: `radial-gradient(${c.dots} 1.6px, transparent 1.6px)`, backgroundSize: "34px 34px",
      backgroundPosition: `${x * 0.5}px ${y * 0.5}px`, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: "50% 45%" }}>
        {svg && <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>{svg}</svg>}
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Handwritten headline with a hand-drawn underline that draws in under it. */
export function Title({ text, sub, start = 0, x = 110, y = 80, width = 900 }: { text: string; sub?: string; start?: number; x?: number; y?: number; width?: number }) {
  const f = useCurrentFrame();
  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, fontFamily: fonts.head, fontSize: 64, color: c.ink, ...appear(f, start) }}>{text}</div>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <RoughLine x1={x - 6} y1={y + 92} x2={x + width} y2={y + 88} stroke={c.highlight} strokeWidth={9} roughness={1.6} seed={3} draw={prog(f, start + 6, 18)} />
      </svg>
      {sub && <div style={{ position: "absolute", left: x, top: y + 110, fontFamily: fonts.hand, fontSize: 34, color: c.ink2, ...appear(f, start + 10) }}>{sub}</div>}
    </>
  );
}

export function Pill({ children, color = c.yellow, style }: { children: React.ReactNode; color?: { fill: string; stroke: string }; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-block", padding: "6px 18px", borderRadius: 30, background: color.fill, border: `2.5px solid ${color.stroke}`,
      fontFamily: fonts.hand, fontSize: 32, color: c.ink, ...style }}>{children}</span>
  );
}

/** A text label positioned on the 1920x1080 stage. */
export function Label({ x, y, children, size = 34, font = "hand", color = c.ink, align = "left", start = 0, width, style }: {
  x: number; y: number; children: React.ReactNode; size?: number; font?: "hand" | "head" | "mono"; color?: string; align?: "left" | "center" | "right"; start?: number; width?: number; style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  const shift = align === "center" ? "-50%" : align === "right" ? "-100%" : "0";
  return (
    <div style={{ position: "absolute", left: x, top: y, width, fontFamily: fonts[font], fontSize: size, color, textAlign: align, whiteSpace: width ? "normal" : "nowrap",
      lineHeight: 1.25, ...appear(f, start), transform: `translateX(${shift}) ${appear(f, start).transform}`, ...style }}>{children}</div>
  );
}

/** A hand-drawn box with a centered label, drawn in from `start`. */
export function Box({ x, y, w, h, color = c.neutral, start = 0, seed = 11, title, body, titleSize = 40 }: {
  x: number; y: number; w: number; h: number; color?: { fill: string; stroke: string }; start?: number; seed?: number; title: React.ReactNode; body?: React.ReactNode; titleSize?: number;
}) {
  const f = useCurrentFrame();
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <RoughRect x={x} y={y} w={w} h={h} fill={color.fill} stroke={color.stroke} seed={seed} draw={prog(f, start, 22)} />
      </svg>
      <div style={{ position: "absolute", left: x, top: y, width: w, height: h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: 12, boxSizing: "border-box", gap: 6, ...appear(f, start + 12) }}>
        <div style={{ fontFamily: fonts.head, fontSize: titleSize, color: c.ink, lineHeight: 1.1 }}>{title}</div>
        {body && <div style={{ fontFamily: fonts.hand, fontSize: 28, color: c.ink2, lineHeight: 1.2 }}>{body}</div>}
      </div>
    </>
  );
}

/** A simple stick person (an original, generic icon). */
export function Person({ x, y, s = 1, color = c.hydrate.stroke, opacity = 1 }: { x: number; y: number; s?: number; color?: string; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity} fill={color}>
      <circle cx={0} cy={-11} r={6} />
      <path d="M -10 10 Q -10 -2 0 -2 Q 10 -2 10 10 Z" />
    </g>
  );
}
