import React from "react";
import { Composition } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Hook, OneUser, PassFail, Scope, SearchPath, Setup } from "./scenes/intro";
import { CacheCosts, Caching, CpuPerRequest, Leaderboard, NoFramework, NotRam, OtherJs, OtherLangs, Pipeline, ReactFamily, Takeaways } from "./scenes/results";
import { AbstractionLadder, BigQuestion, FourWays, NextVsRemix, ResultsTable, TakeawaysV2, TheSite } from "./scenes/v2";
import * as gV2 from "./scenes-gemma/v2";
import * as gIntro from "./scenes-gemma/intro";
import * as gResults from "./scenes-gemma/results";
import { makeVoiced } from "./Voiced";
import { Thumbnail, thumbnailSchema } from "./Thumbnail";
import { Still } from "remotion";

const FPS = 30;
export const shots: [string, React.FC, number][] = [
  ["Hook", Hook, 9], ["Scope", Scope, 11], ["Setup", Setup, 12], ["OneUser", OneUser, 12], ["PassFail", PassFail, 12], ["SearchPath", SearchPath, 12],
  ["ReactFamily", ReactFamily, 11], ["Pipeline", Pipeline, 12], ["Caching", Caching, 13], ["CacheCosts", CacheCosts, 12],
  ["OtherJs", OtherJs, 11], ["NoFramework", NoFramework, 11], ["OtherLangs", OtherLangs, 11], ["Leaderboard", Leaderboard, 14],
  ["CpuPerRequest", CpuPerRequest, 12], ["NotRam", NotRam, 8], ["Takeaways", Takeaways, 12],
];

const T = 15; // transition length in frames (half a second, overlapping the two shots)
// Mixed presentation types in one list; each is applied to a single transition.
const presentations = [slide({ direction: "from-right" }), wipe({ direction: "from-left" }), fade(), slide({ direction: "from-bottom" })] as unknown as ReturnType<typeof fade>[];

// The same shots with the on-screen text rewritten by Gemma (src/scenes-gemma/, generated from COPY.gemma.md).
const g = { ...gIntro, ...gResults } as Record<string, React.FC>;
export const gemmaShots: [string, React.FC, number][] = shots.map(([id, , s]) => [id, g[id], s]);

// v2 cut (STORYBOARD-v2.md): results first, then the investigation into why Next.js is slow, step by step.
function withStep(C: React.FC, n: number, label: string): React.FC {
  return () => (<><C /><gV2.StepChip n={n} label={label} /></>);
}
// v2 uses the Gemma-rewritten text everywhere (COPY.gemma.md, COPY-v2.gemma.md).
const step = (C: React.FC, n: number) => withStep(C, n, gV2.stepLabels[n - 1]);
export const v2Shots: [string, React.FC, number][] = [
  // the question, the scope, the site
  ["Hook", g.Hook, 9], ["Scope", g.Scope, 11], ["TheSite", gV2.TheSite, 9],
  // how we measured
  ["Setup", g.Setup, 10], ["OneUser", g.OneUser, 10], ["PassFail", g.PassFail, 10], ["SearchPath", g.SearchPath, 10],
  // results
  ["ResultsTable", gV2.ResultsTable, 16],
  // why: the investigation, step by step
  ["BigQuestion", gV2.BigQuestion, 6],
  ["NotRam", step(g.NotRam, 1), 8],
  ["CpuPerRequest", step(g.CpuPerRequest, 2), 12], ["Pipeline", step(g.Pipeline, 2), 12],
  ["ReactFamily", step(g.ReactFamily, 3), 10], ["NextVsRemix", step(gV2.NextVsRemix, 3), 16],
  ["Caching", step(g.Caching, 4), 12], ["CacheCosts", step(g.CacheCosts, 4), 12],
  ["NoFramework", step(g.NoFramework, 5), 11],
  ["OtherLangs", step(g.OtherLangs, 6), 11],
  ["FourWays", gV2.FourWays, 14],
  ["AbstractionLadder", gV2.AbstractionLadder, 14], ["TakeawaysV2", gV2.TakeawaysV2, 18],
];

// v3: the v2 cut with the new stacks (Go, Rails, Phoenix, Hono, Leptos, runtimes, nginx cache) and the fixes we found.
export const v3Shots: [string, React.FC, number][] = [
  ...v2Shots.slice(0, v2Shots.findIndex(([id]) => id === "FourWays")),
  ["FixFirst", gV2.FixFirst, 16],
  ...v2Shots.slice(v2Shots.findIndex(([id]) => id === "FourWays")),
];

function FullV3() {
  return <Sequenced list={v3Shots} />;
}

/** v3b: v3 with the five-ways-out-of-Next.js hub in place of the four-ways slide. */
export const v3bShots: [string, React.FC, number][] = (() => {
  // no "where the CPU goes" (same story as Next.js vs Remix); abstraction ladder right after Next.js vs Remix
  const base = v3Shots.filter(([id]) => id !== "Pipeline" && id !== "AbstractionLadder" && id !== "FourWays");
  const ladder = v3Shots.find(([id]) => id === "AbstractionLadder")!;
  const withLadder = (() => { const k = base.findIndex(([id]) => id === "NextVsRemix") + 1; return [...base.slice(0, k), ladder, ...base.slice(k)]; })();
  const at = withLadder.findIndex(([id]) => id === "TakeawaysV2");
  const withHub = [...withLadder.slice(0, at), ["NextHub", gV2.NextHub, 18] as [string, React.FC, number], ...withLadder.slice(at)];
  // the four cache setups as request paths, right after "what if we cache Next.js?"
  const c = withHub.findIndex(([id]) => id === "Caching") + 1;
  return [...withHub.slice(0, c), ["CacheModes", gResults.CacheModes, 16] as [string, React.FC, number], ...withHub.slice(c)];
})();
function FullV3b() {
  return <Sequenced list={v3bShots} />;
}

