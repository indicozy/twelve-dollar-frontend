import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Compose } from "../components/Compose";
import { PostCard } from "../components/PostCard";
import { feedQuery } from "../lib/queries";

// The loader awaits the feed, so it is fetched on the server during SSR and both rendered and dehydrated into the
// HTML. Fresh on every request (new QueryClient per request, staleTime 0).
export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.query(feedQuery);
  },
  component: Home,
});

function Home() {
  const { data: posts } = useSuspenseQuery(feedQuery);
  return (
    <>
      <Compose />
      <h1>Latest</h1>
      <section className="feed">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </section>
    </>
  );
}
