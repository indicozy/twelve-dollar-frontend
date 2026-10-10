// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import { createFileRoute } from "@tanstack/react-router";
import { createPost } from "../../server/api.server";

export const Route = createFileRoute("/api/posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        let body = "";
        try {
          body = String((await request.json()).body ?? "");
        } catch {
          return Response.json({ error: "malformed JSON body" }, { status: 400 });
        }
        const { status, data } = await createPost(authorization, body);
        return Response.json(data, { status });
      },
    },
  },
});
