import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { appear, fmt, prog } from "../anim";
import { Label, Paper, Title, W, H } from "../components/layout";
import { LogoTile } from "../components/logos";
import { RoughLine, RoughRect } from "../components/rough";
import { byId, v, variants } from "../data";
import { c, fonts } from "../theme";

/** 3. Every result as one bar chart; the Next.js row lights up at the end. */
export function ResultsTable() {
  const f = useCurrentFrame();
  const rows = variants.filter((x) => x.status === "done").sort((a, b) => (b.users ?? 0) - (a.users ?? 0));
  const rowH = 35, top = 222, trackX = 600, trackW = 860, max = 16000;
  const hl = prog(f, 330, 20);
  return (
    <Paper>
      <Title text="every way to render the page" sub="22 stacks. Same site, API, 0.4 vCPU, 2 GB" width={1080} x={110} y={30} />
      <div style={{ position: "absolute", left: 110, top: top - 44, width: 1700, fontFamily: fonts.hand, fontSize: 26, color: c.ink3, ...appear(f, 10) }}>
        <span style={{ position: "absolute", left: trackX - 110 }}>held for 5 minutes</span>
        <span style={{ position: "absolute", right: 0 }}>CPU per request</span>
      </div>
      {rows.map((r, i) => {
        const isNext = r.id === "nextjs";
        const g = c[r.group];
        const t0 = 20 + i * 6, grow = prog(f, t0 + 4, 26);
        const users = r.users ?? 0, w = Math.max(6, (users / max) * trackW) * grow;
        return (
          <div key={r.id} style={{ position: "absolute", left: 96, top: top + i * rowH, width: 1730, height: rowH - 4, display: "flex", alignItems: "center",
            paddingLeft: 14, borderRadius: 8, background: isNext ? `rgba(255,226,122,${hl})` : "transparent", border: isNext ? `2px solid rgba(217,72,63,${hl})` : "2px solid transparent",
            ...appear(f, t0, 10) }}>
            <div style={{ width: 44, fontFamily: fonts.mono, fontSize: 22, color: c.ink3 }}>{i + 1}</div>
            <LogoTile id={r.id} size={32} start={t0} style={{ marginRight: 14 }} />
            <div style={{ width: trackX - 110 - 44 - 46, fontFamily: fonts.hand, fontSize: 29, color: c.ink, whiteSpace: "nowrap" }}>{r.id === "nextjs-cached" ? "Next.js AI cached" : r.name}</div>
            <div style={{ position: "relative", width: trackW + 140, height: 26 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: 26, width: w, borderRadius: 6, background: g.fill, border: `2.5px solid ${g.stroke}`,
                backgroundImage: r.capped ? `repeating-linear-gradient(45deg, transparent 0 8px, ${g.stroke}33 8px 12px)` : undefined }} />
              <div style={{ position: "absolute", left: w + 12, top: -4, fontFamily: fonts.mono, fontWeight: 700, fontSize: 25, color: c.ink, whiteSpace: "nowrap", opacity: grow }}>
                {fmt(Math.round(users * grow))}{r.capped ? "+" : ""}
              </div>
            </div>
            <div style={{ marginLeft: "auto", paddingRight: 14, whiteSpace: "nowrap", fontFamily: fonts.mono, fontSize: 24, color: isNext ? c.fail : c.ink2, fontWeight: isNext ? 700 : 400 }}>{r.cpu_ms_per_req?.toFixed(2)} ms</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 110, top: top + rows.length * rowH + 8, display: "flex", gap: 28, fontFamily: fonts.hand, fontSize: 24, color: c.ink2, ...appear(f, 200) }}>
        {(["hydrate", "template", "static"] as const).map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: c[k].fill, border: `2px solid ${c[k].stroke}` }} />{typeLabel[k]}
          </span>
        ))}
        <span>+ = stopped at our 16,000-user cap</span>
      </div>
    </Paper>
  );
}

const typeLabel = { hydrate: "SSR + hydration", template: "server templates", static: "static + API" };

