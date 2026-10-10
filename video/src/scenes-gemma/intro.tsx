import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { appear, fmt, prog } from "../anim";
import { Box, H, Label, Paper, Person, Pill, Title, W } from "../components/layout";
import { RoughArrow, RoughEllipse, RoughLine, RoughRect } from "../components/rough";
import { v } from "../data";
import { c, fonts } from "../theme";
import { LogoTile } from "../components/logos";

/** 1. Hook: same everything, only the frontend changes; 500 vs 9,700. */
export function Hook() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lo = v("nextjs"), hi = v("express-nunjucks");
  const k = (start: number) => spring({ frame: f - start, fps, config: { damping: 30 } });
  const ratio = Math.round((hi.users ?? 0) / (lo.users ?? 1));
  const card = (x: number, id: string, name: string, users: number, col: { fill: string; stroke: string }, start: number, seed: number) => (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><RoughRect x={x} y={420} w={640} h={360} fill={col.fill} stroke={col.stroke} seed={seed} draw={prog(f, start, 22)} /></svg>
      <LogoTile id={id} size={84} start={start + 6} style={{ position: "absolute", left: x + 30, top: 390 }} />
      <Label x={x + 320} y={460} align="center" size={46} font="head" start={start + 10}>{name}</Label>
      <div style={{ position: "absolute", left: x, top: 545, width: 640, textAlign: "center", fontFamily: fonts.mono, fontWeight: 700, fontSize: 140, color: c.ink, ...appear(f, start + 14) }}>
        {fmt(users * k(start + 14))}
      </div>
      <Label x={x + 320} y={715} align="center" size={34} color={c.ink2} start={start + 20}>users on a tiny server</Label>
    </>
  );
  const stamp = spring({ frame: f - 175, fps, config: { damping: 9 } });
  return (
    <Paper>
      <Label x={W / 2} y={120} align="center" size={60} font="head" start={0}>same site, same API, same $12 server</Label>
      <Label x={W / 2} y={215} align="center" size={40} color={c.ink2} start={30}>just the frontend changes</Label>
      {card(250, lo.id, lo.name, lo.users ?? 0, c.hydrate, 70, 21)}
      {card(1030, hi.id, hi.name, hi.users ?? 0, c.template, 110, 22)}
      <div style={{ position: "absolute", left: W / 2, top: 600, transform: `translate(-50%,-50%) rotate(${-8 + Math.sin(f / 9) * 1.5}deg) scale(${stamp * (1 + 0.04 * Math.sin(f / 6) * Math.max(0, 1 - (f - 175) / 60))})`, fontFamily: fonts.head, fontSize: 96,
        color: c.fail, background: c.paper, border: `5px solid ${c.fail}`, borderRadius: 18, padding: "0 26px" }}>{ratio}×</div>
      <Label x={W / 2} y={880} align="center" size={64} font="head" start={200}>why is Next.js {ratio}× slower than Express?</Label>
    </Paper>
  );
}

/** 2. The setup: k6 → frontend server → API. */
export function Setup() {
  const f = useCurrentFrame();
  return (
    <Paper>
      <Title text="the setup" sub="two small servers" width={420} />
      <Box x={110} y={430} w={400} h={260} color={c.violet} start={20} seed={31} title="k6" body={<>load generator<br />thousands of users</>} />
      <Box x={760} y={400} w={460} h={320} color={c.hydrate} start={50} seed={32} title="frontend server" body={<><b>0.4 vCPU · 2 GB</b><br /><br /><br /></>} />
      <Box x={1470} y={430} w={360} h={260} color={c.neutral} start={80} seed={33} title="API" body={<>Rust + SQLite<br />~1 ms per request</>} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <RoughArrow x1={520} y1={560} x2={748} y2={560} seed={41} draw={prog(f, 70, 18)} />
        <RoughArrow x1={1230} y1={560} x2={1458} y2={560} seed={42} draw={prog(f, 100, 18)} />
      </svg>
      <LogoTile id="k6" size={62} start={30} style={{ position: "absolute", left: 128, top: 446 }} />
      <LogoTile id="rust-axum" size={56} start={90} style={{ position: "absolute", left: 1488, top: 446 }} />
      <LogoTile id="sqlite" size={56} start={96} style={{ position: "absolute", left: 1554, top: 446 }} />
      <Carousel x={990} y={612} start={60} />
      <Packets f={f} />
      <Label x={634} y={472} align="center" size={30} color={c.ink2} start={80}>page views</Label>
      <Label x={1344} y={472} align="center" size={30} color={c.ink2} start={110}>JSON</Label>
      <Label x={W / 2} y={800} align="center" size={38} start={140}>21 stacks, all rendering on the server</Label>
      <Label x={W / 2} y={860} align="center" size={30} color={c.ink3} start={170}>fresh DB and dedicated core for every run</Label>
    </Paper>
  );
}

