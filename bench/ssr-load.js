/**
 * SSR load test: the same user loop as the challenge's bench/load.js, but every read is a full
 * server-rendered HTML page from the frontend, and writes go through the frontend's /api routes.
 * One virtual user (VU) ≈ 0.1 req/s, so 1,000 VUs ≈ 100 page renders/s.
 *
 *   k6 run -e VUS=2000 bench/ssr-load.js
 *   k6 run -e BASE_URL=http://10.0.0.5 -e VUS=4000 bench/ssr-load.js
 *
 * Env: BASE_URL (default http://127.0.0.1:3000), VUS (default 100), DURATION (default 5m),
 *      RAMP_UP (default 60s), TOKENS (default ../research/ref-repo/seed/tokens.json).
 *
 * Pass: p95 < 500 ms, p99 < 1000 ms, under 1% failed requests (same thresholds as the video).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const VUS = Number(__ENV.VUS || 100);
const LIKE_PROB = 0.15;
const POST_PROB = 0.02;
const tokens = new SharedArray('tokens', () => JSON.parse(open(__ENV.TOKENS || '../research/ref-repo/seed/tokens.json')));

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
const POST_LINK = /href="\/posts\/(\d+)"/g;

export default function () {
  const user = tokens[(__VU - 1) % tokens.length];
  const auth = { headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' } };
  if (__ITER === 0) sleep(between(0, 5));

  const feed = http.get(`${BASE_URL}/`, { tags: { name: 'GET / (feed page)' } });
  const ids = feed.status === 200 ? [...String(feed.body).matchAll(POST_LINK)].map((m) => m[1]) : [];
  if (!check(feed, { 'feed page 200 with 20 posts': () => ids.length === 20 })) { sleep(between(3, 7)); return; }
  const id = ids[Math.floor(Math.random() * ids.length)];
  sleep(between(3, 7));

  const page = http.get(`${BASE_URL}/posts/${id}`, { tags: { name: 'GET /posts/:id (post page)' } });
  check(page, { 'post page 200': (r) => r.status === 200 && String(r.body).includes(`data-post-id="${id}"`) });
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
