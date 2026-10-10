/**
 * Raw throughput: N connections hammering one URL with no think time (the video's "raw throughput" test).
 *
 *   k6 run -e URL=http://127.0.0.1:4000/feed bench/throughput.js     # Rust API
 *   k6 run -e URL=http://127.0.0.1:3000/ bench/throughput.js         # SSR feed page
 *
 * Env: URL, CONNS (default 64), DURATION (default 30s).
 */
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: Number(__ENV.CONNS || 64),
  duration: __ENV.DURATION || '30s',
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  check(http.get(__ENV.URL || 'http://127.0.0.1:4000/feed'), { '200': (r) => r.status === 200 });
}
