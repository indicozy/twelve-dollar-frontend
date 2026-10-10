import Link from "next/link";
import { PostView } from "./post-view";

// Static export can't serve unknown ids, so one placeholder page is exported (/posts/_.html) and nginx
// serves it for every /posts/<number>. The browser reads the real id from the URL and fetches the post.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function PostPage() {
  return (
    <>
      <Link href="/" className="back">
        ← back to feed
      </Link>
      <PostView />
    </>
  );
}
