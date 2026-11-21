import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EVENTS, eventsOf, eventsOn} from '../lib/events.mjs';
import {announcedCredits, announcedTime} from '../lib/announced-credits.mjs';

test('announced events: a real date, a known kind, a group and a title each', () => {
  for (const e of EVENTS) {
    assert.match(e.date, /^20\d\d-\d\d-\d\d$/, e.title);
    assert.equal(new Date(e.date + 'T12:00:00Z').toISOString().slice(0, 10), e.date, e.title);
    assert.ok(['test', 'colloquium'].includes(e.kind), e.title);
    assert.match(e.group, /^\d{3}$/, e.title);
    assert.ok(e.title && e.subject, e.date);
  }
});
test('events belong to their group only, in date order', () => {
  for (const group of new Set(EVENTS.map(e => e.group))) {
    const list = eventsOf(group);
    assert.ok(list.every(e => e.group === group));
    assert.deepEqual(list.map(e => e.date), list.map(e => e.date).sort());
    for (const e of list) assert.ok(eventsOn(group, e.date).includes(e));
  }
  assert.equal(eventsOf('000').length, 0);
});

test('group 114 December announcement is scoped to this year and yields to the official credits', () => {
  const entries = announcedCredits('114',2026);
  assert.equal(entries.length,9);
  assert.deepEqual(entries.filter(e=>e.date==='2026-12-26').map(announcedTime),['10:00–12:00','14:00']);
  assert.deepEqual(announcedCredits('114',2026,[{date:'2026-12-21'}]),entries.filter(e=>e.retake));
  assert.deepEqual(announcedCredits('113',2026),[]);
  assert.deepEqual(announcedCredits('114',2025),[]);
});
