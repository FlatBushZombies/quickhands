import test from 'node:test';
import assert from 'node:assert/strict';
import { validate as isUuid } from 'uuid';
import {
  conversationIdForClerkPair,
  conversationIdForJobClerkPair,
} from '#utils/conversationId.js';

test('conversationIdForClerkPair is deterministic and order-independent', () => {
  const idA = conversationIdForClerkPair('user_alpha', 'user_beta');
  const idB = conversationIdForClerkPair('user_beta', 'user_alpha');

  assert.equal(idA, idB);
  assert.equal(isUuid(idA), true);
});

test('conversationIdForJobClerkPair changes per job id', () => {
  const samePairJob1 = conversationIdForJobClerkPair(101, 'user_alpha', 'user_beta');
  const samePairJob2 = conversationIdForJobClerkPair(102, 'user_alpha', 'user_beta');

  assert.notEqual(samePairJob1, samePairJob2);
  assert.equal(isUuid(samePairJob1), true);
  assert.equal(isUuid(samePairJob2), true);
});
