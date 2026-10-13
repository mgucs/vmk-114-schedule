import assert from 'node:assert/strict';
import {test} from 'node:test';
import {wantedPeople} from '../scripts/wanted-people.mjs';

test('staff sync skips missing winter lecturers and incomplete names from every source', () => {
  const source = {schedule:{groups:{'114':{lessons:[
    {detail:'Фомичёв В.В.'}, {detail:'Иванов-Петров А.Б.'}, {detail:''},
  ]}}}, faculty:{session:{lists:{pmi:[
    {lecturer:''}, {}, {lecturer:'   '}, {lecturer:'Иванов'}, {lecturer:'неизвестно.'},
    {lecturer:'доцент Фомичев Владимир Васильевич'},
  ]}, credits:{pmi:[{teachers:['', 'Петров', 'Петров И.П.', 'Фомичёв В.В.']}, {}]}}}};
  assert.deepEqual([...wantedPeople(source)].sort(), ['Иванов-Петров А.Б.', 'Петров И.П.', 'Фомичев В.В.']);
  assert.deepEqual([...wantedPeople({schedule:{groups:{}}})], []);
});
