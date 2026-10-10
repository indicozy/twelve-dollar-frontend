import { createAsync, useSubmission, type RouteDefinition } from "@solidjs/router";
import { For } from "solid-js";
import { createPostAction } from "~/lib/actions";
import { PostCard } from "~/lib/PostCard";
import { getFeed } from "~/lib/queries";

export const route = { preload: () => getFeed() } satisfies RouteDefinition;

function Compose() {
  const sub = useSubmission(createPostAction);
  return (
    <form action={createPostAction} method="post" class="compose">
      <textarea name="body" maxLength={500} placeholder="What's happening on the $12 server?" required rows={3} />
      <div>
        {sub.result?.error ? <span class="error">{sub.result.error}</span> : <span class="muted">max 500 chars</span>}
        <button type="submit" disabled={sub.pending}>
          {sub.pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

export default function Home() {
  const posts = createAsync(() => getFeed());
  return (
    <>
      <Compose />
      <h1>Latest</h1>
      <section class="feed">
        <For each={posts()}>{(p) => <PostCard post={p} />}</For>
      </section>
    </>
  );
}
