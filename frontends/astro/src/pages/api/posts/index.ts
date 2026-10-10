// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import type { APIRoute } from "astro";
import { createPost } from "../../../lib/server/api";

export const POST: APIRoute = async ({ request }) => {
  const authorization = request.headers.get("authorization");
  let body = "";
  try {
    body = String((await request.json()).body ?? "");
  } catch {
    return Response.json({ error: "malformed JSON body" }, { status: 400 });
  }
  const { status, data } = await createPost(authorization, body);
  return Response.json(data, { status });
};
