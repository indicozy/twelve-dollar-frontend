import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// Same setup as frontends/nextjs: server-rendered on every request, no caching, one Node process
// (Nitro's node_server preset: `node .output/server/index.mjs`). Start's default SSR mode (streaming) is kept,
// nothing is prerendered.
export default defineConfig({
  plugins: [tanstackStart(), nitro({ preset: "node_server" }), viteReact()],
});
