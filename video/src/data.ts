import raw from "./data.json";

export type Variant = {
  id: string; name: string; lang: string; group: "hydrate" | "template" | "static"; status: string;
  users?: number; capped?: boolean; req_s?: number; p95?: number; p99?: number; cpu_ms_per_req?: number;
  web_cpu_of_vcpu?: number; web_mem_peak?: number; api_cpu_of_vcpu?: number; best_2m?: number;
  steps?: { users: number; run: string; ok: boolean; p95: number; p99: number }[];
};
export const variants = (raw as { variants: Variant[] }).variants;
export const byId = Object.fromEntries(variants.map((v) => [v.id, v])) as Record<string, Variant>;
export const v = (id: string) => {
  const x = byId[id];
  if (!x) throw new Error(`no variant ${id} in data.json`);
  return x;
};