/** 4. The question the rest of the video answers. */
export function BigQuestion() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f - 6, fps, config: { damping: 9 } });
  const n = v("nextjs");
  return (
    <Paper>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
        <div style={{ transform: `scale(${pop})` }}><LogoTile id="nextjs" size={150} start={0} /></div>
        <div style={{ fontFamily: fonts.head, fontSize: 104, color: c.ink, transform: `scale(${0.9 + 0.1 * pop})`, whiteSpace: "nowrap" }}>
          but why is Next.js so slow
          {[0, 1, 2].map((i) => {
            const s = spring({ frame: f - 30 - i * 7, fps, config: { damping: 7 } });
            return <span key={i} style={{ display: "inline-block", color: c.fail, transform: `scale(${s}) translateY(${(1 - s) * -40}px)` }}>?</span>;
          })}
        </div>
        <div style={{ fontFamily: fonts.hand, fontSize: 40, color: c.ink2, ...appear(f, 60) }}>
          {fmt(n.users ?? 0)} users · {n.cpu_ms_per_req?.toFixed(1)} ms of CPU for every page
        </div>
      </AbsoluteFill>
    </Paper>
  );
}

/** 17. The answer: every layer of abstraction adds CPU per page. */
export function AbstractionLadder() {
  const f = useCurrentFrame();
  const ms = (id: string) => v(id).cpu_ms_per_req ?? 0;
  const range = (ids: string[]) => { const xs = ids.map(ms); return [Math.min(...xs), Math.max(...xs)] as const; };
  const levels: { t: string; d: string; ids: string[] }[] = [
    { t: "template → strings", d: "Express + EJS / Nunjucks", ids: ["express-nunjucks", "express"] },
    { t: "framework templates", d: "Astro (no hydration)", ids: ["astro"] },
    { t: "components + hydration data", d: "SolidStart · TanStack · SvelteKit · Remix · Nuxt · Qwik", ids: ["solidstart", "tanstack-start", "sveltekit", "remix", "nuxt", "qwik"] },
    { t: "a DOM on the server", d: "Angular", ids: ["angular"] },
    { t: "Server Components, twice", d: "Next.js App Router", ids: ["nextjs"] },
  ];
  const stepW = 290, x0 = 110, y0 = 880;
  const maxMs = 9;
  return (
    <Paper>
      <Title text="abstraction costs CPU" sub="every layer is extra work per request" width={980} />
      {levels.map((l, i) => {
        const h = 170 + i * 107, x = x0 + i * stepW, y = y0 - h, p = prog(f, 25 + i * 26, 18);
        const [lo, hi] = range(l.ids);
        const col = i === 0 ? c.template : i === 4 ? { fill: "#fbdcd8", stroke: c.fail } : c.hydrate;
        return (
          <React.Fragment key={l.t}>
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              <RoughRect x={x} y={y} w={stepW - 14} h={h} fill={col.fill} stroke={col.stroke} seed={500 + i} draw={p} />
            </svg>
            <div style={{ position: "absolute", left: x + 14, top: y + 12, width: stepW - 40, ...appear(f, 35 + i * 26) }}>
              <div style={{ fontFamily: fonts.head, fontSize: 30, lineHeight: 1.1, color: c.ink }}>{l.t}</div>
              <div style={{ fontFamily: fonts.hand, fontSize: 23, lineHeight: 1.2, color: c.ink2, marginTop: 6 }}>{l.d}</div>
              <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, color: c.ink, marginTop: 8 }}>
                {lo === hi ? lo.toFixed(2) : `${lo.toFixed(2)}–${hi.toFixed(2)}`} ms
              </div>
            </div>
            <div style={{ position: "absolute", left: x + 14, top: y0 + 14, width: stepW - 40, height: 12, borderRadius: 6, background: c.dots, opacity: p }}>
              <div style={{ width: `${Math.min(100, (hi / maxMs) * 100) * p}%`, height: "100%", borderRadius: 6, background: col.stroke }} />
            </div>
          </React.Fragment>
        );
      })}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <RoughLine x1={x0} y1={y0 + 60} x2={x0 + 5 * stepW - 30} y2={y0 + 60} seed={520} stroke={c.ink3} draw={prog(f, 20, 30)} />
      </svg>
      <Label x={x0} y={y0 + 70} size={30} color={c.ink2} start={30}>less abstraction</Label>
      <Label x={x0 + 5 * stepW - 30} y={y0 + 70} align="right" size={30} color={c.ink2} start={30}>more abstraction = more CPU per page</Label>
    </Paper>
  );
}

