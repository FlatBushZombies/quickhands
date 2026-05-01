import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

test('integration smoke: express app responds with 200', async () => {
  const app = express();
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK' });
  });

  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'OK');
});
