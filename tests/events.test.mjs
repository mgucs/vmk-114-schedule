import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EVENTS, eventsOf, eventsOn} from '../lib/events.mjs';

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
