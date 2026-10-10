import { createFileRoute } from "@tanstack/react-router";
import { likePost } from "../../../../server/api.server";

export const Route = createFileRoute("/api/posts/$id/like")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { status, data } = await likePost(request.headers.get("authorization"), params.id);
        return Response.json(data, { status });
      },
    },
  },
});
