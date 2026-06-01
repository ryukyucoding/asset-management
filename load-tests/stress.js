/**
 * Scenario D - Stress test: ramp VUs to find latency knee.
 * Local run uses moderate peak (80 VU); override with K6_STRESS_PEAK env.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, USER } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

const peak = Number(__ENV.K6_STRESS_PEAK || 80);

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.floor(peak * 0.25) },
        { duration: '1m', target: Math.floor(peak * 0.5) },
        { duration: '1m', target: peak },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<5000'],
  },
};

export function setup() {
  return login(BASE_URL, USER.email, USER.password);
}

export default function stressScenario(data) {
  const headers = authHeaders(data.accessToken);

  const assets = http.get(`${BASE_URL}/assets?page=1&limit=20`, { headers, tags: { name: 'assets/list' } });
  check(assets, { 'assets ok': (r) => r.status === 200 });

  const stats = http.get(`${BASE_URL}/assets/stats`, { headers, tags: { name: 'assets/stats' } });
  check(stats, { 'stats ok': (r) => r.status === 200 });

  sleep(0.5);
}
