/**
 * Scenario C - Admin application review (read-heavy)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, ADMIN } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

export const options = {
  scenarios: {
    admin_read: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 5 },
        { duration: '1m', target: 15 },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  return login(BASE_URL, ADMIN.email, ADMIN.password);
}

export default function (data) {
  const headers = authHeaders(data.accessToken);

  const all = http.get(`${BASE_URL}/applications?page=1&limit=20`, { headers, tags: { name: 'applications/list' } });
  check(all, { 'applications 200': (r) => r.status === 200 });

  const pending = http.get(`${BASE_URL}/applications?status=PENDING&page=1&limit=20`, {
    headers,
    tags: { name: 'applications/pending' },
  });
  check(pending, { 'pending applications 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1);
}
