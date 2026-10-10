import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
  poweredByHeader: false,

  // One profile for API-backed content. Long enough (stale >= 30 s, expire >= 5 min) that cached data is
  // baked into the prerendered page instead of left as a per-request hole. Freshness comes from tag
  // invalidation on every write (updateTag / revalidateTag); `revalidate` is only a safety net.
  cacheLife: {
    content: { stale: 30, revalidate: 300, expire: 86400 },
  },

  // Prerendered pages get an ETag; a matching If-None-Match gets an empty 304 (this is the default,
  // set explicitly because the variant relies on it).
  generateEtags: true,

  // gzip in Node costs CPU on every response; in production a proxy/CDN compresses (and caches) instead.
  compress: false,
};

export default nextConfig;
