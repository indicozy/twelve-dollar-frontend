import { query } from "@solidjs/router";
import * as api from "./api";
import { currentUsername } from "./session";

// Server functions wrapped in `query`: called in-process during SSR, deduplicated only within one request
// (the router keeps the server-side cache on the request event), so every page request calls the API.
export const getFeed = query(async () => {
  "use server";
  return api.getFeed();
}, "feed");

export const getPost = query(async (id: string) => {
  "use server";
  return api.getPost(id);
}, "post");

export const getUsername = query(async () => {
  "use server";
  return currentUsername();
}, "username");
