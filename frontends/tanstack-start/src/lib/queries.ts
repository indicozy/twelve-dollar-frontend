import { queryOptions } from "@tanstack/react-query";
import { fetchFeed, fetchPost, fetchUsername } from "./server-fns";

// staleTime is left at Query's default, 0: a loader's `queryClient.query(...)` always fetches. On the server the
// QueryClient is created per request anyway (src/router.tsx), so nothing outlives a request there.
export const feedQuery = queryOptions({ queryKey: ["feed"], queryFn: () => fetchFeed() });

export const postQuery = (id: string) =>
  queryOptions({ queryKey: ["post", id], queryFn: () => fetchPost({ data: id }) });

export const usernameQuery = queryOptions({ queryKey: ["username"], queryFn: () => fetchUsername() });
