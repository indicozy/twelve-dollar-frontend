import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as si from "simple-icons";
import { c } from "../theme";

type SI = { title: string; hex: string; path: string };
const icons = si as unknown as Record<string, SI>;

/** Technology logos from Simple Icons (CC0). One per variant; extra ones for the setup diagram. */
const byVariant: Record<string, string> = {
  nextjs: "siNextdotjs", "nextjs-cached": "siNextdotjs", "nextjs-smart": "siNextdotjs", "nextjs-fullcache": "siNextdotjs", "nextjs-csr": "siNextdotjs",
  remix: "siReactrouter", "tanstack-start": "siTanstack", sveltekit: "siSvelte", nuxt: "siNuxt", solidstart: "siSolid", qwik: "siQwik",
  angular: "siAngular", astro: "siAstro", express: "siExpress", "express-nunjucks": "siNunjucks", flask: "siFlask", django: "siDjango",
  aspnet: "siDotnet", laravel: "siLaravel", spring: "siSpringboot", "rust-axum": "siRust",
  leptos: "siLeptos", "nextjs-bun": "siBun", hono: "siHono", bun: "siBun",
  k6: "siK6", sqlite: "siSqlite", node: "siNodedotjs", react: "siReact", ejs: "siEjs",
};

/** Brand colour, or ink when the brand colour is too light (or pure black) to read on the paper. */
function color(icon: SI) {
  const h = icon.hex;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.82 || lum < 0.06 ? c.ink : `#${h}`;
}

export function Logo({ id, size = 48 }: { id: string; size?: number }) {
  const icon = icons[byVariant[id] ?? id];
  if (!icon) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={icon.title}>
      <path d={icon.path} fill={color(icon)} />
    </svg>
  );
}

/** A logo on a small white tile that pops in with a spring at `start`. */
export function LogoTile({ id, size = 64, start = 0, style }: { id: string; size?: number; start?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - start, fps, config: { damping: 11, mass: 0.6 } });
  if (!icons[byVariant[id] ?? id]) return null;
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: "#fff", border: `2.5px solid ${c.dots}`,
      boxShadow: "0 3px 0 rgba(31,33,40,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
      transform: `scale(${s}) rotate(${(1 - s) * -12}deg)`, ...style }}>
      <Logo id={id} size={size * 0.62} />
    </div>
  );
}
