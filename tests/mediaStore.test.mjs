import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaRecord, mediaStorageKey, MEDIA_DB_NAME, MEDIA_DB_VERSION, MEDIA_STORE } from '../mediaStore.js';

test('uses an independent media database contract', () => {
  assert.equal(MEDIA_DB_NAME, 'creator-os-media');
  assert.equal(MEDIA_DB_VERSION, 1);
  assert.equal(MEDIA_STORE, 'media');
});

test('builds project-scoped storage keys', () => {
  assert.equal(mediaStorageKey('p1', 'image-1'), 'p1::image-1');
  assert.equal(mediaStorageKey('', 'image-1'), '');
  assert.notEqual(mediaStorageKey('p1', 'same'), mediaStorageKey('p2', 'same'));
});

test('creates a Blob-backed record and minimal MediaRef without Data URL duplication', () => {
  const blob = new Blob(['abc'], { type: 'image/jpeg' });
  const record = createMediaRecord({ projectId: 'p1', mediaId: 'image-1', kind: 'image', blob });
  assert.equal(record.key, 'p1::image-1');
  assert.equal(record.blob, blob);
  assert.deepEqual(record.ref, { id: 'image-1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3 });
  assert.equal('data' in record, false);
});

test('rejects incomplete records before IndexedDB is touched', () => {
  assert.equal(createMediaRecord({ projectId: '', mediaId: 'm1', blob: new Blob(['x']) }), null);
  assert.equal(createMediaRecord({ projectId: 'p1', mediaId: '', blob: new Blob(['x']) }), null);
  assert.equal(createMediaRecord({ projectId: 'p1', mediaId: 'm1' }), null);
});
