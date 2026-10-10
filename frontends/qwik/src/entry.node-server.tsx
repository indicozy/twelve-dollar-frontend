/**
 * Production server: Qwik City's official "node-server" adapter (plain `node:http`, no Express, no compression),
 * one process. Same as the adapter starter, plus HOST and no `cacheControl` override for static files.
 */
import { createQwikCity } from '@builder.io/qwik-city/middleware/node';
import qwikCityPlan from '@qwik-city-plan';
import { createServer } from 'node:http';
import render from './entry.ssr';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3000);

// Origin used for the CSRF check on form posts: the `ORIGIN` env var if set, otherwise derived per request from the
// Host header (+ http/https), so plain-http form posts work on both localhost:3000 and 127.0.0.1:3000.
const { router, notFound, staticFile } = createQwikCity({ render, qwikCityPlan });

createServer((req, res) => {
	staticFile(req, res, () => {
		router(req, res, () => {
			notFound(req, res, () => {});
		});
	});
}).listen(PORT, HOST, () => {
	console.log(`Qwik City node-server listening on http://${HOST}:${PORT}`);
});
