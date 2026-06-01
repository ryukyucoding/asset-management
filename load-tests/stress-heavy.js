/**
 * Scenario G - Heavy sustained load for Cloud Run scale-out validation.
 * Uses parallel http.batch + minimal sleep to raise in-flight concurrent requests.
 *
 * Env:
 *   K6_HEAVY_PEAK   default 800
 *   K6_HEAVY_HOLD   plateau duration at peak, default 10m
 *   K6_HEAVY_SLEEP  pause between iterations (seconds), default 0.05
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, USER } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

const peak = Number(__ENV.K6_HEAVY_PEAK || 800);
const holdDuration = __ENV.K6_HEAVY_HOLD || '10m';
const pauseSec = Number(__ENV.K6_HEAVY_SLEEP || 0.05);

export const options = {
  scenarios: {
    heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: Math.floor(peak * 0.25) },
        { duration: '2m', target: Math.floor(peak * 0.5) },
        { duration: '2m', target: peak },
        { duration: holdDuration, target: peak },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.15'],
    http_req_duration: ['p(95)<8000'],
  },
};

export function setup() {
  return login(BASE_URL, USER.email, USER.password);
}

export default function (data) {
  const headers = authHeaders(data.accessToken);

  const responses = http.batch([
    ['GET', `${BASE_URL}/assets?page=1&limit=20`, null, { headers, tags: { name: 'assets/list' } }],
    ['GET', `${BASE_URL}/assets/stats`, null, { headers, tags: { name: 'assets/stats' } }],
    ['GET', `${BASE_URL}/notifications`, null, { headers, tags: { name: 'notifications/list' } }],
  ]);

  check(responses[0], { 'assets ok': (r) => r.status === 200 });
  check(responses[1], { 'stats ok': (r) => r.status === 200 });
  check(responses[2], { 'notifications ok': (r) => r.status === 200 });

  sleep(pauseSec);
}