/** 18. Takeaways. */
export function TakeawaysV2() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines: [string, string][] = [
    ["more abstraction = more CPU per render", "string templates 0.5 ms. Server Components 8.4 ms."],
    ["language and framework matter a lot", "Express + Nunjucks held 9,700. JS is fine for frontend rendering."],
    ["don't just ask AI to “cache everything”. It won't work.", "AI “caching” only got Next.js up to 800 · proper caching got it to 3,600"],
    ["AI makes rewrites fast. Only rewrite when needed.", "measure first, then decide"],
    ["know your tools", "understand the fundamentals and how your tech stack works"],
  ];
  return (
    <Paper>
      <Title text="what I learned" width={640} />
      {lines.map(([t, sub], i) => {
        const start = 20 + i * 60;
        const s = spring({ frame: f - start, fps, config: { damping: 12 } });
        return (
          <div key={i} style={{ position: "absolute", left: 130, top: 290 + i * 150, display: "flex", gap: 28, alignItems: "flex-start", ...appear(f, start) }}>
            <div style={{ width: 70, height: 70, borderRadius: 35, background: c.highlight, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: fonts.head, fontSize: 44, color: c.ink, transform: `scale(${s})`, flex: "none" }}>{i + 1}</div>
            <div>
              <div style={{ fontFamily: fonts.head, fontSize: 48, color: c.ink, lineHeight: 1.15 }}>{t}</div>
              <div style={{ fontFamily: fonts.hand, fontSize: 32, color: c.ink2, marginTop: 4, opacity: prog(f, start + 14, 14) }}>{sub}</div>
            </div>
          </div>
        );
      })}
    </Paper>
  );
}

/** The investigation progress chip, shown in the top-right corner of the step shots. */
export function StepChip({ n, total = stepLabels.length, label }: { n: number; total?: number; label: string }) {
  const f = useCurrentFrame();
  const p = prog(f, 4, 14);
  return (
    <div style={{ position: "absolute", right: 60, top: 46, display: "flex", alignItems: "center", gap: 14, padding: "10px 20px 10px 14px", borderRadius: 40,
      background: "#fff", border: `2.5px solid ${c.ink}`, boxShadow: "0 4px 0 rgba(31,33,40,0.12)", opacity: p, transform: `translateY(${(1 - p) * -20}px)` }}>
      <LogoTile id="nextjs" size={40} start={4} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: fonts.hand, fontSize: 22, color: c.ink3 }}>why is Next.js so slow? · step {n} of {total}</span>
        <span style={{ fontFamily: fonts.head, fontSize: 30, color: c.ink, lineHeight: 1.1 }}>{label}</span>
      </div>
      <div style={{ display: "flex", gap: 5, marginLeft: 6 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: i < n ? c.hydrate.stroke : c.dots }} />
        ))}
      </div>
    </div>
  );
}

/** 2b. The site everyone renders: real phone screenshots of the Next.js build. */
export function TheSite() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = (src: string, x: number, delay: number, scroll: number, rot: number) => {
    const s = spring({ frame: f - delay, fps, config: { damping: 14 } });
    return (
      <div style={{ position: "absolute", left: x, top: 150, width: 380, height: 820, borderRadius: 52, background: c.ink, padding: 14,
        boxShadow: "0 18px 40px rgba(31,33,40,0.25)", transform: `translateY(${(1 - s) * 700}px) rotate(${rot}deg)` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 40, overflow: "hidden", background: "#f6f4ef" }}>
          <Img src={staticFile(src)} style={{ width: "100%", transform: `translateY(${-scroll}px)` }} />
        </div>
      </div>
    );
  };
  const scroll = interpolate(f, [90, 250], [0, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => t * t * (3 - 2 * t) });
  const notes = ["a tiny Twitter clone", "feed: 20 latest posts", "post page: one post", "like and write posts", "same HTML from every stack"];
  return (
    <Paper>
      <Title text="the site" sub="same pages, 21 ways" width={340} />
      {phone("site-mobile-long.png", 1000, 10, scroll, -3)}
      {phone("site-mobile-post.png", 1420, 30, 0, 3)}
      {notes.map((n, i) => (
        <Label key={n} x={130} y={360 + i * 90} size={40} font={i === 4 ? "head" : "hand"} color={i === 4 ? c.ink : c.ink2} start={50 + i * 22}>{n}</Label>
      ))}
    </Paper>
  );
}

