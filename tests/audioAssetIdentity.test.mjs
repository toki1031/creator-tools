import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioAssetIdFromArrayBuffer, createAudioAssetIdFromFile, normalizeAudioAssetId } from '../audioAssetIdentity.js';

const encoder = new TextEncoder();
const ABC_SHA256 = 'audio-sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

test('audio asset id uses SHA-256 of raw bytes', async () => {
  assert.equal(await createAudioAssetIdFromArrayBuffer(encoder.encode('abc')), ABC_SHA256);
});

test('same audio bytes keep the same identity and different bytes change it', async () => {
  const a1=await createAudioAssetIdFromArrayBuffer(encoder.encode('same-audio'));
  const a2=await createAudioAssetIdFromArrayBuffer(encoder.encode('same-audio'));
  const b=await createAudioAssetIdFromArrayBuffer(encoder.encode('different-audio'));
  assert.equal(a1,a2);
  assert.notEqual(a1,b);
});

test('audio asset id normalization accepts canonical ids and rejects malformed values', () => {
  assert.equal(normalizeAudioAssetId(ABC_SHA256.toUpperCase()),ABC_SHA256);
  assert.equal(normalizeAudioAssetId('audio-sha256:abc'),'');
  assert.equal(normalizeAudioAssetId('sha256:'+ABC_SHA256.slice(-64)),'');
  assert.equal(normalizeAudioAssetId(undefined),'');
});

test('file hashing and digest failures never break BGM upload identity flow', async () => {
  const fakeFile={arrayBuffer:async()=>encoder.encode('abc').buffer};
  assert.equal(await createAudioAssetIdFromFile(fakeFile),ABC_SHA256);
  assert.equal(await createAudioAssetIdFromFile(fakeFile,{digest:async()=>{throw new Error('unavailable')}}),'');
  assert.equal(await createAudioAssetIdFromFile(null),'');
});
