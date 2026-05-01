import test from 'node:test';
import assert from 'node:assert/strict';
import { corsOriginCallback, socketCorsOrigin } from '#config/cors.js';

function checkOrigin(origin) {
  return new Promise(resolve => {
    corsOriginCallback(origin, (_err, allowed) => resolve(Boolean(allowed)));
  });
}

test('corsOriginCallback allows default local origins', async () => {
  const allowed = await checkOrigin('http://localhost:8081');
  assert.equal(allowed, true);
});

test('corsOriginCallback rejects unknown origin', async () => {
  const allowed = await checkOrigin('https://unknown.example.com');
  assert.equal(allowed, false);
});

test('socketCorsOrigin allows missing origin for native clients', async () => {
  const originFn = socketCorsOrigin();
  assert.equal(typeof originFn, 'function');
  await new Promise(resolve => {
    originFn(undefined, (_err, allowed) => {
      assert.equal(allowed, true);
      resolve();
    });
  });
});
