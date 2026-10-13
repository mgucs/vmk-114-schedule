import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';

// Exercise the real scene methods without creating a WebGL renderer in Node.
const source = await readFile(new URL('../components/map-scene.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replace("@/lib/map-route.mjs", '../lib/map-route.mjs'), {
  compilerOptions:{target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext},
}).outputText;
await mkdir(new URL('../test-results/', import.meta.url), {recursive:true});
const moduleUrl = new URL('../test-results/map-scene.mjs', import.meta.url);
await writeFile(moduleUrl, compiled);
const {MapScene} = await import(moduleUrl.href);

test('replacing a map route disposes geometry and materials inside pins and the walker', () => {
  const scene = Object.create(MapScene.prototype);
  Object.assign(scene, {dynamic:new THREE.Group(), colors:{text:'#222', now:0x00ff00}, mode:'schema', active:6});
  const legs = [{floor:6, points:[[100,100], [200,100]]}];
  const marks = [{floor:6, x:100, y:100, box:[90,90,110,110], tone:'to'}];
  for (let round=0; round<3; round++) {
    scene.setRoute(legs, marks);
    const resources = new Set(), disposed = new Set();
    scene.dynamic.traverse(object => {
      for (const resource of [object.geometry, ...[object.material].flat()].filter(Boolean)) {
        resources.add(resource);
        resource.addEventListener('dispose', () => disposed.add(resource));
      }
    });
    assert.ok(resources.size >= 14, 'highlight, edges, nested pin, route and nested walker are tracked');
    scene.setRoute([], []);
    assert.deepEqual(disposed, resources);
    assert.equal(scene.dynamic.children.length, 0);
    assert.equal(scene.walker, null);
    assert.equal(scene.walkPath, null);
  }
});
