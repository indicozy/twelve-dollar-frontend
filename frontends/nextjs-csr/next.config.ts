import type { NextConfig } from "next";

// Client-side only: `next build` writes plain HTML/JS/CSS to out/, served by nginx (see nginx.conf).
// No Node server at runtime; the browser fetches JSON from the API through nginx's /api/ proxy.
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
};

export default nextConfig;
