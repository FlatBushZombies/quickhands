/**
 * Shared CORS for Express and Socket.IO.
 * React Native often sends no Origin; allow that. Env CLIENT_ORIGINS is comma-separated.
 */
const DEFAULT_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
];

export const HTTP_CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
export const HTTP_CORS_ALLOWED_HEADERS = ['Authorization', 'Content-Type'];
export const SOCKET_CORS_METHODS = ['GET', 'POST', 'OPTIONS'];

function parseAllowedOrigins() {
  const raw = process.env.CLIENT_ORIGINS;
  if (!raw || raw.trim() === '') return DEFAULT_ORIGINS;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAllowedOriginsList() {
  return parseAllowedOrigins();
}

/**
 * Express cors `origin` option: boolean | string | RegExp | (origin, cb) => void
 */
export function corsOriginCallback(origin, callback) {
  const allowed = parseAllowedOrigins();
  if (allowed.includes('*')) {
    callback(null, true);
    return;
  }
  if (!origin) {
    callback(null, true);
    return;
  }
  if (allowed.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
}

/**
 * Socket.IO v4 `cors.origin` accepts string | string[] | boolean | (origin, cb)
 */
export function socketCorsOrigin() {
  const allowed = parseAllowedOrigins();
  if (allowed.includes('*')) return true;
  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowed.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}
