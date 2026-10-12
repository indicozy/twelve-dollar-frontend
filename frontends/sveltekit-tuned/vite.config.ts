import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Same setup as frontends/nextjs: server-rendered on every request, no caching, one Node process
// (adapter-node: `node build`).

// adapter-node 6 has no runtime ORIGIN variable: without one it assumes https, so over plain http every form
// action is rejected as cross-site (403). The sim serves plain http, so the origin is fixed at build time.
const origin = process.env.ORIGIN ?? 'http://localhost:3000';
const alias = origin.replace('//localhost:', '//127.0.0.1:');

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			paths: { origin },
			csrf: { trustedOrigins: [alias] }
		})
	]
});
