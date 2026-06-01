/**
 * Scenario A - Baseline / Smoke
 * Health + login once + core read endpoints at low concurrency.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, USER } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

export const options = {
  scenarios: {
    smoke: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 5 },
        { duration: '45s', target: 10 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

export function setup() {
  return login(BASE_URL, USER.email, USER.password);
}

export default function smokeScenario(data) {
  const headers = authHeaders(data.accessToken);

  const health = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
  check(health, { 'health 200': (r) => r.status === 200 });

  const assets = http.get(`${BASE_URL}/assets?page=1&limit=20`, { headers, tags: { name: 'assets/list' } });
  check(assets, { 'assets 200': (r) => r.status === 200 });

  const stats = http.get(`${BASE_URL}/assets/stats`, { headers, tags: { name: 'assets/stats' } });
  check(stats, { 'stats 200': (r) => r.status === 200 });

  sleep(1);
}
