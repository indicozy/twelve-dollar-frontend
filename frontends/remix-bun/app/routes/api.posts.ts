// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import type { Route } from "./+types/api.posts";
import { createPost } from "~/lib/api.server";

export async function action({ request }: Route.ActionArgs) {
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
