/**
 * Scenario F - Soak (shortened for local: 5 min @ 25 VU).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, USER } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: Number(__ENV.K6_SOAK_VUS || 25),
      duration: __ENV.K6_SOAK_DURATION || '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  return login(BASE_URL, USER.email, USER.password);
}

export default function (data) {
  const headers = authHeaders(data.accessToken);

  http.get(`${BASE_URL}/assets?page=1&limit=20`, { headers, tags: { name: 'assets/list' } });
  http.get(`${BASE_URL}/assets/stats`, { headers, tags: { name: 'assets/stats' } });
  http.get(`${BASE_URL}/notifications`, { headers, tags: { name: 'notifications/list' } });

  check(true, { 'iteration complete': () => true });
  sleep(Math.random() * 2 + 1);
}