/** 3. One user: the browsing loop, then a crowd. */
export function OneUser() {
  const f = useCurrentFrame();
  const steps = ["open the feed", "read for 3-7 s", "open a post", "15% like · 2% post", "idle 5-15 s"];
  const cx = 560, cy = 590, r = 250;
  const pts = steps.map((_, i) => { const a = -Math.PI / 2 + (i / steps.length) * Math.PI * 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const; });
  const cols = 25, rows = 16, shown = Math.floor(interpolate(f, [170, 300], [1, cols * rows], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <Paper>
      <Title text="what's a 'user'?" width={560} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <RoughEllipse cx={cx} cy={cy} w={r * 2} h={r * 2} stroke={c.ink3} seed={51} strokeWidth={2} draw={prog(f, 10, 40)} />
        {pts.map(([x, y], i) => <RoughEllipse key={i} cx={x} cy={y} w={30} h={30} fill={c.hydrate.fill} stroke={c.hydrate.stroke} seed={60 + i} draw={prog(f, 20 + i * 14, 14)} />)}
        <Person x={cx} y={cy - 30} s={3.2} color={c.hydrate.stroke} opacity={prog(f, 8, 14)} />
        {Array.from({ length: shown }).map((_, i) => <Person key={i} x={1130 + (i % cols) * 28} y={330 + Math.floor(i / cols) * 34} s={0.9} color={c.hydrate.stroke} />)}
      </svg>
      {pts.map(([x, y], i) => (
        <Label key={i} x={x + (x >= cx ? 30 : -30)} y={y - 22} align={Math.abs(x - cx) < 5 ? "center" : x > cx ? "left" : "right"} size={32} start={26 + i * 14}
          style={Math.abs(x - cx) < 5 ? { transform: "translate(-50%,-70px)" } : undefined}>{steps[i]}</Label>
      ))}
      <LogoTile id="k6" size={62} start={30} style={{ position: "absolute", left: 529, top: 640 }} />
      <Label x={560} y={712} align="center" size={30} color={c.ink2} start={40}>1 k6 virtual user</Label>
      <div style={{ position: "absolute", left: 1130, top: 190, display: "flex", alignItems: "center", gap: 14, ...appear(f, 140) }}>
        <LogoTile id="k6" size={48} start={140} />
        <span style={{ fontFamily: fonts.head, fontSize: 33, color: c.ink }}>k6 runs thousands of these at once</span>
      </div>
      <Label x={1130} y={262} size={32} color={c.ink2} start={150}>1 user ≈ 0.09 requests/s</Label>
      <Label x={1130} y={890} size={40} font="head" start={250}>{fmt(shown * 10)} users ≈ {fmt(shown * 10 * 0.09)} page renders/s</Label>
      <Label x={1130} y={950} size={28} color={c.ink3} start={250}>each icon = 10 users</Label>
    </Paper>
  );
}

/** 4. Pass or fail rules. */
export function PassFail() {
  const f = useCurrentFrame();
  const x0 = 260, x1 = 1660, base = 840, top = 640;
  const ramp = x0 + 200, hold = x1 - 140;
  return (
    <Paper>
      <Title text="pass or fail" sub="to pass, for 5 full minutes:" width={430} />
      <div style={{ position: "absolute", left: 110, top: 330, display: "flex", gap: 28 }}>
        {[["p95 < 500 ms", "95% of requests faster"], ["p99 < 1 s", "99% of requests faster"], ["errors < 1%", "hardly anything fails"]].map(([a, b], i) => (
          <div key={a} style={{ display: "flex", flexDirection: "column", gap: 8, ...appear(f, 30 + i * 16) }}>
            <Pill color={c.static} style={{ fontSize: 46, fontFamily: fonts.mono, fontWeight: 700 }}>{a}</Pill>
            <span style={{ fontFamily: fonts.hand, fontSize: 30, color: c.ink2, paddingLeft: 10 }}>{b}</span>
          </div>
        ))}
      </div>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <RoughLine x1={x0} y1={base} x2={x1} y2={base} seed={71} draw={prog(f, 90, 20)} />
        <RoughLine x1={x0} y1={base} x2={ramp} y2={top} seed={72} stroke={c.hydrate.stroke} strokeWidth={4} draw={prog(f, 110, 16)} />
        <RoughRect x={ramp} y={top} w={hold - ramp} h={base - top} fill={c.yellow.fill} stroke={c.yellow.stroke} seed={73} draw={prog(f, 125, 26)} />
        <RoughLine x1={hold} y1={top} x2={x1} y2={base} seed={74} stroke={c.hydrate.stroke} strokeWidth={4} draw={prog(f, 150, 14)} />
      </svg>
      <Label x={(ramp + hold) / 2} y={(top + base) / 2 - 28} align="center" size={48} font="head" start={140}>5-minute hold</Label>
      <Label x={x0 + 40} y={base + 16} size={30} color={c.ink2} start={120}>60s ramp-up</Label>
      <Label x={x1} y={base + 16} align="right" size={30} color={c.ink2} start={160}>30s ramp-down</Label>
      <Label x={W / 2} y={960} align="center" size={34} color={c.ink2} start={190}>fresh DB and container for every run</Label>
    </Paper>
  );
}

/** 5. Finding the limit: Express's real search path. */
export function SearchPath() {
  const f = useCurrentFrame();
  const e = v("express");
  const steps = e.steps ?? [];
  const lo = 4000, hi = 10000, ax0 = 160, ax1 = 1760, ay = 760;
  const X = (u: number) => ax0 + ((u - lo) / (hi - lo)) * (ax1 - ax0);
  return (
    <Paper>
      <Title text="finding the limit" sub={`${e.name}: every run in order, 2-minute runs then 5-minute holds`} width={540} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <RoughArrow x1={ax0} y1={ay} x2={ax1 + 30} y2={ay} seed={81} draw={prog(f, 10, 20)} />
        {steps.map((s, i) => {
          const t = 30 + i * 13, y = ay - 70 - (s.run === "5m" ? 190 : 0) - (i % 2) * 32;
          const p = prog(f, t, 10);
          const col = s.ok ? c.pass : c.fail;
          return (
            <g key={i} opacity={p}>
              <line x1={X(s.users)} y1={ay} x2={X(s.users)} y2={y + 16} stroke={col} strokeWidth={2} strokeDasharray="4 6" />
              <circle cx={X(s.users)} cy={y} r={15 * p} fill={col} />
              <text x={X(s.users)} y={y + 6} textAnchor="middle" fontFamily={fonts.mono} fontSize={14} fontWeight={700} fill="#fff">{i + 1}</text>
            </g>
          );
        })}
      </svg>
      {[4000, 6000, 8000, 10000].map((u) => <Label key={u} x={X(u)} y={ay + 18} align="center" size={28} font="mono" color={c.ink2} start={14}>{fmt(u)}</Label>)}
      <Label x={ax0} y={ay - 165} size={30} color={c.ink2} start={40}>2m runs ↓</Label>
      <Label x={ax0} y={ay - 355} size={30} color={c.ink2} start={40}>5m holds ↓</Label>
      <div style={{ position: "absolute", left: 110, top: 900, display: "flex", gap: 30, ...appear(f, 60) }}>
        <Pill color={{ fill: "#d6f3e4", stroke: c.pass }}>pass</Pill><Pill color={{ fill: "#fbdcd8", stroke: c.fail }}>fail</Pill>
      </div>
      <Label x={X(e.users ?? 0)} y={900} align="center" size={52} font="head" start={30 + steps.length * 13 + 10}>score: {fmt(e.users ?? 0)} users</Label>
    </Paper>
  );
}

/** Framework logos cycling inside the frontend-server box: "the thing we swap". */
function Carousel({ x, y, start }: { x: number; y: number; start: number }) {
  const f = useCurrentFrame();
  const ids = ["nextjs", "remix", "sveltekit", "nuxt", "angular", "solidstart", "qwik", "astro", "express", "flask", "django", "aspnet", "laravel", "spring", "rust-axum"];
  const per = 14, k = Math.max(0, f - start);
  const i = Math.floor(k / per) % ids.length, t = (k % per) / per;
  const o = f < start ? 0 : Math.min(1, t * 4, (1 - t) * 4 + 0.25);
  return (
    <div style={{ position: "absolute", left: x - 40, top: y, opacity: o, transform: `translateY(${(1 - Math.min(1, t * 4)) * 10}px)` }}>
      <LogoTile id={ids[i]} size={80} start={start} />
    </div>
  );
}

/** Request packets travelling k6 → frontend → API and back, looping. */
function Packets({ f }: { f: number }) {
  const lanes = [{ x1: 520, x2: 748, y: 560, col: c.violet.stroke, from: 80 }, { x1: 1230, x2: 1458, y: 560, col: c.hydrate.stroke, from: 110 }];
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {lanes.flatMap((l, li) => Array.from({ length: 4 }).map((_, k) => {
        if (f < l.from) return null;
        const t = (((f - l.from) / 40 + k / 4) % 1);
        const back = k % 2 === 1;
        const x = back ? l.x2 - t * (l.x2 - l.x1) : l.x1 + t * (l.x2 - l.x1);
        return <circle key={`${li}-${k}`} cx={x} cy={l.y + (back ? 22 : -22)} r={7} fill={back ? c.pass : l.col} opacity={Math.sin(t * Math.PI)} />;
      }))}
    </svg>
  );
}

