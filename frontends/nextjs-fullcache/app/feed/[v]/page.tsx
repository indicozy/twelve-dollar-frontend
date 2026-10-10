import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFeed } from "@/lib/api";
import { Compose } from "../../compose";
import { LiveLikes } from "../../likes";
import { PostCard, PostSkeleton } from "../../post-card";

// "/" is rewritten here (next.config.ts). Cache Components needs at least one param at build time: "_build" is a
// placeholder that renders not-found without calling the API. "latest" is rendered on its first request, stored,
// and regenerated in the background every 15 s ("feed" cache life); likes and new posts never force it.
export function generateStaticParams() {
  return [{ v: "_build" }];
}

async function Feed({ params }: { params: Promise<{ v: string }> }) {
  const { v } = await params;
  if (v !== "latest") notFound();
  const posts = await getFeed();
  return (
    <LiveLikes source="feed" initial={Object.fromEntries(posts.map((p) => [p.id, p.like_count]))}>
      <section className="feed">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </section>
    </LiveLikes>
  );
}

export default function FeedPage({ params }: PageProps<"/feed/[v]">) {
  return (
    <>
      <Compose />
      <h1>Latest</h1>
      <Suspense fallback={<PostSkeleton count={20} />}>
        <Feed params={params} />
      </Suspense>
    </>
  );
}
