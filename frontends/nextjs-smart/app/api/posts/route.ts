// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import { createPost } from "@/lib/api";

export async function POST(req: Request) {
  const authorization = req.headers.get("authorization");
  let body = "";
  try {
    body = String((await req.json()).body ?? "");
  } catch {
    return Response.json({ error: "malformed JSON body" }, { status: 400 });
  }
  const { status, data } = await createPost(authorization, body);
  // No cache invalidation: the feed refreshes every 15 s and like counts are live in the browser.
  return Response.json(data, { status });
}
