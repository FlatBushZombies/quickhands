import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateText, moderateJobPost } from '#utils/contentModeration.js';

test('moderateText allows ordinary job-posting language', () => {
  assert.equal(moderateText('Need a plumber to fix a leaking kitchen sink this weekend').ok, true);
  assert.equal(moderateText('Looking for an electrician, class 2, for a rewiring job').ok, true);
  assert.equal(moderateText('Experienced classroom assistant needed for grass-cutting too').ok, true);
  assert.equal(moderateText('').ok, true);
  assert.equal(moderateText(null).ok, true);
});

test('moderateText blocks sexual content', () => {
  const result = moderateText('Looking for someone for an escort service');
  assert.equal(result.ok, false);
  assert.equal(result.category, 'sexual');
});

test('moderateText blocks political campaigning content', () => {
  const result = moderateText('Help us vote for Smith in the election campaign');
  assert.equal(result.ok, false);
  assert.equal(result.category, 'political');
});

test('moderateText blocks named Zimbabwean political parties', () => {
  assert.equal(moderateText('Join our ZANU-PF rally this weekend').ok, false);
  assert.equal(moderateText('MDC supporters welcome').ok, false);
});

test('moderateJobPost checks every free-text field and reports the first violation', () => {
  const clean = moderateJobPost({ serviceType: 'Plumbing', specialistChoice: null, additionalInfo: 'Fix a leak' });
  assert.equal(clean.ok, true);

  const dirty = moderateJobPost({ serviceType: 'Plumbing', specialistChoice: null, additionalInfo: 'nude modeling job' });
  assert.equal(dirty.ok, false);
  assert.equal(dirty.category, 'sexual');
});
