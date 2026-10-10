import { loadFont as loadKalam } from "@remotion/google-fonts/Kalam";
import { loadFont as loadHand } from "@remotion/google-fonts/PatrickHand";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const fonts = {
  head: loadKalam("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily,
  hand: loadHand("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  mono: loadMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily,
};

// Whiteboard palette: warm paper, soft ink, one pastel fill + stroke per renderer group.
export const c = {
  paper: "#fbfaf5",
  dots: "#e6e3d8",
  ink: "#1f2128",
  ink2: "#5a5d68",
  ink3: "#8d909a",
  highlight: "#ffe27a",
  pass: "#1f9d63",
  fail: "#d9483f",
  hydrate: { fill: "#c3dcfa", stroke: "#2268c4" },
  template: { fill: "#ffd3b5", stroke: "#cf5a20" },
  static: { fill: "#bdeedb", stroke: "#138a5d" },
  neutral: { fill: "#f1efe7", stroke: "#3b3e47" },
  yellow: { fill: "#fff0b3", stroke: "#b8901a" },
  violet: { fill: "#e3dcff", stroke: "#5b46c9" },
};

export type Group = "hydrate" | "template" | "static";
export const groupLabel: Record<Group, string> = {
  hydrate: "SSR + hydration",
  template: "server templates",
  static: "static + API",
};
