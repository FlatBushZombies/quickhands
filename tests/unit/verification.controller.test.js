import test from 'node:test';
import assert from 'node:assert/strict';
import { submitMyVerification } from '#controllers/verification.controller.js';

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

test('submitMyVerification rejects an unknown document type before touching the database', async () => {
  const res = mockRes();
  await submitMyVerification({ user: { clerkId: 'user_x' }, body: { documentType: 'licence', consent: true } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('submitMyVerification requires explicit consent', async () => {
  const res = mockRes();
  await submitMyVerification({ user: { clerkId: 'user_x' }, body: { documentType: 'id' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Consent/);
});

test('submitMyVerification requires an authenticated user', async () => {
  const res = mockRes();
  await submitMyVerification({ body: { documentType: 'id', consent: true } }, res);
  assert.equal(res.statusCode, 401);
});
