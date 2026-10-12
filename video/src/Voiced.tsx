import React from "react";
import { AbsoluteFill, Audio, CalculateMetadataFunction, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { z } from "zod";
import { c, fonts } from "./theme";

// The v3b slides laid over a recorded voice-over. Every timing is a prop, so it can be edited in the Studio's
// props panel (right side) and saved back into Root.tsx with the save button.
const FPS = 30;
const FADE = 10; // frames each slide fades in over the previous one

function FadeIn({ children, first }: { children: React.ReactNode; first: boolean }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: first ? 1 : interpolate(frame, [0, FADE], [0, 1], { extrapolateRight: "clamp" }) }}>{children}</AbsoluteFill>;
}

function Label({ id, start }: { id: string; start: number }) {
  const t = start + useCurrentFrame() / FPS;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  return (
    <div style={{ position: "absolute", left: 24, top: 24, padding: "8px 16px", borderRadius: 8, background: "rgba(0,0,0,0.75)", color: "#fff", font: "600 28px monospace" }}>
      {id} · {mmss(t)}
    </div>
  );
}

// "Subtitles available" popup in the bottom-left corner for the first few seconds.
const TIP_IN = 1 * FPS;
const TIP_OUT = 7 * FPS;
function CcTip() {
  const f = useCurrentFrame();
  const show = interpolate(f, [TIP_IN, TIP_IN + 12, TIP_OUT - 12, TIP_OUT], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (show === 0) return null;
  return (
    <div style={{ position: "absolute", left: 72, bottom: 64, display: "flex", alignItems: "center", gap: 18, padding: "14px 24px 14px 16px", background: c.paper, border: `3px solid ${c.ink}`, borderRadius: 16, boxShadow: "0 8px 28px rgba(0,0,0,0.15)", opacity: show, transform: `translateY(${(1 - show) * 24}px)` }}>
      <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, color: c.paper, background: c.ink, borderRadius: 8, padding: "4px 12px" }}>CC</span>
      <span style={{ fontFamily: fonts.hand, fontSize: 36, color: c.ink }}>subtitles available: press C</span>
    </div>
  );
}

// circle: bottom-right, like the reference frame (about 290px across, 72px from the right, 48px from the bottom)
const cameraBox: Record<string, React.CSSProperties> = {
  circle: { left: "auto", top: "auto", right: 72, bottom: 48, width: 290, height: 290, borderRadius: "50%", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" },
  corner: { left: "auto", top: "auto", right: 32, bottom: 32, width: 400, height: 225, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" },
  full: {},
};

// Root.tsx passes the slide list in, so this file doesn't import Root (that would be a circular import).
export function makeVoiced(shots: [string, React.FC, number][]) {
  const ids = shots.map(([id]) => id) as [string, ...string[]];
  const byId = Object.fromEntries(shots.map(([id, C]) => [id, C])) as Record<string, React.FC>;

  const schema = z.object({
    take: z.string().describe("Recording in public/, e.g. takes/take-195334.mp4"),
    audio: z.string().describe("Separate cleaned-up audio in public/; empty uses the recording's own sound"),
    camera: z.enum(["off", "circle", "corner", "full"]).describe("Show the camera from the recording"),
    cameraZoom: z.number().min(1).max(4).describe("Zoom into the face inside the circle"),
    ccTip: z.boolean().describe("Show the 'subtitles available' popup at the start"),
    showLabels: z.boolean().describe("Slide name and time overlay, for editing only"),
    end: z.number().min(1).describe("Video length in seconds"),
    slides: z.array(z.object({
      id: z.enum(ids),
      start: z.number().min(0).describe("Seconds into the recording"),
    })),
  });
  type Props = z.infer<typeof schema>;

  const metadata: CalculateMetadataFunction<Props> = ({ props }) => ({
    durationInFrames: Math.max(1, Math.round(props.end * FPS)),
  });

  function Voiced({ take, audio, camera, cameraZoom, ccTip, showLabels, end, slides }: Props) {
    const sorted = [...slides].sort((a, b) => a.start - b.start);
    const src = staticFile(take);
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        {sorted.map(({ id, start }, i) => {
          const C = byId[id];
          const from = Math.round(start * FPS);
          // overlap the next slide by FADE frames so its fade-in has something underneath
          const until = Math.round((sorted[i + 1]?.start ?? end) * FPS) + (sorted[i + 1] ? FADE : 0);
          if (until <= from) return null;
          return (
            <Sequence key={`${id}-${i}`} name={id} from={from} durationInFrames={until - from}>
              <FadeIn first={i === 0}><C /></FadeIn>
              {showLabels && <Label id={id} start={start} />}
            </Sequence>
          );
        })}
        {ccTip && <CcTip />}
        {audio && <Audio src={staticFile(audio)} />}
        {camera === "off" ? (
          !audio && <Audio src={src} />
        ) : (
          <AbsoluteFill style={cameraBox[camera]}>
            <OffthreadVideo src={src} muted={!!audio}
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: camera === "circle" ? `scale(${cameraZoom})` : undefined }} />
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    );
  }

  return { Voiced, schema, metadata };
}
