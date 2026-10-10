import React from "react";
import { useCurrentFrame } from "remotion";
import { appear, fmt, prog } from "../anim";
import { BarChart, GroupLegend } from "../components/BarChart";
import { Box, H, Label, Paper, Pill, Title, W } from "../components/layout";
import { RoughArrow, RoughRect } from "../components/rough";
import { v, variants } from "../data";
import { c, fonts } from "../theme";
import { LogoTile } from "../components/logos";

const SCALE = 10500; // shared ruler for the per-group charts (Rust's capped bar is clamped, see OtherLangs)
const pick = (...ids: string[]) => ids.map(v);

/** 6. React family. */
export function ReactFamily() {
  const items = pick("nextjs", "remix", "tanstack-start");
  const ratio = Math.round((v("remix").users ?? 0) / (v("nextjs").users ?? 1));
  return (
    <Paper>
      <Title text="same React, very different results" width={980} />
      <BarChart items={items} y={330} rowH={120} max={SCALE} start={20} stagger={16} />
      <Label x={110} y={760} size={42} font="head" start={90}>Remix and TanStack Start: about {ratio}× the users of Next.js</Label>
      <Label x={110} y={830} size={32} color={c.ink2} start={110}>all three use SSR and hydration</Label>
    </Paper>
  );
}

/** 7. Why Next.js is slow: the render pipeline. */
export function Pipeline() {
  const f = useCurrentFrame();
  const row = (y: number, steps: [string, string][], col: { fill: string; stroke: string }, start: number, label: string, ms: number, logo: string) => (
    <>
      <LogoTile id={logo} size={52} start={start} style={{ position: "absolute", left: 110, top: y - 64 }} />
      <Label x={176} y={y - 60} size={40} font="head" start={start}>{label}</Label>
      {steps.map(([t, b], i) => (
        <Box key={t} x={110 + i * 330} y={y} w={290} h={150} color={i === 0 ? c.neutral : col} start={start + 8 + i * 12} seed={100 + y + i} title={t} body={b} titleSize={32} />
      ))}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {steps.slice(1).map((_, i) => <RoughArrow key={i} x1={400 + i * 330 + 4} y1={y + 75} x2={440 + i * 330 - 4} y2={y + 75} head={10} seed={300 + y + i} draw={prog(f, start + 20 + i * 12, 10)} />)}
      </svg>
      <div style={{ position: "absolute", left: 110 + (steps.length - 1) * 330 + 290, top: y + 165, whiteSpace: "nowrap", display: "flex", alignItems: "baseline", gap: 14,
        opacity: appear(f, start + 20 + steps.length * 12).opacity, transform: `translateX(-100%) ${appear(f, start + 20 + steps.length * 12).transform}` }}>
        <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 46, color: c.ink }}>{ms.toFixed(1)} ms</span>
        <span style={{ fontFamily: fonts.hand, fontSize: 30, color: c.ink2 }}>CPU per request</span>
      </div>
    </>
  );
  return (
    <Paper>
      <Title text="where the CPU goes" sub="turning 20 posts into a page" width={600} />
      {row(380, [["fetch data", "1 API call"], ["render Server Components", "to a component tree"], ["render HTML", "from that tree"], ["inline the tree", "~28 KB in the page"], ["gzip", "default Node behavior"]],
        c.hydrate, 30, "Next.js App Router", v("nextjs").cpu_ms_per_req ?? 0, "nextjs")}
      {row(690, [["fetch data", "1 API call"], ["render HTML", "one pass"], ["embed data", "~7 KB in the page"]], c.hydrate, 110, "Remix (React Router 7)", v("remix").cpu_ms_per_req ?? 0, "remix")}
    </Paper>
  );
}

