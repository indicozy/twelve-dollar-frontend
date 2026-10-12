import raw from "./data.json";

export type Variant = {
  id: string; name: string; lang: string; group: "hydrate" | "template" | "static"; status: string;
  users?: number; capped?: boolean; req_s?: number; p95?: number; p99?: number; cpu_ms_per_req?: number;
  web_cpu_of_vcpu?: number; web_mem_peak?: number; api_cpu_of_vcpu?: number; best_2m?: number;
  estimate?: { users: number; why: string };
  steps?: { users: number; run: string; ok: boolean; p95: number; p99: number }[];
};
export const variants = (raw as { variants: Variant[] }).variants;
export const byId = Object.fromEntries(variants.map((v) => [v.id, v])) as Record<string, Variant>;
export const v = (id: string) => {
  const x = byId[id];
  if (!x) throw new Error(`no variant ${id} in data.json`);
  return x;
};
/** Tuned copies (and Octane, a tuned Laravel) are shown as before/after fixes, not as separate stacks. */
export const isFix = (id: string) => id.endsWith("-tuned") || id === "laravel-octane";
/** Users to show: the estimated limit for stacks that held the 30,000-user cap, else the measured score. */
export const shown = (x: Variant) => (x.capped && x.estimate ? x.estimate.users : x.users ?? 0);
/** "~50,000 est." for estimated stacks, "16,100" otherwise. */
export const usersLabel = (x: Variant, n = shown(x)) => (x.capped && x.estimate ? `~${Math.round(n).toLocaleString("en-US")} est.` : Math.round(n).toLocaleString("en-US"));
export const stacks = variants.filter((x) => x.status === "done" && !isFix(x.id));
