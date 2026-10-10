import { likePost } from "@/lib/api";

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/like">) {
  const { id } = await ctx.params;
  const authorization = req.headers.get("authorization");
  const { status, data } = await likePost(authorization, id);
  // No cache invalidation: the feed refreshes every 15 s and like counts are live in the browser.
  return Response.json(data, { status });
}
