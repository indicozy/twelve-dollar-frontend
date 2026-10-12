import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tuned for a page that is 100% request-time data (see README.md and research/anomalies-nextjs.md):
  // `cacheComponents` (and with it Partial Prerendering, Cached Navigations and Partial Prefetching) is left off.
  // Nothing on these pages can be prerendered except the header and skeletons, and with it on every request paid
  // for a staged RSC render plus a second "runtime prefetch" RSC render embedded in the HTML.
  // Self-contained server bundle: `node .next/standalone/server.js`.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
