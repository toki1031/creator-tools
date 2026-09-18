import test from 'node:test';
import assert from 'node:assert/strict';
import { dataUrlToBlob, storeAndApplyAutoImage } from '../autoImageMediaStorage.js';

const project = { id:'p1', scenes:[{id:'s1'}], mediaLibrary:[] };
const plan = { status:'ready', sceneId:'s1', candidate:{ title:'Historic image', previewUrl:'https://example.org/a.jpg' } };
const resolved = { id:'img1', data:'data:image/jpeg;base64,YWJj', provenance:{ provider:'library-of-congress', sourceUrl:'https://www.loc.gov/item/x/' } };

test('converts fetched Data URL to Blob before storage', async () => {
  const blob = dataUrlToBlob(resolved.data);
  assert.equal(blob.type, 'image/jpeg');
  assert.equal(blob.size, 3);
});

test('stores first, then applies only MediaRef to project', async () => {
  let storedBlob;
  const result = await storeAndApplyAutoImage(project, plan, resolved, {
    storeMedia: async input => {
      storedBlob = input.blob;
      return { status:'stored', mediaRef:{ id:'img1', kind:'image', mimeType:'image/jpeg', sizeBytes:3 } };
    }
  });
  assert.equal(result.status, 'applied');
  assert.equal(storedBlob.size, 3);
  const asset = result.project.mediaLibrary[0];
  assert.equal(asset.data, '');
  assert.deepEqual(asset.mediaRef, { id:'img1', kind:'image', mimeType:'image/jpeg', sizeBytes:3 });
  assert.equal(asset.source.sourceUrl, 'https://www.loc.gov/item/x/');
  assert.equal(result.project.scenes[0].imageAssetId, 'img1');
  assert.equal(project.mediaLibrary.length, 0);
});

test('storage failure leaves original project unchanged and never applies', async () => {
  let applyCalls = 0;
  const before = structuredClone(project);
  const result = await storeAndApplyAutoImage(project, plan, resolved, {
    storeMedia: async () => ({ status:'error', reason:'quota' }),
    applyAsset: () => { applyCalls += 1; }
  });
  assert.equal(result.status, 'error');
  assert.equal(result.reason, 'quota');
  assert.equal(applyCalls, 0);
  assert.deepEqual(project, before);
});

test('invalid image data is blocked before storage', async () => {
  let stores = 0;
  const result = await storeAndApplyAutoImage(project, plan, { ...resolved, data:'https://example.org/a.jpg' }, {
    storeMedia: async () => { stores += 1; }
  });
  assert.equal(result.status, 'blocked');
  assert.equal(stores, 0);
});