/** 2. Scope: we test rendering on the server, not what happens in the browser. */
export function Scope() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeLeft = interpolate(f, [150, 175], [1, 0.42], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lift = spring({ frame: f - 170, fps, config: { damping: 14 } });
  const left = ["JS bundle size", "hydration speed", "browser rendering", "Core Web Vitals"];
  const right = ["max users per server", "CPU per page", "latency under load (p95, p99)", "server memory"];
  const list = (items: string[], x: number, start: number, mark: string, col: string) => (
    <div style={{ position: "absolute", left: x, top: 560, display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((t, i) => (
        <div key={t} style={{ display: "flex", gap: 14, alignItems: "baseline", fontFamily: fonts.hand, fontSize: 36, color: c.ink, ...appear(f, start + i * 10) }}>
          <span style={{ fontFamily: fonts.head, color: col, width: 26 }}>{mark}</span>{t}
        </div>
      ))}
    </div>
  );
  return (
    <Paper>
      <Title text="what i'm testing" width={700} />
      {/* left: the browser (not tested) */}
      <div style={{ position: "absolute", inset: 0, opacity: fadeLeft }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <RoughRect x={110} y={270} w={780} h={620} fill={c.neutral.fill} stroke={c.neutral.stroke} seed={91} draw={prog(f, 15, 24)} />
          <RoughRect x={150} y={330} w={300} h={190} fill="#fff" stroke={c.ink3} seed={92} strokeWidth={2} draw={prog(f, 30, 18)} />
          <RoughLine x1={150} y1={362} x2={450} y2={362} stroke={c.ink3} seed={93} strokeWidth={2} draw={prog(f, 40, 10)} />
          {[0, 1, 2].map((i) => <circle key={i} cx={168 + i * 18} cy={346} r={5} fill={c.ink3} opacity={prog(f, 44, 8)} />)}
          {[0, 1, 2].map((i) => <RoughLine key={i} x1={175} y1={395 + i * 36} x2={175 + 220 - i * 50} y2={395 + i * 36} stroke={c.hydrate.stroke} seed={94 + i} strokeWidth={6} draw={prog(f, 48 + i * 6, 10)} />)}
        </svg>
        <Label x={490} y={340} size={44} font="head" start={30}>in the browser</Label>
        <Label x={490} y={405} size={32} color={c.ink2} start={36}>client-side rendering</Label>
        {list(left, 160, 60, "·", c.ink3)}
      </div>
      {/* the X over the browser side */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <RoughLine x1={150} y1={300} x2={850} y2={860} stroke={c.fail} strokeWidth={8} seed={97} roughness={1.8} draw={prog(f, 128, 12)} />
        <RoughLine x1={850} y1={300} x2={150} y2={860} stroke={c.fail} strokeWidth={8} seed={98} roughness={1.8} draw={prog(f, 140, 12)} />
      </svg>
      <Label x={500} y={905} align="center" size={30} color={c.ink2} start={160}>not tested here (the static build is shown only as a reference)</Label>
      {/* right: the server (tested) */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${-lift * 10}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <RoughRect x={1030} y={270} w={780} h={620} fill={c.yellow.fill} fillOpacity={0.35 + 0.65 * lift} stroke={c.hydrate.stroke} strokeWidth={3} seed={95} draw={prog(f, 70, 24)} />
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              <RoughRect x={1070} y={330 + i * 62} w={300} h={48} fill="#fff" stroke={c.ink2} seed={110 + i} strokeWidth={2} draw={prog(f, 84 + i * 6, 12)} />
              <circle cx={1094} cy={354 + i * 62} r={6} fill={c.pass} opacity={prog(f, 96 + i * 6, 8) * (0.5 + 0.5 * Math.abs(Math.sin((f + i * 9) / 7)))} />
            </React.Fragment>
          ))}
        </svg>
        <Label x={1410} y={340} size={44} font="head" start={84}>on the server</Label>
        <Label x={1410} y={405} size={32} color={c.ink2} start={90}>server-side rendering</Label>
        {list(right, 1080, 110, "✓", c.pass)}
        <div style={{ position: "absolute", left: 1640, top: 250, transform: `scale(${lift}) rotate(4deg)` }}>
          <Pill color={c.static} style={{ fontSize: 30 }}>the goal</Pill>
        </div>
      </div>
      <Label x={W / 2} y={975} align="center" size={42} font="head" start={200}>same HTML, different costs. why?</Label>
    </Paper>
  );
}
