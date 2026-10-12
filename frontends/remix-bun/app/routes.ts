import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("posts/:id", "routes/post.tsx"),
  route("login", "routes/login.tsx"),
  // JSON passthrough resource routes for the load test's writes (action only, no component).
  route("api/posts", "routes/api.posts.ts"),
  route("api/posts/:id/like", "routes/api.posts.like.ts"),
] satisfies RouteConfig;
