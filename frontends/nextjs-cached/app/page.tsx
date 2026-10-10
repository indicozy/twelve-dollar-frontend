import { connection } from "next/server";
import { Suspense } from "react";
import { getFeed } from "@/lib/api";
import { Compose } from "./compose";
import { PostCard, PostSkeleton } from "./post-card";

// The feed is not baked in at build time. `connection()` defers it to request time; getFeed() is a
// runtime cache ("use cache"), so only the first request after a write calls the API and the rest reuse
// the cached data. "/" has no URL param, so Next can't store it as a whole page the way it does post pages:
// the feed's React render still runs per request.
async function Feed() {
  await connection();
  const posts = await getFeed();
  return (
    <section className="feed">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Compose />
      <h1>Latest</h1>
      <Suspense fallback={<PostSkeleton count={20} />}>
        <Feed />
      </Suspense>
    </>
  );
}
