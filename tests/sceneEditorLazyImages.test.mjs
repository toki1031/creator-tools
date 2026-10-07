import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../main.js',import.meta.url),'utf8');

test('Scene editor lazily hydrates image MediaRefs near the viewport',()=>{
  const start=main.indexOf('async function renderScenes');
  const end=main.indexOf('\nfunction ensureProjectSettings',start);
  const source=main.slice(start,end);
  assert.match(source,/IntersectionObserver/);
  assert.match(source,/rootMargin:"600px 0px"/);
  assert.match(source,/hydrateOneSceneImage/);
  assert.match(source,/loading="lazy" decoding="async"/);
  assert.doesNotMatch(source,/Promise\.all\(cards\.map/);
});
