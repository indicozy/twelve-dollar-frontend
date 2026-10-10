/**
 * Client-side-rendering load test: the same user loop and thresholds as ssr-load.js, but each page view is
 * what a browser does for a client-rendered app, since k6 doesn't execute JavaScript:
 *   - the HTML document (static, from nginx); revisits send If-None-Match like a browser revalidating -> 304
 *   - the JSON request the page's JavaScript makes (/api/feed or /api/posts/:id, proxied to the API box)
 *   - the page's JS/CSS once per virtual user (cold browser cache); afterwards they're cached as immutable
 * Writes go to /api/posts and /api/posts/:id/like, as the app's buttons do.
 *
 *   k6 run -e VUS=2000 bench/csr-load.js
 *
 * Env: BASE_URL (default http://127.0.0.1:3000), VUS (default 100), DURATION (default 5m),
 *      RAMP_UP (default 60s), TOKENS (default ../research/ref-repo/seed/tokens.json).
 *
 * Pass: p95 < 500 ms, p99 < 1000 ms, under 1% failed requests (over all requests, as in the video).
 * The `page_view` trend (document + data, back to back) is reported for comparison with the SSR test.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const VUS = Number(__ENV.VUS || 100);
const LIKE_PROB = 0.15;
const POST_PROB = 0.02;
const tokens = new SharedArray('tokens', () => JSON.parse(open(__ENV.TOKENS || '../research/ref-repo/seed/tokens.json')));
const pageView = new Trend('page_view', true);

export const options = {
  scenarios: {
    users: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.RAMP_UP || '60s', target: VUS },
        { duration: __ENV.DURATION || '5m', target: VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

const between = (lo, hi) => lo + Math.random() * (hi - lo);
const ASSET = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

// Per-VU browser state (each VU is its own JS runtime): ETags by URL, and whether assets are cached yet.
const etags = {};
let assetsCached = false;

/** A 304 is a success for a document request. */
const okDoc = { responseCallback: http.expectedStatuses(200, 304) };

function documentGet(path, name) {
  const headers = etags[path] ? { 'If-None-Match': etags[path] } : {};
  const r = http.get(`${BASE_URL}${path}`, { headers, tags: { name }, ...okDoc });
  if (r.status === 200 && r.headers.Etag) etags[path] = r.headers.Etag;
  if (r.status === 200 && !assetsCached) {
    const assets = [...new Set([...String(r.body).matchAll(ASSET)].map((m) => m[1]))];
    http.batch(assets.map((a) => ['GET', `${BASE_URL}${a}`, null, { tags: { name: 'GET /_next/static (first visit)' } }]));
    assetsCached = true;
  }
  check(r, { 'document 200/304': (res) => res.status === 200 || res.status === 304 });
  return r;
}

export default function () {
  const user = tokens[(__VU - 1) % tokens.length];
  const auth = { headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' } };
  if (__ITER === 0) sleep(between(0, 5));

  let t = Date.now();
  documentGet('/', 'GET / (document)');
  const feed = http.get(`${BASE_URL}/api/feed`, { tags: { name: 'GET /api/feed (data)' } });
  pageView.add(Date.now() - t, { page: 'feed' });
  const posts = feed.status === 200 ? feed.json('posts') : [];
  if (!check(feed, { 'feed data has 20 posts': () => posts.length === 20 })) { sleep(between(3, 7)); return; }
  const id = posts[Math.floor(Math.random() * posts.length)].id;
  sleep(between(3, 7));

  t = Date.now();
  documentGet(`/posts/${id}`, 'GET /posts/:id (document)');
  const post = http.get(`${BASE_URL}/api/posts/${id}`, { tags: { name: 'GET /api/posts/:id (data)' } });
  pageView.add(Date.now() - t, { page: 'post' });
  check(post, { 'post data 200': (r) => r.status === 200 && r.json('post.id') === id });
  sleep(between(3, 8));

  if (Math.random() < LIKE_PROB) {
    const r = http.post(`${BASE_URL}/api/posts/${id}/like`, null, { ...auth, tags: { name: 'POST /api/posts/:id/like' } });
    check(r, { 'like 200/201': (r) => r.status === 200 || r.status === 201 });
  }
  if (Math.random() < POST_PROB) {
    const body = JSON.stringify({ body: `${user.username} says hi at ${new Date().toISOString()} (VU ${__VU}, iter ${__ITER})` });
    check(http.post(`${BASE_URL}/api/posts`, body, { ...auth, tags: { name: 'POST /api/posts' } }), { 'create 201': (r) => r.status === 201 });
  }
  sleep(between(5, 15));
}
