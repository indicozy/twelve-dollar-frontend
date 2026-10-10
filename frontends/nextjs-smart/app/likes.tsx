"use client";

// Live like counts: the cached page carries a starting count; after hydration the browser fetches current counts
// straight from the Rust API (NEXT_PUBLIC_API_URL; the API sends Access-Control-Allow-Origin: *), not through Next.
// The feed page reads GET /feed, a post page GET /posts/:id. Likes update the count locally.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { likeAction } from "./actions";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Counts = Record<number, number>;
const Ctx = createContext<{ counts: Counts; bump: (id: number) => void } | null>(null);

export function LiveLikes({ source, id, initial, children }: { source: "feed" | "post"; id?: number; initial: Counts; children: ReactNode }) {
  const [counts, setCounts] = useState<Counts>(initial);
  useEffect(() => {
    const url = source === "feed" ? `${API}/feed` : `${API}/posts/${id}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const live: Counts = {};
        for (const p of d.posts ?? [d.post]) live[p.id] = p.like_count;
        setCounts((c) => ({ ...c, ...live }));
      })
      .catch(() => {});
  }, [source, id]);
  return <Ctx.Provider value={{ counts, bump: (pid) => setCounts((c) => ({ ...c, [pid]: (c[pid] ?? 0) + 1 })) }}>{children}</Ctx.Provider>;
}

export function LikeButton({ id, initial }: { id: number; initial: number }) {
  const ctx = useContext(Ctx);
  const [pending, setPending] = useState(false);
  const count = ctx?.counts[id] ?? initial;
  async function like() {
    setPending(true);
    const status = await likeAction(id);
    if (status === "login") location.href = "/login";
    else if (status === 201) ctx?.bump(id);
    setPending(false);
  }
  return (
    <form action={like}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="like" disabled={pending}>
        ♥ <span>{count}</span>
      </button>
    </form>
  );
}
