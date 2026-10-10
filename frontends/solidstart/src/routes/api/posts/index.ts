// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import type { APIEvent } from "@solidjs/start/server";
import { createPost } from "~/lib/api";

export async function POST({ request }: APIEvent) {
  const authorization = request.headers.get("authorization");
  let body = "";
  try {
    body = String((await request.json()).body ?? "");
  } catch {
    return Response.json({ error: "malformed JSON body" }, { status: 400 });
  }
  const { status, data } = await createPost(authorization, body);
  return Response.json(data, { status });
}
