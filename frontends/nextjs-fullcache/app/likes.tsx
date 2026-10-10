"use client";

// Like counts come only from the stored page (no live fetch): the full-cache variant. A like updates the count on
// the page the user is looking at; other visitors see it when the page is regenerated (feed: 30 s; post pages: on edit).
import { createContext, useContext, useState, type ReactNode } from "react";
import { likeAction } from "./actions";

type Counts = Record<number, number>;
const Ctx = createContext<{ counts: Counts; bump: (id: number) => void } | null>(null);

export function LiveLikes({ initial, children }: { source: "feed" | "post"; id?: number; initial: Counts; children: ReactNode }) {
  const [counts, setCounts] = useState<Counts>(initial);
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
