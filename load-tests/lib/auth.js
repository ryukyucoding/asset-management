import http from 'k6/http';
import { check } from 'k6';

export function login(baseUrl, email, password) {
  const res = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth/login' } },
  );

  check(res, {
    'login status 200': (r) => r.status === 200,
    'login has accessToken': (r) => Boolean(r.json('accessToken')),
  });

  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${res.body}`);
  }

  return {
    accessToken: res.json('accessToken'),
    refreshToken: res.json('refreshToken'),
  };
}

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
