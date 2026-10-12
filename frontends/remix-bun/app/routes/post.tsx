import { data, Link } from "react-router";
import type { Route } from "./+types/post";
import { PostCard } from "~/components/post-card";
import { getPost } from "~/lib/api.server";
import { like } from "~/lib/like.server";

// Loaders finish before rendering starts, so a missing or invalid id is a real 404 status (the root
// ErrorBoundary renders the not-found markup).
export async function loader({ params }: Route.LoaderArgs) {
  const post = await getPost(params.id);
  if (!post) throw data("Not found", { status: 404 });
  return { post };
}

export async function action({ request }: Route.ActionArgs) {
  return like(request, await request.formData());
}

export default function PostPage({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Link to="/" className="back">
        ← back to feed
      </Link>
      <PostCard post={loaderData.post} link={false} />
    </>
  );
}
