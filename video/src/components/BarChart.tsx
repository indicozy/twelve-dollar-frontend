import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { appear } from "../anim";
import { c, fonts } from "../theme";
import { shown, usersLabel, type Variant } from "../data";
import { LogoTile } from "./logos";

/**
 * Horizontal bars that grow in one after another and count up.
 * `max` fixes the scale (so several scenes share one ruler); `capAt` hatches bars stopped by the 16,000-user cap.
 */
export function BarChart({ items, x = 110, y = 300, width = 1500, rowH = 74, start = 10, stagger = 8, max, value = (v) => shown(v),
  format = (n, v) => usersLabel(v, n), labelW = 380, ref, }: {
  items: Variant[]; x?: number; y?: number; width?: number; rowH?: number; start?: number; stagger?: number; max?: number;
  value?: (v: Variant) => number; format?: (n: number, v: Variant) => string; labelW?: number; ref?: { label: string; value: number };
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const top = Math.max(...items.map(value), ref?.value ?? 0);
  const scale = (max ?? top * 1.08);
  const trackW = width - labelW - 180 - Math.min(60, rowH * 0.82) - 14;
  const barH = Math.min(46, rowH - 18);
  return (
    <div style={{ position: "absolute", left: x, top: y, width }}>
      {items.map((it, i) => {
        const s = spring({ frame: f - start - i * stagger, fps, config: { damping: 18, mass: 0.8 } });
        const val = value(it);
        const w = Math.max(6, (val / scale) * trackW) * s;
        const g = c[it.group];
        return (
          <div key={it.id} style={{ display: "flex", alignItems: "center", height: rowH, ...appear(f, start + i * stagger - 6) }}>
            <div style={{ width: labelW, textAlign: "right", paddingRight: 18, fontFamily: fonts.hand, fontSize: Math.min(38, rowH * 0.52), color: c.ink }}>{it.name}</div>
            <LogoTile id={it.id} size={Math.min(60, rowH * 0.82)} start={start + i * stagger - 4} style={{ marginRight: 14 }} />
            <div style={{ position: "relative", width: trackW, height: barH }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: barH, width: w, background: it.capped
                  ? `repeating-linear-gradient(45deg, ${g.fill} 0 10px, ${c.paper} 10px 15px)` : g.fill,
                border: `3px solid ${g.stroke}`, borderRadius: "4px 10px 10px 4px", boxSizing: "border-box" }} />
              <div style={{ position: "absolute", left: w + 16, top: "50%", transform: "translateY(-50%)", fontFamily: fonts.mono, fontWeight: 700,
                fontSize: Math.min(32, rowH * 0.44), color: c.ink, whiteSpace: "nowrap", opacity: s }}>{format(val * s, it)}</div>
            </div>
          </div>
        );
      })}
      {ref && (() => {
        const rx = labelW + (ref.value / scale) * trackW;
        const o = appear(f, start + items.length * stagger + 6).opacity;
        return (
          <div style={{ position: "absolute", left: rx, top: -14, height: items.length * rowH + 28, borderLeft: `3px dashed ${c.template.stroke}`, opacity: o }}>
            <div style={{ position: "absolute", left: 10, top: -38, fontFamily: fonts.hand, fontSize: 30, color: c.template.stroke, whiteSpace: "nowrap" }}>{ref.label}</div>
          </div>
        );
      })()}
    </div>
  );
}

export function GroupLegend({ x = 110, y = 230, start = 0 }: { x?: number; y?: number; start?: number }) {
  const f = useCurrentFrame();
  const items: [keyof typeof c & ("hydrate" | "template" | "static"), string][] = [["hydrate", "SSR + hydration"], ["template", "server templates"], ["static", "static + API"]];
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", gap: 34, ...appear(f, start) }}>
      {items.map(([k, t]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: fonts.hand, fontSize: 30, color: c.ink2 }}>
          <span style={{ width: 22, height: 22, borderRadius: 4, background: c[k].fill, border: `2.5px solid ${c[k].stroke}` }} />{t}
        </div>
      ))}
    </div>
  );
}
