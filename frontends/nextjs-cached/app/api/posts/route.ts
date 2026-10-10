// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import { revalidateTag } from "next/cache";
import { createPost, tags } from "@/lib/api";

export async function POST(req: Request) {
  const authorization = req.headers.get("authorization");
  let body = "";
  try {
    body = String((await req.json()).body ?? "");
  } catch {
    return Response.json({ error: "malformed JSON body" }, { status: 400 });
  }
  const { status, data } = await createPost(authorization, body);
  // Route handlers can't use updateTag; "max" = stale-while-revalidate: the next visitor gets the cached page
  // while one background render refreshes it.
  if (status === 201) revalidateTag(tags.feed, "max");
  return Response.json(data, { status });
}