/** 8. Caching Next.js. */
export function Caching() {
  const items = pick("nextjs", "nextjs-cached", "nextjs-fullcache", "nextjs-smart").map((x) => (x.id === "nextjs-cached" ? { ...x, name: "Next.js AI cached" } : x));
  const e = v("express");
  return (
    <Paper>
      <Title text="what if we cache Next.js?" width={760} />
      <BarChart items={items} y={330} rowH={100} max={SCALE} start={20} stagger={22} labelW={430} ref={{ label: `${e.name} ${fmt(e.users ?? 0)}`, value: e.users ?? 0 }} />
      <Label x={110} y={790} size={40} font="head" start={140}>a cached page costs 0.40 ms CPU (same as Express)</Label>
      <Label x={110} y={860} size={32} color={c.ink2} start={160}>cached data only (800) still renders the feed every time · full and smart cache store whole pages</Label>
    </Paper>
  );
}

/** 9. Where the cached build's CPU goes. */
export function CacheCosts() {
  const cards: [string, string][] = [
    ["new posts", "each new post needs a full render first"],
    ["writes", "a like through a Next.js route handler: 0.56 ms (Express: 0.11 ms)"],
    ["page size", "the stored feed is 39 KB (Express: 12 KB): it still carries the component payload"],
    ["single thread", "regen and GC block it for ms. p99 breaks first."],
  ];
  return (
    <Paper>
      <Title text="so why only 3,600?" sub="the cache isn't the cost; the work around it is" width={640} />
      {cards.map(([t, b], i) => (
        <Box key={t} x={110 + (i % 2) * 860} y={340 + Math.floor(i / 2) * 290} w={800} h={240} color={i === 3 ? c.yellow : c.hydrate} start={20 + i * 22} seed={400 + i}
          title={t} body={b} titleSize={44} />
      ))}
    </Paper>
  );
}

/** 10. Other JS frameworks. */
export function OtherJs() {
  return (
    <Paper>
      <Title text="other JS frameworks" width={760} />
      <BarChart items={pick("angular", "qwik", "nuxt", "astro", "sveltekit", "solidstart")} y={290} rowH={92} max={SCALE} start={20} stagger={12} />
      <Label x={110} y={880} size={34} color={c.ink2} start={110}>compiled string templates (Solid, Svelte) at the top · a server-side DOM (Angular) at the bottom</Label>
    </Paper>
  );
}

/** 11. No framework at all. */
export function NoFramework() {
  return (
    <Paper>
      <Title text="no framework at all" sub="plain Express on Node" width={600} />
      <BarChart items={pick("solidstart", "express", "express-nunjucks")} y={380} rowH={120} max={SCALE} start={20} stagger={18} />
      <div style={{ position: "absolute", left: 110, top: 800, display: "flex", gap: 24 }}>
        <Pill>rendering the feed: EJS 0.17 ms · Nunjucks 0.08 ms</Pill>
      </div>
      <Label x={110} y={880} size={32} color={c.ink2} start={110}>no component tree or hydration data. just templates as functions.</Label>
    </Paper>
  );
}

/** 12. Other languages. */
export function OtherLangs() {
  const items = pick("laravel", "django", "flask", "spring", "aspnet", "rust-axum");
  return (
    <Paper>
      <Title text="outside JavaScript" width={600} />
      <BarChart items={items} y={290} rowH={92} max={16800} start={20} stagger={12} />
      <Label x={110} y={880} size={34} color={c.ink2} start={110}>Rust hit our 16k user cap at 45% CPU. Laravel boots the framework every request.</Label>
    </Paper>
  );
}

/** 13. Leaderboard. */
export function Leaderboard() {
  const items = variants.filter((x) => x.status === "done").sort((a, b) => (b.users ?? 0) - (a.users ?? 0));
  return (
    <Paper>
      <Title text="the leaderboard" sub="5-minute hold · 0.4 vCPU · 2 GB" width={540} x={110} y={40} />
      <GroupLegend x={1120} y={70} start={10} />
      <BarChart items={items} y={210} rowH={40} max={16800} start={24} stagger={2} labelW={420} width={1700} />
    </Paper>
  );
}

