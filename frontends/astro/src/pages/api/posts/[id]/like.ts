import type { APIRoute } from "astro";
import { likePost } from "../../../../lib/server/api";

export const POST: APIRoute = async ({ request, params }) => {
  const { status, data } = await likePost(request.headers.get("authorization"), params.id ?? "");
  return Response.json(data, { status });
};
