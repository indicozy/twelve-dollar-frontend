import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/ArchivoBlack";
import { z } from "zod";
import { Logo } from "./components/logos";
import { c } from "./theme";

// YouTube thumbnail: "is Next.js slow?" over a bar chart where Next.js is tiny and the winners are blurred out.
const title = loadFont("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

export const thumbnailSchema = z.object({
  photo: z.string().describe("Cut-out photo in public/ (transparent PNG); empty shows a placeholder"),
  photoHeight: z.number().describe("Photo height in px"),
  photoX: z.number().describe("Photo left edge in px"),
});

const W = 1920, H = 1080;
const AXIS_X = 120, BASE_Y = 865;
// Laravel and Django sit behind the photo (logos only), like PHP and Python in the reference.
// Bar heights are for the picture, not to scale: the point is "Next.js is tiny, something is huge".
const bars: { id: string; h: number; fill: string; stroke: string; blur?: boolean; mark?: string }[] = [
  { id: "laravel", h: 0, fill: "#ffd9d4", stroke: "#d9483f" },
  { id: "django", h: 0, fill: "#cdebdc", stroke: "#138a5d" },
  { id: "nextjs", h: 60, fill: "#e9e9ee", stroke: c.ink, mark: "500" },
  { id: "remix", h: 230, fill: c.hydrate.fill, stroke: c.hydrate.stroke },
  { id: "sveltekit", h: 380, fill: "#ffd3b5", stroke: "#cf5a20", blur: true },
  { id: "express", h: 450, fill: "#fff0b3", stroke: "#b8901a", blur: true, mark: "7,900" },
  { id: "hono", h: 500, fill: "#ffc9a8", stroke: "#e36002", blur: true },
  { id: "rust-axum", h: 620, fill: "#e3dcff", stroke: "#5b46c9", blur: true, mark: "???" },
];
const SLOT = (W - AXIS_X - 110) / bars.length, BAR_W = 140;

export function Thumbnail({ photo, photoHeight, photoX }: z.infer<typeof thumbnailSchema>) {
  return (
    <AbsoluteFill style={{ background: c.paper }}>
      <div style={{ position: "absolute", top: 40, width: "100%", textAlign: "center", fontFamily: title, fontSize: 170, lineHeight: 1, color: c.ink, letterSpacing: -2 }}>
        IS NEXT.JS SLOW?
      </div>

      {/* axes */}
      <div style={{ position: "absolute", left: AXIS_X, top: 230, width: 7, height: BASE_Y - 230, background: c.ink, borderRadius: 4 }} />
      <div style={{ position: "absolute", left: AXIS_X, top: BASE_Y, width: W - AXIS_X - 70, height: 7, background: c.ink, borderRadius: 4 }} />

      {bars.map((b, i) => {
        const cx = AXIS_X + 70 + SLOT * (i + 0.5);
        return (
          <React.Fragment key={b.id}>
            {b.h > 0 && <div style={{ position: "absolute", left: cx - BAR_W / 2, top: BASE_Y - b.h, width: BAR_W, height: b.h, background: b.fill,
              border: b.blur ? "none" : `6px solid ${b.stroke}`, borderBottom: "none", borderRadius: "18px 18px 0 0", boxSizing: "border-box",
              filter: b.blur ? "blur(22px)" : undefined, opacity: b.blur ? 0.9 : 1 }} />}
            <div style={{ position: "absolute", left: cx - 64, top: BASE_Y + 40, width: 128, height: 128, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Logo id={b.id} size={b.id === "nextjs" ? 128 : 112} />
            </div>
          </React.Fragment>
        );
      })}

      {photo ? (
        <Img src={staticFile(photo)} style={{ position: "absolute", left: photoX, bottom: H - BASE_Y - 4, height: photoHeight }} />
      ) : (
        <div style={{ position: "absolute", left: photoX, bottom: H - BASE_Y, width: photoHeight * 0.75, height: photoHeight, background: "#d6d3ca",
          borderRadius: "45% 45% 8px 8px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: title, fontSize: 48, color: "#8d909a" }}>
          YOUR PHOTO
        </div>
      )}

      {/* labels go over the photo */}
      {bars.map((b, i) => b.mark && (
        <div key={`${b.id}-mark`} style={{ position: "absolute", left: AXIS_X + 70 + SLOT * (i + 0.5) - 160, width: 320, top: b.blur ? BASE_Y - b.h + 40 : BASE_Y - b.h - 120, textAlign: "center", fontFamily: title, fontSize: 96, color: b.blur ? c.ink : c.fail }}>
          {b.mark}
        </div>
      ))}
    </AbsoluteFill>
  );
}
