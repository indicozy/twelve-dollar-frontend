"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getPost, type Post } from "@/lib/api";
import { PostCard, PostSkeleton } from "../../post-card";

export function PostView() {
  const pathname = usePathname();
  const [post, setPost] = useState<Post | null | undefined>(undefined);

  useEffect(() => {
    // usePathname can still report the placeholder on a hard load; the address bar is the source of truth.
    const id = (pathname.endsWith("/_") ? location.pathname : pathname).split("/").pop() ?? "";
    setPost(undefined);
    getPost(id).then(setPost, () => setPost(null));
  }, [pathname]);

  if (post === undefined) return <PostSkeleton />;
  if (post === null)
    return (
      <div className="empty">
        <h1>Not found</h1>
        <Link href="/">← back to feed</Link>
      </div>
    );
  return <PostCard post={post} link={false} />;
}
