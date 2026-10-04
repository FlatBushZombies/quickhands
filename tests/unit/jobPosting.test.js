import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJobBudget,
  parseJobDocuments,
  parsePreferredTime,
  MAX_JOB_DOCUMENTS,
} from '#utils/jobPosting.js';

const PHOTO = 'https://res.cloudinary.com/annvck7c/image/upload/v1/task.jpg';

test('a missing budget is stored as null, not 0', () => {
  assert.deepEqual(parseJobBudget(undefined), { ok: true, value: null });
  assert.deepEqual(parseJobBudget(null), { ok: true, value: null });
  assert.deepEqual(parseJobBudget(''), { ok: true, value: null });
});

test('a budget must be a non-negative number', () => {
  assert.deepEqual(parseJobBudget('25.5'), { ok: true, value: 25.5 });
  assert.equal(parseJobBudget(-1).ok, false);
  assert.equal(parseJobBudget('abc').ok, false);
});

test('preferredTime accepts only the design values or nothing', () => {
  for (const value of ['morning', 'afternoon', 'evening', 'any']) {
    assert.deepEqual(parsePreferredTime(value), { ok: true, value });
  }
  assert.deepEqual(parsePreferredTime(undefined), { ok: true, value: null });
  assert.equal(parsePreferredTime('noon').ok, false);
  assert.equal(parsePreferredTime(5).ok, false);
});

test('documents accept Cloudinary https URLs and a JSON string of them', () => {
  assert.deepEqual(parseJobDocuments([PHOTO]), { ok: true, value: [PHOTO] });
  assert.deepEqual(parseJobDocuments(JSON.stringify([PHOTO])), { ok: true, value: [PHOTO] });
  assert.deepEqual(parseJobDocuments(undefined), { ok: true, value: [] });
});

test('documents are capped at the design limit of five photos', () => {
  const six = Array.from({ length: MAX_JOB_DOCUMENTS + 1 }, () => PHOTO);
  assert.equal(parseJobDocuments(six).ok, false);
});

test('documents reject non-Cloudinary and non-https URLs', () => {
  assert.equal(parseJobDocuments(['https://example.com/a.jpg']).ok, false);
  assert.equal(parseJobDocuments(['http://res.cloudinary.com/a.jpg']).ok, false);
  assert.equal(parseJobDocuments(['not a url']).ok, false);
});
