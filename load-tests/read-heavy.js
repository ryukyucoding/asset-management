import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, USER } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

export const options = {
  scenarios: {
    read_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  return login(BASE_URL, USER.email, USER.password);
}

export default function readHeavyScenario(data) {
  const headers = authHeaders(data.accessToken);

  const assets = http.get(`${BASE_URL}/assets?page=1&limit=20`, { headers, tags: { name: 'assets/list' } });
  check(assets, { 'assets 200': (r) => r.status === 200 });

  const stats = http.get(`${BASE_URL}/assets/stats`, { headers, tags: { name: 'assets/stats' } });
  check(stats, { 'stats 200': (r) => r.status === 200 });

  const notifications = http.get(`${BASE_URL}/notifications`, { headers, tags: { name: 'notifications/list' } });
  check(notifications, { 'notifications 200': (r) => r.status === 200 });

  const unread = http.get(`${BASE_URL}/notifications/unread-count`, { headers, tags: { name: 'notifications/unread' } });
  check(unread, { 'unread-count 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1);
}
