import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Framework defaults from create-next-app are kept on purpose (same spirit as the video).
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained server bundle: `node .next/standalone/server.js`.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
