import { createAsync, useParams, type RouteDefinition } from "@solidjs/router";
import { Show } from "solid-js";
import { NotFound } from "~/lib/NotFound";
import { PostCard } from "~/lib/PostCard";
import { getPost } from "~/lib/queries";

export const route = { preload: ({ params }) => getPost(params.id!) } satisfies RouteDefinition;

export default function PostPage() {
  const params = useParams();
  // deferStream holds the streamed shell until the post is loaded, so a missing post can still set a real 404 status
  // (the status is fixed when the shell is flushed). The feed page keeps plain streaming.
  const post = createAsync(() => getPost(params.id!), { deferStream: true });
  return (
    <Show when={post() !== null} fallback={<NotFound />}>
      <a href="/" class="back">
        ← back to feed
      </a>
      <Show when={post()}>{(p) => <PostCard post={p()} link={false} />}</Show>
    </Show>
  );
}
