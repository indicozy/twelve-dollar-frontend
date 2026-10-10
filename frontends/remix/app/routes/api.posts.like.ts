import type { Route } from "./+types/api.posts.like";
import { likePost } from "~/lib/api.server";

export async function action({ request, params }: Route.ActionArgs) {
  const { status, data } = await likePost(request.headers.get("authorization"), params.id);
  return Response.json(data, { status });
}
