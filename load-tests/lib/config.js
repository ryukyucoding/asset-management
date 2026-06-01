export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function requiredEnv(key) {
  const value = __ENV[key];
  if (!value) {
    throw new Error(
      `Missing k6 env ${key}. Pass via -e ${key}=... or source load-tests/lib/k6-env.sh before run-all.sh.`,
    );
  }
  return value;
}

export const USER = {
  email: __ENV.USER_EMAIL || 'user@example.com',
  password: requiredEnv('USER_PASSWORD'),
};

export const ADMIN = {
  email: __ENV.ADMIN_EMAIL || 'admin@example.com',
  password: requiredEnv('ADMIN_PASSWORD'),
};

export const defaultThresholds = {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<2000'],
};
