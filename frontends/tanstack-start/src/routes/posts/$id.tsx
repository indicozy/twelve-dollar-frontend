import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { NotFound } from "../../components/NotFound";
import { PostCard } from "../../components/PostCard";
import { postQuery } from "../../lib/queries";

// The loader runs before anything is rendered, so a missing or invalid id becomes notFound() and a real 404.
export const Route = createFileRoute("/posts/$id")({
  loader: async ({ context, params }) => {
    const post = await context.queryClient.query(postQuery(params.id));
    if (!post) throw notFound();
  },
  component: PostPage,
  notFoundComponent: NotFound,
});

function PostPage() {
  const { id } = Route.useParams();
  const { data: post } = useSuspenseQuery(postQuery(id));
  return (
    <>
      <Link to="/" className="back">
        ← back to feed
      </Link>
      {post ? <PostCard post={post} link={false} /> : <NotFound />}
    </>
  );
}
