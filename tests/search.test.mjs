import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {person,searchIndex,searchLessons} from '../lib/search.mjs';
import {calendarFile} from '../lib/calendar.mjs';
import {groupSchedule} from '../lib/schedule-model.mjs';

const snapshot=JSON.parse(await readFile(new URL('./fixtures/source.json',import.meta.url),'utf8'));
const index=searchIndex(snapshot.schedule);

test('one person written several ways becomes one name',()=>{
  assert.equal(person('доцент Ким Галина Динховна'),'Ким Г.Д.');
  assert.equal(person('академик РАН Тыртышников Евгений Евгеньевич'),'Тыртышников Е.Е.');
  assert.equal(person('Перцева З.Н..'),'Перцева З.Н.');
  assert.equal(person('Цыбров Е.Г. МЗ-2'),'Цыбров Е.Г.');
});

test('search finds a teacher, a room and a group across the whole course',()=>{
  const kim=searchLessons(index,'ким',0);
  assert.ok(kim.length>0);
  assert.ok(kim.every(row=>row.teacher==='Ким Г.Д.' && row.day===0));
  // A lecture is one row for every group of the stream.
  assert.ok(kim.some(row=>row.groups.length>1 && row.groups.includes('114')));
  assert.ok(searchLessons(index,'606',null).every(row=>row.room.split(', ').includes('606')));
  assert.ok(searchLessons(index,'118',1).every(row=>row.groups.includes('118') && row.day===1));
  assert.ok(searchLessons(index,'п 5',null).length>0);
  assert.deepEqual(searchLessons(index,'  ',0),[]);
});

test('calendar file repeats weekly classes and keeps one-off dates',()=>{
  const schedule=groupSchedule(snapshot.schedule,'114');
  const ics=calendarFile(schedule,{},new Date('2026-09-26T10:00:00Z'));
  assert.match(ics,/^BEGIN:VCALENDAR\r\n/);
  assert.match(ics,/END:VCALENDAR\r\n$/);
  assert.ok(!/Межфакультетские/.test(ics));
  assert.ok(ics.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
  const events=ics.split('BEGIN:VEVENT').length-1;
  assert.ok(events>=schedule.lessons.length-1);
  assert.match(ics,/RRULE:FREQ=WEEKLY;UNTIL=20261231T205959Z/);
  // Monday 10:30 lecture starts on the first Monday of the term.
  assert.match(ics,/DTSTART;TZID=Europe\/Moscow:20260907T103000/);
});