/** 14. CPU per request. */
export function CpuPerRequest() {
  const items = variants.filter((x) => x.status === "done" && x.cpu_ms_per_req && x.group !== "static" && !x.capped)
    .sort((a, b) => (b.cpu_ms_per_req ?? 0) - (a.cpu_ms_per_req ?? 0));
  return (
    <Paper>
      <Title text="CPU per request" sub="ms of CPU per stack limit" width={560} x={110} y={40} />
      <BarChart items={items} y={220} rowH={40} start={20} stagger={5} labelW={420} width={1350} value={(x) => x.cpu_ms_per_req ?? 0} format={(n) => n.toFixed(2) + " ms"} />
      <div style={{ position: "absolute", left: 1460, top: 420, width: 400, fontFamily: fonts.head, fontSize: 46, lineHeight: 1.25, color: c.ink, ...appear(useCurrentFrame(), 120) }}>
        users ≈<br />CPU budget<br />÷ CPU per request
      </div>
    </Paper>
  );
}

/** 15. Not RAM. */
export function NotRam() {
  const f = useCurrentFrame();
  const items = pick("nextjs", "angular", "laravel", "sveltekit");
  return (
    <Paper>
      <Title text="is it RAM?" sub="at the limit, out of 2 GB" width={380} />
      {items.map((it, i) => {
        const y = 360 + i * 140, p = prog(f, 20 + i * 12, 30);
        const cpu = (it.web_cpu_of_vcpu ?? 0) / 100, mem = (it.web_mem_peak ?? 0) / 2048;
        const bar = (x: number, frac: number, col: { fill: string; stroke: string }, label: string) => (
          <div style={{ position: "absolute", left: x, top: y, width: 600, height: 50, border: `3px solid ${c.ink3}`, borderRadius: 10, boxSizing: "border-box" }}>
            <div style={{ width: `${frac * 100 * p}%`, height: "100%", background: col.fill, borderRight: `3px solid ${col.stroke}`, borderRadius: 7 }} />
            <div style={{ position: "absolute", left: 14, top: 4, fontFamily: fonts.mono, fontWeight: 700, fontSize: 28, color: c.ink }}>{label}</div>
          </div>
        );
        return (
          <React.Fragment key={it.id}>
            <LogoTile id={it.id} size={56} start={14 + i * 12} style={{ position: "absolute", left: 110, top: y - 3 }} />
            <Label x={184} y={y + 2} size={38} start={14 + i * 12}>{it.name}</Label>
            {bar(520, cpu, { fill: "#fbdcd8", stroke: c.fail }, `CPU ${fmt(cpu * 100 * p)}%`)}
            {bar(1180, mem, c.static, `RAM ${fmt((it.web_mem_peak ?? 0) * p)} MiB`)}
          </React.Fragment>
        );
      })}
      <Label x={110} y={930} size={40} font="head" start={120}>CPU is maxed, memory isn't. more RAM won't change anything.</Label>
    </Paper>
  );
}

/** 16. Takeaways. */
export function Takeaways() {
  const lines = [
    "with a fast API, the renderer decides your user limit",
    "Next.js renders twice; caching helps 7×, then hits the same wall",
    "compiled string templates win, even in Express",
    "add CPU, not RAM. or pick a cheaper renderer",
  ];
  const f = useCurrentFrame();
  return (
    <Paper>
      <Title text="takeaways" width={760} />
      {lines.map((t, i) => (
        <div key={i} style={{ position: "absolute", left: 140, top: 340 + i * 140, display: "flex", gap: 26, alignItems: "baseline", ...appear(f, 20 + i * 40) }}>
          <span style={{ fontFamily: fonts.head, fontSize: 56, color: c.hydrate.stroke }}>{i + 1}</span>
          <span style={{ fontFamily: fonts.hand, fontSize: 50, color: c.ink }}>{t}</span>
        </div>
      ))}
    </Paper>
  );
}
