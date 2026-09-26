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
  assert.match(ics,/RRULE:FREQ=WEEKLY;INTERVAL=1;UNTIL=20261231T205959Z/);
  // Monday 10:30 lecture starts on the first Monday of the term.
  assert.match(ics,/DTSTART;TZID=Europe\/Moscow:20260907T103000/);
});

test('calendar file follows the weeks of classes, skips holidays, alternates ФИИТ entries', async () => {
  const {parseParity} = await import('../lib/term.mjs');
  const term = parseParity(['01 сентября 2026 г. - 06 сентября 2026 г. нечетная неделя', '07 сентября 2026 г. - 13 сентября 2026 г. четная неделя',
    '02 ноября 2026 г. - 08 ноября 2026 г. четная неделя', '14 декабря 2026 г. - 20 декабря 2026 г. четная неделя']);
  const pmi = calendarFile({...groupSchedule(snapshot.schedule,'114'), term}, {}, new Date('2026-09-26T10:00:00Z'));
  assert.match(pmi, /UNTIL=20261220T205959Z/);
  // Wednesday classes skip 4 November.
  assert.match(pmi, /EXDATE;TZID=Europe\/Moscow:20261104T\d{6}/);
  const fiit = calendarFile({...groupSchedule(snapshot.schedule,'141'), term}, {}, new Date('2026-09-26T10:00:00Z'));
  assert.match(fiit, /RRULE:FREQ=WEEKLY;INTERVAL=2;/);
});
