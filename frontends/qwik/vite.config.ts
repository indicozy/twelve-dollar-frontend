import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import { defineConfig } from 'vite';

// Same setup as frontends/nextjs and frontends/sveltekit: server-rendered on every request, no caching, one Node
// process (node-server adapter, see adapters/node-server/vite.config.ts and src/entry.node-server.tsx).
// The starter's dev/preview Cache-Control headers are intentionally left out.
export default defineConfig(() => ({
	// trailingSlash: false → `/posts/1` is served as is (the default true 301-redirects to `/posts/1/`).
	plugins: [qwikCity({ trailingSlash: false }), qwikVite()]
}));
