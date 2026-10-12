import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPost } from "@/lib/api";
import { PostCard, PostSkeleton } from "../../post-card";

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
