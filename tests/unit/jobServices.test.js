import test from 'node:test';
import assert from 'node:assert/strict';
import { filterJobsByServices } from '#utils/jobServices.js';

const jobs = [
  { id: 1, serviceType: 'Plumbing', selectedServices: ['Plumbing'] },
  { id: 2, serviceType: 'Deep clean', selectedServices: ['Deep clean'] },
  { id: 3, serviceType: 'Furniture', selectedServices: ['Painting', 'Handyman'] },
  { id: 4, serviceType: 'Errand', selectedServices: null },
];

test('filterJobsByServices keeps jobs whose service type or selected services match', () => {
  const ids = filterJobsByServices(jobs, ['Plumbing', 'Painting']).map((j) => j.id);
  assert.deepEqual(ids, [1, 3]);
});

test('filterJobsByServices matches case-insensitively and ignores blanks', () => {
  const ids = filterJobsByServices(jobs, ['  deep CLEAN ', '']).map((j) => j.id);
  assert.deepEqual(ids, [2]);
});

test('filterJobsByServices returns every job when no services are given', () => {
  assert.equal(filterJobsByServices(jobs, []), jobs);
  assert.equal(filterJobsByServices(jobs, undefined), jobs);
});
