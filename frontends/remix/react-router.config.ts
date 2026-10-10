import type { Config } from "@react-router/dev/config";

// Server-side rendered on every request (the template default). No `prerender`: nothing is built ahead of time.
export default {
  ssr: true,
} satisfies Config;
