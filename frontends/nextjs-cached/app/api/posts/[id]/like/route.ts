import { revalidateTag } from "next/cache";
import { likePost, tags } from "@/lib/api";

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/like">) {
  const { id } = await ctx.params;
  const authorization = req.headers.get("authorization");
  const { status, data } = await likePost(authorization, id);
  // Only a new like changes a count. The post tag also sits on the feed entry when the post is in the feed.
  if (status === 201) revalidateTag(tags.post(id), "max");
  return Response.json(data, { status });
}
