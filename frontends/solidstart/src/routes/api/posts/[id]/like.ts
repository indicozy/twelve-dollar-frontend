import type { APIEvent } from "@solidjs/start/server";
import { likePost } from "~/lib/api";

export async function POST({ request, params }: APIEvent) {
  const { status, data } = await likePost(request.headers.get("authorization"), params.id);
  return Response.json(data, { status });
}