// v3b over the recorded voice-over; slide start times are editable in the Studio (VOICED_PROPS below).
const voiced = makeVoiced(v3bShots);

function FullV2() {
  return <Sequenced list={v2Shots} />;
}

function Full() {
  return <Sequenced list={shots} />;
}

function FullGemma() {
  return <Sequenced list={gemmaShots} />;
}

function Sequenced({ list }: { list: [string, React.FC, number][] }) {
  return (
    <TransitionSeries>
      {list.flatMap(([id, C, s], i) => [
        <TransitionSeries.Sequence key={id} durationInFrames={s * FPS}><C /></TransitionSeries.Sequence>,
        ...(i < list.length - 1
          ? [<TransitionSeries.Transition key={`${id}-t`} presentation={presentations[i % presentations.length]} timing={linearTiming({ durationInFrames: T })} />]
          : []),
      ])}
    </TransitionSeries>
  );
}

export function Root() {
  const len = (l: [string, React.FC, number][]) => l.reduce((n, [, , s]) => n + s * FPS, 0) - T * (l.length - 1);
  const total = len(shots);
  return (
    <>
      <Composition id="Full" component={Full} durationInFrames={total} fps={FPS} width={1920} height={1080} />
      <Composition id="FullGemma" component={FullGemma} durationInFrames={total} fps={FPS} width={1920} height={1080} />
      <Composition id="FullV2" component={FullV2} durationInFrames={len(v2Shots)} fps={FPS} width={1920} height={1080} />
      <Composition id="FullV3" component={FullV3} durationInFrames={len(v3Shots)} fps={FPS} width={1920} height={1080} />
      <Composition id="FullV3b" component={FullV3b} durationInFrames={len(v3bShots)} fps={FPS} width={1920} height={1080} />
      <Composition id="AllStacks" component={gResults.AllStacks} durationInFrames={240} fps={FPS} width={1920} height={2320} />
      <Still id="Thumbnail" component={Thumbnail} schema={thumbnailSchema} width={1920} height={1080}
        defaultProps={{ photo: "thumb/me.png", photoHeight: 540, photoX: -110 }} />
      <Composition id="Voiced" component={voiced.Voiced} schema={voiced.schema} calculateMetadata={voiced.metadata} durationInFrames={1} fps={FPS} width={1920} height={1080}
        defaultProps={{
        take: "takes/proga.mp4",
        audio: "",
        camera: "circle",
        cameraZoom: 1.35,
        ccTip: true,
        showLabels: false,
        end: 631.5,
        slides: [
          { id: "Hook", start: 0 },
          { id: "Scope", start: 19.8 },
          { id: "TheSite", start: 38.6 },
          { id: "Setup", start: 80.2 },
          { id: "OneUser", start: 120.1 },
          { id: "PassFail", start: 141.8 },
          { id: "SearchPath", start: 161.3 },
          { id: "ResultsTable", start: 180.8 },
          { id: "BigQuestion", start: 221.5 },
          { id: "NotRam", start: 226.1 },
          { id: "CpuPerRequest", start: 241.3 },
          { id: "ReactFamily", start: 263.3 },
          { id: "NextVsRemix", start: 275.9 },
          { id: "AbstractionLadder", start: 310.0 },
          { id: "Caching", start: 336.9 },
          { id: "CacheModes", start: 351.9 },
          { id: "CacheCosts", start: 371.2 },
          { id: "NoFramework", start: 398.6 },
          { id: "OtherLangs", start: 427.7 },
          { id: "FixFirst", start: 444.0 },
          { id: "NextHub", start: 504.8 },
          { id: "TakeawaysV2", start: 561.1 },
        ],
      }} />
      {[["G-SearchPath", g.SearchPath, 10], ["G-Hook", g.Hook, 9], ["G-Setup", g.Setup, 10], ["G-CpuPerRequest", g.CpuPerRequest, 12], ["G-CacheCosts", g.CacheCosts, 12], ["CacheModes", gResults.CacheModes, 16], ["G-NoFramework", g.NoFramework, 11], ["G-Ladder", gV2.AbstractionLadder, 14], ["G-Takeaways", gV2.TakeawaysV2, 18], ["NextHub", gV2.NextHub, 18], ["FixFirst", gV2.FixFirst, 16], ["G-FourWays", gV2.FourWays, 14], ["G-ResultsTable", gV2.ResultsTable, 16], ["G-OtherLangs", gResults.OtherLangs, 11], ["FourWays", FourWays, 14], ["TheSite", TheSite, 9], ["NextVsRemix", NextVsRemix, 16], ["ResultsTable", ResultsTable, 16], ["BigQuestion", BigQuestion, 6], ["AbstractionLadder", AbstractionLadder, 14], ["TakeawaysV2", TakeawaysV2, 18]].map(([id, C, s]) =>
        <Composition key={id as string} id={id as string} component={C as React.FC} durationInFrames={(s as number) * FPS} fps={FPS} width={1920} height={1080} />)}
      {shots.map(([id, C, s]) => <Composition key={id} id={id} component={C} durationInFrames={s * FPS} fps={FPS} width={1920} height={1080} />)}
    </>
  );
}
