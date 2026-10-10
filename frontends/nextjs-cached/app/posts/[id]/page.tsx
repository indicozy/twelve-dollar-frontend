import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPost } from "@/lib/api";
import { PostCard, PostSkeleton } from "../../post-card";

// No post is rendered at build time. Cache Components requires at least one param here, so "0" is a
// placeholder (an invalid id: it renders the not-found page without calling the API). Every real id is
// rendered on its first visit, stored, and served from the cache afterwards (ISR); writes invalidate it by tag.
export async function generateStaticParams() {
  return [{ id: "0" }];
}

async function PostView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();
  return <PostCard post={post} link={false} />;
}

export default function PostPage({ params }: PageProps<"/posts/[id]">) {
  return (
    <>
      <Link href="/" className="back">
        ← back to feed
      </Link>
      <Suspense fallback={<PostSkeleton />}>
        <PostView params={params} />
      </Suspense>
    </>
  );
}
