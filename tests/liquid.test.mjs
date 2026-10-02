import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {liquidVars} from '../lib/liquid.mjs';

// index.html repeats liquidVars so the saved level applies before the first paint: both must give the same values.
test('the startup script in index.html matches lib/liquid.mjs', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/var v=50;[\s\S]*?\}\)\(\);<\/script>/)[0].replace('})();</script>', '');
  for (const saved of ['0', '35', '50', '80', '100', null]) {
    const set = {};
    const localStorage = {getItem:() => saved};
    const document = {documentElement:{style:{setProperty:(k, v) => { set[k] = v; }}}};
    new Function('localStorage', 'document', script)(localStorage, document);
    assert.deepEqual(set, liquidVars(saved ?? 50), `level ${saved}`);
  }
});
test('text keeps a backing at full transparency', () => {
  const max = liquidVars(100);
  assert.ok(parseInt(max['--c-fill-d']) >= 40 && parseInt(max['--c-fill-l']) >= 60);
  assert.equal(liquidVars(50)['--lg2'], '0');
});
