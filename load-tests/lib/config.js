export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const USER = {
  email: __ENV.USER_EMAIL || 'user@example.com',
  password: __ENV.USER_PASSWORD || 'User1234',
};

export const ADMIN = {
  email: __ENV.ADMIN_EMAIL || 'admin@example.com',
  password: __ENV.ADMIN_PASSWORD || 'Admin1234',
};

export const defaultThresholds = {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<2000'],
};
