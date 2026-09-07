import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImageVisualFeatureMap } from '../imageVisualFeatureMap.js';

function dataUrl(name) {
  return `data:image/png;base64,${name}`;
}

function imageData(value = 128) {
  return {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      value, value, value, 255,
      value, value, value, 255,
      value, value, value, 255,
      value, value, value, 255
    ])
  };
}

test('builds compact features by asset id without retaining raw media', async () => {
  const library = [
    { id: 'a1', type: 'image', data: dataUrl('one') },
    { id: 'a2', type: 'image', data: dataUrl('two') }
  ];
  const before = structuredClone(library);
  const calls = [];
  const result = await buildImageVisualFeatureMap(library, async (data, assetId) => {
    calls.push([data, assetId]);
    return imageData(assetId === 'a1' ? 64 : 192);
  });

  assert.deepEqual(library, before);
  assert.deepEqual(calls.map(call => call[1]), ['a1', 'a2']);
  assert.equal(result.featureMapVersion, '0.65');
  assert.equal(result.summary.processedAssets, 2);
  assert.deepEqual(Object.keys(result.featuresByAssetId), ['a1', 'a2']);
  assert.equal(JSON.stringify(result).includes('data:image'), false);
  assert.equal('data' in result.featuresByAssetId.a1, false);
});

test('skips malformed and duplicate assets and continues after decode failures', async () => {
  const library = [
    { id: 'a1', type: 'image', data: dataUrl('one') },
    { id: 'a1', type: 'image', data: dataUrl('duplicate') },
    { id: 'a2', type: 'video', data: dataUrl('wrong-type') },
    { id: 'a3', type: 'image', data: 'https://example.invalid/image.png' },
    { id: 'a4', type: 'image', data: dataUrl('fail') },
    { id: 'a5', type: 'image', data: dataUrl('ok') }
  ];
  const result = await buildImageVisualFeatureMap(library, async (_data, assetId) => {
    if (assetId === 'a4') throw new Error('decode failed');
    return imageData();
  });

  assert.equal(result.summary.eligibleAssets, 3);
  assert.equal(result.summary.attemptedAssets, 3);
  assert.equal(result.summary.processedAssets, 2);
  assert.equal(result.summary.failedAssets, 1);
  assert.equal(result.summary.skippedAssets, 3);
  assert.deepEqual(Object.keys(result.featuresByAssetId), ['a1', 'a5']);
});

test('bounds decode attempts even when every decode fails', async () => {
  const library = Array.from({ length: 10 }, (_, index) => ({
    id: `a${index}`,
    type: 'image',
    data: dataUrl(String(index))
  }));
  let calls = 0;
  const result = await buildImageVisualFeatureMap(library, async () => {
    calls += 1;
    throw new Error('fail');
  }, { maxAssets: 3 });

  assert.equal(calls, 3);
  assert.equal(result.summary.attemptedAssets, 3);
  assert.equal(result.summary.failedAssets, 3);
  assert.equal(result.summary.skippedAssets, 7);
  assert.deepEqual(result.featuresByAssetId, {});
});

test('missing decoder and malformed input return a safe empty map', async () => {
  const noDecoder = await buildImageVisualFeatureMap([{ id: 'a1', type: 'image', data: dataUrl('one') }], null);
  assert.equal(noDecoder.summary.skippedAssets, 1);
  assert.deepEqual(noDecoder.featuresByAssetId, {});

  const malformed = await buildImageVisualFeatureMap(null, async () => imageData());
  assert.equal(malformed.summary.inputAssets, 0);
  assert.deepEqual(malformed.featuresByAssetId, {});
});
