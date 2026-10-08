import assert from 'node:assert/strict';
import {test} from 'node:test';
import {guardGroups, suspicion} from '../lib/guard.mjs';

const lesson = (day, start, title = 'Алгебра') => ({id:`${day}-${start}`, day, start, end:'10:20', title, detail:'', room:'', type:'class', raw:title, rule:null});
const week = days => days.flatMap(d => [lesson(d, '08:45'), lesson(d, '10:30')]);
const page = (overrides = {}) => Object.fromEntries(['101','102','103','104'].map(g => [g, {page:1, lessons:overrides[g] ?? week([0,1,2,3,4])}]));

test('a weekday the rest of the stream has, empty for one group, is a misread column', () => {
  const groups = page({'103':week([1,2,3,4])});
  assert.match(suspicion('103', groups, null), /понедельник/);
  assert.equal(suspicion('102', groups, null), '');
});

test('a group that looks misread keeps its previous timetable, with a warning', () => {
  const before = {groups:page()};
  const {groups, notes} = guardGroups(page({'103':week([1,2,3,4])}), before);
  assert.equal(groups['103'], before.groups['103']);
  assert.equal(notes.length, 1);
  assert.match(notes[0].text, /оставлено прежнее/);
});

test('real changes pass: a day free for the whole stream, a class or two less', () => {
  const free = page(Object.fromEntries(['101','102','103','104'].map(g => [g, week([0,1,2,3])])));
  assert.deepEqual(guardGroups(free, {groups:page()}).notes, []);
  const fewer = page({'103':week([0,1,2,3,4]).slice(1)});
  assert.deepEqual(guardGroups(fewer, {groups:page()}).notes, []);
});

test('half the classes gone, or a whole group gone, keeps the previous version', () => {
  const before = {groups:page()};
  const halved = page({'103':[0,1,2,3,4].map(d => lesson(d, '08:45'))});
  assert.match(suspicion('103', halved, before), /вместо прежних/);
  const {['104']:gone, ...rest} = page();
  const kept = guardGroups(rest, before);
  assert.equal(kept.groups['104'], before.groups['104']);
  assert.match(kept.notes[0].text, /не найдена/);
});

test('most groups misread is a failed read, not a set of rescued groups', () => {
  const broken = page(Object.fromEntries(['101','102','103'].map(g => [g, [0,1,2,3,4].map(d => lesson(d, '08:45'))])));
  assert.throws(() => guardGroups(broken, {groups:page()}), /большинства групп/);
});
