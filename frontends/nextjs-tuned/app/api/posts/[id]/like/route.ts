import { likePost } from "@/lib/api";

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/like">) {
  const { id } = await ctx.params;
  const authorization = req.headers.get("authorization");
  const { status, data } = await likePost(authorization, id);
  return Response.json(data, { status });
}
