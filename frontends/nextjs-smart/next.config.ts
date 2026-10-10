import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
  poweredByHeader: false,

  cacheLife: {
    // The feed page: regenerated in the background every 15 s; writes never force it. stale >= 30 s and
    // expire >= 5 min are what Next needs to store it as a whole page rather than render it per request.
    feed: { stale: 30, revalidate: 15, expire: 3600 },
    // Post pages: kept until the post is edited (revalidatePostAfterEdit in app/actions.ts).
    post: { stale: 300, revalidate: 2592000, expire: 31536000 },
  },

  // "/" has no URL param, and Next only stores pages for params it renders at runtime (ISR). Serving the feed from
  // /feed/latest lets it be stored on its first request without fetching anything at build time.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/feed/latest" }] };
  },

  generateEtags: true,
  compress: false,
};

export default nextConfig;
