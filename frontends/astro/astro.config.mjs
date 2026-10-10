// @ts-check
import node from "@astrojs/node";
import { defineConfig } from "astro/config";

// Hosts whose Host header is trusted (any port), comma-separated, read at build time.
const allowedHosts = (process.env.ALLOWED_HOSTS ?? "localhost,127.0.0.1").split(",").map((h) => h.trim()).filter(Boolean);

// Same setup as frontends/nextjs and frontends/sveltekit: every page rendered on demand on every request
// (no prerendering, no caching), one Node process (@astrojs/node standalone: `node dist/server/entry.mjs`).
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  security: {
    // Default, spelled out: a form POST (urlencoded/multipart/text/plain) whose Sec-Fetch-Site is cross-site, or
    // whose Origin differs from the request URL's origin, gets 403. JSON requests (the load test) are not checked.
    checkOrigin: true,
    // The Node adapter only trusts the Host header when it matches allowedDomains; otherwise the request URL (and
    // so the origin form posts are checked against) is http://localhost:$PORT, and every form post sent to
    // 127.0.0.1:3000 is rejected. Fixed at build time (it goes into the server manifest), like SvelteKit's ORIGIN.
    allowedDomains: allowedHosts.map((hostname) => ({ protocol: "http", hostname })),
  },
  // No prefetch/view-transition scripts, no dev toolbar in the build: the pages ship zero client JS.
  devToolbar: { enabled: false },
});
