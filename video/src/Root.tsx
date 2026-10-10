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
      {[["FourWays", FourWays, 14], ["TheSite", TheSite, 9], ["NextVsRemix", NextVsRemix, 16], ["ResultsTable", ResultsTable, 16], ["BigQuestion", BigQuestion, 6], ["AbstractionLadder", AbstractionLadder, 14], ["TakeawaysV2", TakeawaysV2, 18]].map(([id, C, s]) =>
        <Composition key={id as string} id={id as string} component={C as React.FC} durationInFrames={(s as number) * FPS} fps={FPS} width={1920} height={1080} />)}
      {shots.map(([id, C, s]) => <Composition key={id} id={id} component={C} durationInFrames={s * FPS} fps={FPS} width={1920} height={1080} />)}
    </>
  );
}