/** 12b. The same React page, rendered by Next.js and by Remix. */
export function NextVsRemix() {
  const f = useCurrentFrame();
  const col = (x: number, id: string, name: string, ms: string, steps: [string, string][], code: string[], kb: number, codeTitle: string, start: number, bad: boolean) => (
    <>
      <div style={{ position: "absolute", left: x, top: 275, display: "flex", alignItems: "center", gap: 16, ...appear(f, start) }}>
        <LogoTile id={id} size={56} start={start} />
        <span style={{ fontFamily: fonts.head, fontSize: 44, color: c.ink }}>{name}</span>
        <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 36, color: bad ? c.fail : c.pass, marginLeft: 12 }}>{ms}</span>
      </div>
      {steps.map(([t, d], i) => (
        <div key={t} style={{ position: "absolute", left: x, top: 365 + i * 68, width: 800, display: "flex", gap: 16, alignItems: "baseline", ...appear(f, start + 20 + i * 26) }}>
          <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 28, color: c.ink3 }}>{i + 1}</span>
          <span style={{ fontFamily: fonts.head, fontSize: 32, color: c.ink }}>{t}</span>
          <span style={{ fontFamily: fonts.hand, fontSize: 26, color: c.ink2 }}>{d}</span>
        </div>
      ))}
      <div style={{ position: "absolute", left: x, top: 650, width: 800, ...appear(f, start + 130) }}>
        <div style={{ fontFamily: fonts.hand, fontSize: 26, color: c.ink2, marginBottom: 8 }}>{codeTitle}</div>
        <div style={{ background: "#fff", border: `2px solid ${c.ink3}`, borderRadius: 12, padding: "12px 16px", fontFamily: fonts.mono, fontSize: 17, lineHeight: 1.45, color: c.ink2, whiteSpace: "pre", overflow: "hidden", height: 150 }}>
          {code.join("\n")}
        </div>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ height: 26, width: (kb / 30) * 640 * prog(f, start + 150, 30), borderRadius: 6, background: bad ? "#fbdcd8" : c.template.fill, border: `2.5px solid ${bad ? c.fail : c.template.stroke}` }} />
          <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 28, color: c.ink, opacity: prog(f, start + 165, 10) }}>~{kb} KB</span>
        </div>
      </div>
    </>
  );
  return (
    <Paper>
      <Title text="same React, two ways" sub="server side per request" width={900} />
      {col(110, "nextjs", "Next.js", "8.44 ms", [
        ["Server Components", "run → Flight tree"],
        ["render again", "Flight tree → HTML"],
        ["inline the tree", "into <script> tags"],
        ["stream + gzip", "in Node"],
      ], [
        'self.__next_f.push([1,"c:[\\"$\\",\\"section\\",null,',
        '  {\\"className\\":\\"feed\\",\\"children\\":[[\\"$\\",',
        '  \\"article\\",\\"500000\\",{\\"className\\":\\"post\\",',
        '  \\"children\\":[[\\"$\\",\\"header\\",null,{...',
        '  ... every <div>, <span> and prop, as JSON'], 28, "shipped: the whole tree", 10, true)}
      {col(1010, "remix", "Remix", "1.73 ms", [
        ["loader", "→ plain JSON"],
        ["render HTML", "once"],
        ["embed the data", "just the posts"],
      ], [
        '{"posts":[',
        '  {"id":500000,"author":"swift_ember_22228",',
        '   "body":"TIL So keepalive...","likes":5},',
        '  ...',
        ']}   (simplified)'], 7, "shipped: just the data", 50, false)}
      <Label x={W / 2} y={985} align="center" size={36} font="head" start={260}>Next.js builds the tree twice. Remix renders once and ships data.</Label>
    </Paper>
  );
}

/** Investigation step labels (shown in the StepChip). */
export const stepLabels = ["is it RAM?", "where's the CPU going?", "is it React?", "just cache everything?", "what if no framework?", "what about other languages?"];

