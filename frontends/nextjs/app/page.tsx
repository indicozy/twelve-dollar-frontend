import { Suspense } from "react";
import { getFeed } from "@/lib/api";
import { Compose } from "./compose";
import { PostCard, PostSkeleton } from "./post-card";

async function Feed() {
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
