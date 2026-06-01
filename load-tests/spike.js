/**
 * Scenario E - Spike: sudden traffic surge then drop.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, USER } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

const spikeVus = Number(__ENV.K6_SPIKE_VUS || 60);

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: spikeVus },
        { duration: '1m', target: spikeVus },
        { duration: '10s', target: 0 },
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

  const res = http.get(`${BASE_URL}/assets?page=1&limit=20`, { headers, tags: { name: 'assets/list' } });
  check(res, { 'assets ok': (r) => r.status === 200 });

  sleep(0.3);
}