/** 16b. Four levers to make SSR cheaper, each measured against plain Next.js, with what each one costs you. */
export function FourWays() {
  const f = useCurrentFrame();
  const base = v("nextjs").users ?? 1;
  const levers: { t: string; same: string; ids: [string, string?][]; caveat: string }[] = [
    { t: "cache", same: "same Next.js app", ids: [["nextjs-cached", "AI cached"], ["nextjs-fullcache", "full cache"], ["nextjs-smart", "smart cache"]],
      caveat: "stale pages, invalidation bugs, and misses still cost a full render" },
    { t: "switch framework", same: "same Node runtime", ids: [["remix", "Remix"], ["solidstart", "SolidStart"], ["express-nunjucks", "Express + Nunjucks"]],
      caveat: "a rewrite means losing framework features" },
    { t: "switch runtime", same: "same Next.js app", ids: [["nextjs", "Next.js on Node"], ["nextjs-bun", "Next.js on Bun"]],
      caveat: "newer runtimes change how packages and tooling behave" },
    { t: "switch language", same: "same pages, new stack", ids: [["aspnet", "ASP.NET"], ["rust-axum", "Rust + Askama"]],
      caveat: "your team needs to learn it, plus two languages to manage" },
  ];
  const colW = 410, x0 = 110, gap = 20;
  return (
    <Paper>
      <Title text="four ways to speed it up" sub={`every number vs plain Next.js (${fmt(base)} users)`} width={820} />
      {levers.map((l, i) => {
        const x = x0 + i * (colW + gap), st = 20 + i * 40;
        const done = l.ids.map(([id]) => byId[id]).filter((r) => r && r.status === "done" && r.users);
        const best = done.length ? Math.max(...done.map((r) => r!.users!)) : 0;
        const bestCapped = done.some((r) => r!.users === best && r!.capped);
        return (
          <React.Fragment key={l.t}>
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              <RoughRect x={x} y={270} w={colW} h={590} fill={i === 0 ? c.hydrate.fill : i === 3 ? c.template.fill : "#fff"} stroke={i === 0 ? c.hydrate.stroke : i === 3 ? c.template.stroke : c.ink3} seed={700 + i} draw={prog(f, st, 20)} />
            </svg>
            <div style={{ position: "absolute", left: x + 22, top: 288, width: colW - 44, ...appear(f, st + 10) }}>
              <div style={{ fontFamily: fonts.head, fontSize: 34, color: c.ink, whiteSpace: "nowrap" }}>{i + 1}. {l.t}</div>
              <div style={{ fontFamily: fonts.hand, fontSize: 25, color: c.ink2 }}>{l.same}</div>
              <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 56, color: best ? c.pass : c.ink3, marginTop: 10 }}>
                {best ? `up to ${best / base < 10 ? (best / base).toFixed(1) : Math.round(best / base)}×${bestCapped ? "+" : ""}` : "testing…"}
              </div>
              {l.ids.map(([id, name], k) => {
                const r = byId[id], ok = r && r.status === "done" && r.users;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, ...appear(f, st + 30 + k * 12) }}>
                    <LogoTile id={id} size={38} start={st + 30 + k * 12} />
                    <span style={{ fontFamily: fonts.hand, fontSize: 28, color: c.ink, flex: 1, whiteSpace: "nowrap" }}>{name}</span>
                    <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 26, color: ok ? c.ink : c.ink3 }}>{ok ? fmt(r.users!) + (r.capped ? "+" : "") : "…"}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ position: "absolute", left: x + 22, top: 740, width: colW - 44, fontFamily: fonts.hand, fontSize: 24, lineHeight: 1.25, color: c.fail, ...appear(f, st + 90) }}>
              ⚠ {l.caveat}
            </div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: x0, top: 895, width: 4 * colW + 3 * gap, padding: "14px 22px", borderRadius: 14, background: c.highlight,
        fontFamily: fonts.hand, fontSize: 30, color: c.ink, ...appear(f, 260) }}>
        this test ignores <b>architecture</b> (client-side rendering, islands, edge) and <b>code readability</b>. It only measures CPU per page.
      </div>
    </Paper>
  );
}
