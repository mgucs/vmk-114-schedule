import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {liquidVars} from '../lib/liquid.mjs';

// index.html repeats liquidVars so the saved level applies before the first paint: both must give the same values.
test('the startup script in index.html matches lib/liquid.mjs', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/var v=30;[\s\S]*?\}\)\(\);<\/script>/)[0].replace('})();</script>', '');
  for (const saved of ['0', '35', '50', '80', '100', null]) {
    const set = {};
    const localStorage = {getItem:() => saved};
    const document = {documentElement:{style:{setProperty:(k, v) => { set[k] = v; }}}};
    new Function('localStorage', 'document', script)(localStorage, document);
    assert.deepEqual(set, liquidVars(saved ?? 30), `level ${saved}`);
  }
});
test('the background slider sets only the shade, 0…1', () => {
  assert.deepEqual(liquidVars(0), {'--shade':'0'});
  assert.deepEqual(liquidVars(30), {'--shade':'0.3'});
  assert.deepEqual(liquidVars(140), {'--shade':'1'});
});

import {deviceTier, initialTier} from '../lib/glass-quality.mjs';
test('effects level: device guess, measured step-down, manual choice', () => {
  assert.equal(deviceTier({cores:8, memory:8, coarse:false}), 'full');
  assert.equal(deviceTier({cores:8, memory:8, coarse:true}), 'balanced');
  assert.equal(deviceTier({cores:4, memory:8, coarse:true}), 'lite');
  assert.equal(deviceTier({cores:8, memory:8, coarse:true, reduced:true}), 'lite');
  assert.equal(initialTier(null, 'lite', {coarse:true}), 'lite', 'measuring found the phone too slow');
  assert.equal(initialTier(null, 'full', {coarse:true}), 'balanced', 'a measured level never raises the guess');
  assert.equal(initialTier('full', 'lite', {coarse:true}), 'full', 'a manual choice wins');
});
test('the startup script picks the same effects level as lib/glass-quality.mjs', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/var g='balanced';[\s\S]*?dataset\.glass=g;/)[0];
  const cases = [[null, null, {cores:8, memory:8, coarse:true}], ['full', null, {cores:2, memory:2, coarse:true}], [null, 'lite', {cores:8, memory:8, coarse:true}], [null, null, {cores:8, memory:8, coarse:false}], [null, null, {cores:4, memory:8, coarse:false}]];
  for (const [choice, measured, env] of cases) {
    const store = {'vmk114-glass-quality':choice, 'vmk114-glass-auto':measured};
    const document = {documentElement:{dataset:{}}};
    new Function('localStorage', 'navigator', 'matchMedia', 'document', script)(
      {getItem:k => store[k] ?? null}, {hardwareConcurrency:env.cores, deviceMemory:env.memory},
      q => ({matches:q.includes('coarse') ? env.coarse : false}), document);
    assert.equal(document.documentElement.dataset.glass, initialTier(choice, measured, env), JSON.stringify([choice, measured, env]));
  }
});
